/* =========================
   Stock Trading System (STS)
   Front-end only (localStorage)
========================= */

// NOTE
// IP address must be manually changed during each test
const API_BASE = "http://18.218.213.112:3000";

const STS = (function () {
  const STORE_KEY = "STS_STATE_V1";
  const SESSION_TIMEOUT_MIN = 5;

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

  function uid() {
    return Math.floor(Math.random() * 1e9);
  }

  function nowMs() {
    return Date.now();
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
          token: "CUST-0001",
          recoveryCode: "REC-0001-0001",
          failedAttempts: 0,
          locked: false,
        },
        {
          id: 2,
          username: "admin",
          password: "Passw0rd!",
          role: "ADMIN",
          token: "ADM-0002",
          recoveryCode: "REC-0002-0002",
          failedAttempts: 0,
          locked: false,
        },
      ],
    };
  }

  function loadState() {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);

    const s = defaultState();
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
    return s;
  }

  function saveState(s) {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  }

  /* ---------- ✅ FIXED LOGIN (this is the important part) ---------- */
  async function login(username, password, role) {
    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { ok: false, msg: data.msg || "Login failed" };
      }

      const s = loadState();
      const u = s.users.find(
        (x) => x.username === username && x.role === role
      );

      if (u) {
        s.session = {
          userId: u.id,
          role: u.role,
          verified: false,
          lastActive: nowMs(),
        };
        saveState(s);
      }

      return {
        ok: true,
        msg: "Credentials accepted. Enter security token.",
      };
    } catch (err) {
      console.error(err);
      return { ok: false, msg: "Server error" };
    }
  }

  function verifyToken(token) {
    const s = loadState();
    if (!s.session) return { ok: false, msg: "No session." };

    const u = s.users.find((x) => x.id === s.session.userId);
    if (!u) return { ok: false };

    if (token !== u.token) {
      return { ok: false, msg: "Invalid token" };
    }

    s.session.verified = true;
    saveState(s);

    return { ok: true };
  }

  function logout() {
    const s = loadState();
    s.session = null;
    saveState(s);
    window.location.href = "login.html";
  }

  return {
    login,
    verifyToken,
    logout,
    loadState,
  };
})();