/* =========================
   Stock Trading System (STS)
   Front-end only (localStorage)
========================= */

const STS = (function () {
  const STORE_KEY = "STS_STATE_V1";
  const SESSION_TIMEOUT_MIN = 5; // session timeout

  /* ---------- helpers ---------- */
  const $ = (sel) => document.querySelector(sel);
  const pad2 = (n) => String(n).padStart(2, "0");

  function nowISO() {
    const d = new Date();
    return (
      d.getFullYear() +
      "-" +
      pad2(d.getMonth() + 1) +
      "-" +
      pad2(d.getDate()) +
      " " +
      pad2(d.getHours()) +
      ":" +
      pad2(d.getMinutes()) +
      ":" +
      pad2(d.getSeconds())
    );
  }

  function money(n) {
    return Number(n || 0).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function uid() {
    return Math.floor(Math.random() * 1e9);
  }

  function nowMs() {
    return Date.now();
  }

  function ymdLocal(d = new Date()) {
    return (
      d.getFullYear() +
      "-" +
      pad2(d.getMonth() + 1) +
      "-" +
      pad2(d.getDate())
    );
  }

  function timeToMinutes(hhmm) {
    const [h, m] = String(hhmm || "").split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
    return h * 60 + m;
  }

  function generateToken(role) {
    const prefix = role === "ADMIN" ? "ADM" : "CUST";
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    const num = 1000 + (array[0] % 9000);
    return `${prefix}-${num}`;
  }

  function generateRecoveryCode() {
    const array = new Uint32Array(2);
    window.crypto.getRandomValues(array);
    const a = 1000 + (array[0] % 9000);
    const b = 1000 + (array[1] % 9000);
    return `REC-${a}-${b}`;
  }

  /* ---------- state ---------- */
  function defaultState() {
    return {
      session: null,

      users: [
        {
          id: 1,
          username: "customer",
          password: "Passw0rd!",
          role: "CUSTOMER",
          name: "Demo Customer",
          email: "customer@example.com",
          failedAttempts: 0,
          locked: false,
          token: "CUST-0001", // DEFAULT DEMO TOKEN
          recoveryCode: "REC-0001-0001", // DEFAULT DEMO RECOVERY
        },
        {
          id: 2,
          username: "admin",
          password: "Passw0rd!",
          role: "ADMIN",
          name: "Demo Admin",
          email: "admin@example.com",
          failedAttempts: 0,
          locked: false,
          token: "ADM-0002", // DEFAULT DEMO TOKEN
          recoveryCode: "REC-0002-0002", // DEFAULT DEMO RECOVERY
        },
      ],

      cashAccounts: [
        { userId: 1, balance: 50000 },
        { userId: 2, balance: 0 },
      ],

      stocks: [
        {
          ticker: "AAPL",
          company: "Apple Inc.",
          price: 175.43,
          volume: 52340821,
          marketCap: "2.75T",
          open: 173.2,
          high: 176.85,
          low: 172.9,
        },
        {
          ticker: "MSFT",
          company: "Microsoft Corporation",
          price: 378.91,
          volume: 28912450,
          marketCap: "2.82T",
          open: 376.5,
          high: 380.2,
          low: 375.8,
        },
        {
          ticker: "AMZN",
          company: "Amazon.com Inc.",
          price: 178.25,
          volume: 45621390,
          marketCap: "1.85T",
          open: 176.9,
          high: 179.4,
          low: 176.1,
        },
        {
          ticker: "GOOGL",
          company: "Alphabet Inc.",
          price: 141.8,
          volume: 31245670,
          marketCap: "1.78T",
          open: 140.25,
          high: 142.9,
          low: 139.8,
        },
        {
          ticker: "TSLA",
          company: "Tesla Inc.",
          price: 248.5,
          volume: 112340890,
          marketCap: "789B",
          open: 245.8,
          high: 250.2,
          low: 244.3,
        },
        {
          ticker: "META",
          company: "Meta Platforms Inc.",
          price: 484.03,
          volume: 18567230,
          marketCap: "1.23T",
          open: 481.5,
          high: 486.75,
          low: 480.2,
        },
      ],

      portfolioPositions: [
        { userId: 1, ticker: "AAPL", shares: 0 },
        { userId: 1, ticker: "MSFT", shares: 0 },
        { userId: 1, ticker: "GOOGL", shares: 0 },
        { userId: 1, ticker: "TSLA", shares: 0 },
        { userId: 1, ticker: "AMZN", shares: 0 },
        { userId: 1, ticker: "META", shares: 0 },
      ],

      orders: [],
      transactions: [],

      market: {
        openTime: "09:30",
        closeTime: "16:00",
        holidays: [], // { id, date:"YYYY-MM-DD", name:"..." }
        overrideEnabled: false,
        overrideState: "CLOSED", // "OPEN" | "CLOSED"
      },

      nextOrderId: 1234,
    };
  }

  function migrateState(s) {
    // Ensure market exists
    if (!s.market) {
      s.market = {
        openTime: "09:30",
        closeTime: "16:00",
        holidays: [],
        overrideEnabled: false,
        overrideState: "CLOSED",
      };
    } else {
      if (!s.market.openTime) s.market.openTime = "09:30";
      if (!s.market.closeTime) s.market.closeTime = "16:00";
      if (!Array.isArray(s.market.holidays)) s.market.holidays = [];
      if (typeof s.market.overrideEnabled !== "boolean") s.market.overrideEnabled = false;
      if (!s.market.overrideState) s.market.overrideState = "CLOSED";
    }

    // Ensure users have token + recoveryCode, while keeping demo defaults stable
    if (Array.isArray(s.users)) {
      s.users.forEach((u) => {
        if (!u.token) {
          if (u.username === "customer" && u.role === "CUSTOMER")
            u.token = "CUST-0001";
          else if (u.username === "admin" && u.role === "ADMIN")
            u.token = "ADM-0002";
          else u.token = generateToken(u.role);
        }
        if (!u.recoveryCode) {
          if (u.username === "customer" && u.role === "CUSTOMER")
            u.recoveryCode = "REC-0001-0001";
          else if (u.username === "admin" && u.role === "ADMIN")
            u.recoveryCode = "REC-0002-0002";
          else u.recoveryCode = generateRecoveryCode();
        }
        if (typeof u.failedAttempts !== "number") u.failedAttempts = 0;
        if (typeof u.locked !== "boolean") u.locked = false;
      });
    }
    return s;
  }

  function loadState() {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = migrateState(JSON.parse(raw));
      localStorage.setItem(STORE_KEY, JSON.stringify(s)); // persist migrations
      return s;
    }
    const s = defaultState();
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
    return s;
  }

  function saveState(s) {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  }

  function commit(s) {
    saveState(s);
    window.dispatchEvent(new Event("sts-updated"));
  }

  /* ---------- market status (ADDED) ---------- */
  function isHoliday(dateYMD) {
    const s = loadState();
    const d = dateYMD || ymdLocal();
    return (s.market?.holidays || []).some((h) => h.date === d);
  }

  // FIXED: supports admin manual override + schedule fallback
  function isMarketOpen(atDate = new Date()) {
    const s = loadState();
    const market = s.market || {
      openTime: "09:30",
      closeTime: "16:00",
      holidays: [],
      overrideEnabled: false,
      overrideState: "CLOSED",
    };

    // admin manual override (takes priority)
    if (market.overrideEnabled === true) {
      return String(market.overrideState || "CLOSED").toUpperCase() === "OPEN";
    }

    // weekend closed (Sat/Sun) - keep this if you want realism
    const day = atDate.getDay(); // 0 Sun ... 6 Sat
    if (day === 0 || day === 6) return false;

    // holiday closed
    const today = ymdLocal(atDate);
    if ((market.holidays || []).some((h) => h.date === today)) return false;

    const openM = timeToMinutes(market.openTime);
    const closeM = timeToMinutes(market.closeTime);

    // fail-open if misconfigured
    if (!Number.isFinite(openM) || !Number.isFinite(closeM)) return true;

    const nowM = atDate.getHours() * 60 + atDate.getMinutes();

    // If same time, treat as closed (no trading window)
    if (openM === closeM) return false;

    // Normal same-day window (e.g., 09:30 -> 16:00)
    if (closeM > openM) return nowM >= openM && nowM < closeM;

    // Overnight window crossing midnight (e.g., 20:00 -> 02:00)
    return nowM >= openM || nowM < closeM;
  }

  /* ---------- auth ---------- */
  function login(username, password, role) {
    const s = loadState();
    const u = s.users.find((x) => x.username === username && x.role === role);
    if (!u) return { ok: false, msg: "Invalid credentials." };

    if (u.locked) {
      return {
        ok: false,
        msg: "Account locked after too many failed attempts.",
        locked: true,
      };
    }

    if (u.password !== password) {
      u.failedAttempts = (u.failedAttempts || 0) + 1;
      if (u.failedAttempts >= 3) {
        u.locked = true;
      }
      saveState(s);
      return { ok: false, msg: "Invalid credentials.", locked: !!u.locked };
    }

    u.failedAttempts = 0;

    s.session = {
      userId: u.id,
      role: u.role,
      verified: false,
      lastActive: nowMs(),
    };
    saveState(s);

    return {
      ok: true,
      msg: "Credentials accepted. Enter security token.",
      locked: false,
    };
  }

  function verifyToken(token) {
    const s = loadState();
    if (!s.session) return { ok: false, msg: "No active login session." };

    const u = s.users.find((x) => x.id === s.session.userId);
    if (!u) return { ok: false, msg: "User not found." };

    if (u.locked)
      return {
        ok: false,
        msg: "Account locked. Use recovery to unlock.",
        locked: true,
      };

    const expected = u.token;

    if (token !== expected) return { ok: false, msg: "Invalid security token." };

    s.session.verified = true;
    s.session.lastActive = nowMs();
    saveState(s);

    return { ok: true, msg: "Token verified." };
  }

  function recoverAccount(username, role, recoveryCode) {
    const s = loadState();
    const u = s.users.find((x) => x.username === username && x.role === role);
    if (!u) return { ok: false, msg: "Account not found." };

    if (!u.locked) {
      return { ok: false, msg: "Account is not locked." };
    }

    if (!recoveryCode || recoveryCode !== u.recoveryCode) {
      return { ok: false, msg: "Invalid recovery code." };
    }

    u.locked = false;
    u.failedAttempts = 0;
    saveState(s);

    return {
      ok: true,
      msg: "Account unlocked. Please log in again.",
      token: u.token,
    };
  }

  function logout() {
    const s = loadState();
    s.session = null;
    saveState(s);
    window.location.href = "login.html";
  }

  function requireAuth(roles = null) {
    const s = loadState();
    if (!s.session || !s.session.verified) window.location.href = "login.html";

    const elapsed = (nowMs() - (s.session.lastActive || 0)) / 1000 / 60;
    if (elapsed > SESSION_TIMEOUT_MIN) {
      logout();
      return;
    }

    s.session.lastActive = nowMs();
    saveState(s);

    if (roles && s.session && !roles.includes(s.session.role))
      window.location.href = "login.html";
  }

  function registerCustomer({ name, username, email, password }) {
    const s = loadState();
    if (!name || !username || !email || !password)
      return { ok: false, msg: "All fields are required." };

    if (
      s.users.some((u) => u.username.toLowerCase() === username.toLowerCase())
    )
      return { ok: false, msg: "Username already exists." };

    const id = uid();
    const token = generateToken("CUSTOMER");
    const recoveryCode = generateRecoveryCode();

    s.users.push({
      id,
      username,
      password,
      role: "CUSTOMER",
      name,
      email,
      failedAttempts: 0,
      locked: false,
      token,
      recoveryCode,
    });

    s.cashAccounts.push({ userId: id, balance: 0 });
    saveState(s);

    return { ok: true, msg: "Account created.", token, recoveryCode };
  }

  /* ---------- cash ---------- */
  function getCashBalance(s, userId) {
    const acct = s.cashAccounts.find((a) => a.userId === userId);
    return acct ? acct.balance : 0;
  }

  function setCashBalance(s, userId, newBalance) {
    let acct = s.cashAccounts.find((a) => a.userId === userId);
    if (!acct) {
      acct = { userId, balance: 0 };
      s.cashAccounts.push(acct);
    }
    acct.balance = Number(newBalance);
  }

  function deposit(userId, amount) {
    const s = loadState();
    const n = Number(amount);
    if (!(n > 0)) return { ok: false, msg: "Deposit must be positive." };

    setCashBalance(s, userId, getCashBalance(s, userId) + n);

    s.transactions.unshift({
      id: uid(),
      userId,
      type: "Deposit",
      ticker: "-",
      qty: "-",
      price: "-",
      total: n,
      status: "Completed",
      dt: nowISO(),
    });

    saveState(s);
    return { ok: true, msg: "Deposit completed." };
  }

  function withdraw(userId, amount) {
    const s = loadState();
    const n = Number(amount);
    const bal = getCashBalance(s, userId);

    if (!(n > 0)) return { ok: false, msg: "Withdraw must be positive." };
    if (n > bal) return { ok: false, msg: "Insufficient balance." };

    setCashBalance(s, userId, bal - n);

    s.transactions.unshift({
      id: uid(),
      userId,
      type: "Withdraw",
      ticker: "-",
      qty: "-",
      price: "-",
      total: n,
      status: "Completed",
      dt: nowISO(),
    });

    saveState(s);
    return { ok: true, msg: "Withdrawal completed." };
  }

  /* ---------- orders ---------- */
  function placeMarketOrder({ userId, ticker, side, qty }) {
    const s = loadState();

    // block trading when market closed
    if (!isMarketOpen()) return { ok: false, msg: "Market is closed." };

    const q = Number(qty);
    if (!(q > 0)) return { ok: false, msg: "Quantity must be greater than 0." };

    const st = s.stocks.find((x) => x.ticker === ticker);
    if (!st) return { ok: false, msg: "Invalid ticker." };

    const price = st.price;
    const total = Number((price * q).toFixed(2));
    const bal = getCashBalance(s, userId);

    const pos = s.portfolioPositions.find(
      (p) => p.userId === userId && p.ticker === ticker
    );
    const sharesOwned = pos ? Number(pos.shares) : 0;

    if (side === "Buy" && total > bal)
      return { ok: false, msg: "Insufficient funds." };
    if (side === "Sell" && q > sharesOwned)
      return { ok: false, msg: "Insufficient shares." };

    const orderId = s.nextOrderId++;
    const order = {
      id: orderId,
      userId,
      ticker,
      side,
      qty: q,
      price,
      total,
      status: "Pending",
      dt: nowISO(),
    };
    s.orders.unshift(order);

    s.transactions.unshift({
      id: uid(),
      orderId: orderId,
      userId,
      type: side,
      ticker,
      qty: q,
      price,
      total,
      status: "Completed",
      dt: order.dt,
    });

    saveState(s);
    setTimeout(() => executeOrder(orderId), 2500);

    return { ok: true, msg: "Order submitted." };
  }

  function executeOrder(orderId) {
    const s = loadState();
    const order = s.orders.find((o) => o.id === orderId);
    if (!order || order.status !== "Pending") return;

    const userId = order.userId;

    let pos = s.portfolioPositions.find(
      (p) => p.userId === userId && p.ticker === order.ticker
    );
    if (!pos) {
      pos = { userId, ticker: order.ticker, shares: 0 };
      s.portfolioPositions.push(pos);
    }

    if (order.side === "Buy") {
      setCashBalance(s, userId, getCashBalance(s, userId) - order.total);
      pos.shares += order.qty;
    } else {
      setCashBalance(s, userId, getCashBalance(s, userId) + order.total);
      pos.shares -= order.qty;
    }

    order.status = "Executed";
    saveState(s);
  }

  function cancelOrder(orderId, userId) {
    const s = loadState();
    const order = s.orders.find((o) => o.id === orderId && o.userId === userId);

    if (!order) return { ok: false, msg: "Order not found." };
    if (order.status !== "Pending")
      return { ok: false, msg: "Only pending orders can be cancelled." };

    order.status = "Cancelled";

    const tx = s.transactions.find((t) => t.orderId === orderId);

    if (tx) {
      tx.status = "Cancelled";
      tx.type = "Cancel";
      tx.dt = nowISO();
    } else {
      s.transactions.unshift({
        id: uid(),
        orderId,
        userId,
        type: "Cancel",
        ticker: order.ticker,
        qty: order.qty,
        price: order.price,
        total: order.total,
        status: "Cancelled",
        dt: nowISO(),
      });
    }

    saveState(s);
    return { ok: true, msg: "Order cancelled." };
  }

  /* ---------- admin: market hours + override + holidays (ADDED) ---------- */
  function setMarketHours(openTime, closeTime) {
    const s = loadState();
    s.market.openTime = openTime;
    s.market.closeTime = closeTime;
    commit(s);
    return { ok: true, msg: "Market hours updated." };
  }

  function setMarketOverride(enabled, state) {
    const s = loadState();

    if (!s.market) {
      s.market = {
        openTime: "09:30",
        closeTime: "16:00",
        holidays: [],
        overrideEnabled: false,
        overrideState: "CLOSED",
      };
    }

    s.market.overrideEnabled = !!enabled;

    if (state != null) {
      const v = String(state).toUpperCase();
      if (!["OPEN", "CLOSED"].includes(v)) {
        return { ok: false, msg: "Invalid override state." };
      }
      s.market.overrideState = v;
    }

    commit(s);

    if (s.market.overrideEnabled) {
      return { ok: true, msg: `Manual override enabled: Market ${s.market.overrideState}.` };
    }
    return { ok: true, msg: "Manual override disabled. Market uses schedule." };
  }

  function addHoliday(date, name) {
    const s = loadState();
    if (!date || !name) return { ok: false, msg: "Date and name required." };

    // prevent duplicate date
    if ((s.market.holidays || []).some((h) => h.date === date)) {
      return { ok: false, msg: "Holiday already exists for this date." };
    }

    s.market.holidays.push({ id: uid(), date, name });
    commit(s);
    return { ok: true, msg: "Holiday added." };
  }

  function deleteHoliday(id) {
    const s = loadState();
    s.market.holidays = (s.market.holidays || []).filter((h) => h.id !== id);
    commit(s);
    return { ok: true, msg: "Holiday removed." };
  }

  function editHoliday(id, date, name) {
    const s = loadState();
    const h = (s.market.holidays || []).find((x) => x.id === id);
    if (!h) return { ok: false, msg: "Holiday not found." };
    if (!date || !name) return { ok: false, msg: "Date and name required." };

    if (h.date !== date && (s.market.holidays || []).some((x) => x.date === date)) {
      return { ok: false, msg: "Another holiday already exists for this date." };
    }

    h.date = date;
    h.name = name;
    commit(s);
    return { ok: true, msg: "Holiday updated." };
  }

  /* ---------- admin: stocks CRUD (ADDED) ---------- */
  function createStock({ company, ticker, volume, price, marketCap }) {
    const s = loadState();
    if (!company || !ticker || !volume || !price)
      return { ok: false, msg: "All fields required." };

    const upper = String(ticker).toUpperCase();
    if (s.stocks.some((st) => st.ticker === upper))
      return { ok: false, msg: "Ticker already exists." };

    const p = Number(price);
    const v = Number(volume);

    s.stocks.push({
      ticker: upper,
      company,
      price: p,
      volume: v,
      marketCap: marketCap ? String(marketCap) : "-",
      open: p,
      high: p,
      low: p,
    });

    commit(s);
    return { ok: true, msg: "Stock created." };
  }

  function updateStock(ticker, patch) {
    const s = loadState();
    const st = s.stocks.find((x) => x.ticker === String(ticker).toUpperCase());
    if (!st) return { ok: false, msg: "Stock not found." };

    if (patch.company != null) st.company = String(patch.company);

    // if admin edits ticker, handle rename safely
    if (patch.ticker != null) {
      const newTk = String(patch.ticker).toUpperCase();
      if (newTk !== st.ticker && s.stocks.some((x) => x.ticker === newTk)) {
        return { ok: false, msg: "New ticker already exists." };
      }
      const oldTk = st.ticker;
      st.ticker = newTk;

      // update portfolio positions + orders referencing ticker
      s.portfolioPositions.forEach((p) => {
        if (p.ticker === oldTk) p.ticker = newTk;
      });
      s.orders.forEach((o) => {
        if (o.ticker === oldTk) o.ticker = newTk;
      });
      s.transactions.forEach((t) => {
        if (t.ticker === oldTk) t.ticker = newTk;
      });
    }

    if (patch.volume != null) st.volume = Number(patch.volume);

    if (patch.price != null) {
      const p = Number(patch.price);
      st.price = p;
      if (st.open == null || st.open === 0) st.open = p;
      st.high = Math.max(Number(st.high || p), p);
      st.low = Math.min(Number(st.low || p), p);
    }

    if (patch.marketCap != null) st.marketCap = String(patch.marketCap);

    // allow admin to reset open/high/low by setting open explicitly (optional)
    if (patch.open != null) st.open = Number(patch.open);
    if (patch.high != null) st.high = Number(patch.high);
    if (patch.low != null) st.low = Number(patch.low);

    commit(s);
    return { ok: true, msg: "Stock updated." };
  }

  function deleteStock(ticker) {
    const s = loadState();
    const t = String(ticker).toUpperCase();

    s.stocks = s.stocks.filter((x) => x.ticker !== t);
    s.portfolioPositions = s.portfolioPositions.filter((p) => p.ticker !== t);

    commit(s);
    return { ok: true, msg: "Stock deleted." };
  }

  /* ---------- headers ---------- */
  function renderCustomerHeader(active) {
    const html = `
      <div class="header">
        <div class="container header-inner">
          <div class="brand">Stock Trading System</div>
          <div class="nav">
            <a href="dashboard.html">Dashboard</a>
            <a href="portfolio.html">Portfolio</a>
            <a href="transactions.html">Transactions</a>
            <a href="cash.html">Cash Account</a>
            <a href="#" id="logoutLink">Logout</a>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("afterbegin", html);
    $("#logoutLink").onclick = (e) => {
      e.preventDefault();
      logout();
    };
  }

  function renderAdminHeader() {
    const html = `
      <div class="header">
        <div class="container header-inner">
          <div class="brand">Stock Trading System - Admin</div>
          <div class="nav">
            <a href="admin.html">Create Stock</a>
            <a href="#" id="logoutLink">Logout</a>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("afterbegin", html);
    $("#logoutLink").onclick = (e) => {
      e.preventDefault();
      logout();
    };
  }

  /* ---------- price generator ---------- */
  function startPriceGenerator() {
    setInterval(() => {
      const s = loadState();
      s.stocks.forEach((st) => {
        const delta = (Math.random() - 0.5) * 2;
        st.price = clamp(Number((st.price + delta).toFixed(2)), 1, 10000);
        st.high = Math.max(st.high, st.price);
        st.low = Math.min(st.low, st.price);
      });
      saveState(s);
    }, 3000);
  }

  /* ---------- return ---------- */
  return {
    loadState,
    saveState,

    money,
    renderCustomerHeader,
    renderAdminHeader,

    // auth
    login,
    verifyToken,
    recoverAccount,
    logout,
    requireAuth,
    registerCustomer,

    // market status
    isMarketOpen,
    isHoliday,

    // trading
    startPriceGenerator,
    deposit,
    withdraw,
    getCashBalance,
    placeMarketOrder,
    cancelOrder,

    // admin
    setMarketHours,
    setMarketOverride,
    addHoliday,
    editHoliday,
    deleteHoliday,
    createStock,
    updateStock,
    deleteStock,
  };
})();