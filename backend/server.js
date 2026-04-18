require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { Pool } = require("pg");

const app = express();

const path = require('path');
app.use(express.static(path.join(__dirname, '../stock-trading-ui')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../stock-trading-ui/login.html'));
});

app.use(cors());
app.use(express.json());

// DB connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// 1) Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// 2) DB test
app.get("/api/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT 1 AS ok;");
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB connection failed" });
  }
});

// 3) Register (Completed Function #1)
app.post("/api/register", async (req, res) => {
  try {
    const { full_name, username, email, password } = req.body;

    if (!full_name || !username || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const userResult = await pool.query(
      `INSERT INTO users (full_name, username, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'customer')
       RETURNING user_id, username, email;`,
      [full_name, username, email, password_hash]
    );

    const user = userResult.rows[0];

    // Create cash account (1:1)
    await pool.query(
      `INSERT INTO cash_accounts (user_id, balance)
       VALUES ($1, 0.00)
       ON CONFLICT (user_id) DO NOTHING;`,
      [user.user_id]
    );

    res.status(201).json({ message: "Registered", user });
  } catch (err) {
    // Unique violations (username/email)
    if (err.code === "23505") {
      return res.status(409).json({ error: "Username or email already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// 4) Login (Completed Function #1)
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Missing credentials" });

    const result = await pool.query(
      `SELECT user_id, username, password_hash, role
       FROM users
       WHERE username = $1;`,
      [username]
    );

    if (result.rowCount === 0) return res.status(401).json({ error: "Invalid login" });

    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid login" });

    // Simple demo login response (JWT can come later)
    res.json({ message: "Login ok", user_id: user.user_id, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// 5) Get cash balance (supports Cash Account UI)
app.get("/api/cash/balance/:user_id", async (req, res) => {
  try {
    const user_id = Number(req.params.user_id);

    const result = await pool.query(
      `SELECT cash_account_id, balance
       FROM cash_accounts
       WHERE user_id = $1;`,
      [user_id]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: "Cash account not found" });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not fetch balance" });
  }
});

// 6) Deposit cash (Completed Function #2)
app.post("/api/cash/deposit", async (req, res) => {
  const client = await pool.connect();
  try {
    const { user_id, amount } = req.body;
    const amt = Number(amount);

    if (!user_id || !Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ error: "Invalid deposit amount" });
    }

    await client.query("BEGIN");

    // Get cash account
    const acctResult = await client.query(
      `SELECT cash_account_id, balance
       FROM cash_accounts
       WHERE user_id = $1
       FOR UPDATE;`,
      [user_id]
    );

    if (acctResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Cash account not found" });
    }

    const { cash_account_id } = acctResult.rows[0];

    // Insert transaction record
    await client.query(
      `INSERT INTO cash_transactions (user_id, cash_account_id, txn_type, amount)
       VALUES ($1, $2, 'deposit', $3);`,
      [user_id, cash_account_id, amt]
    );

    // Update balance
    const updated = await client.query(
      `UPDATE cash_accounts
       SET balance = balance + $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2
       RETURNING balance;`,
      [amt, user_id]
    );

    await client.query("COMMIT");

    res.json({ message: "Deposit successful", new_balance: updated.rows[0].balance });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Deposit failed" });
  } finally {
    client.release();
  }
});

app.listen(process.env.PORT || 3001, "0.0.0.0", () => {
  console.log(`API running on port ${process.env.PORT || 3001}`);
});
