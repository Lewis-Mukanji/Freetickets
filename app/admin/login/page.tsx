"use client";

import { useState } from "react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) location.href = "/admin";
    else {
      setError((await res.json()).error || "Login failed.");
      setBusy(false);
    }
  }

  return (
    <>
      <header className="hero" style={{ paddingBottom: 80 }}>
        <div className="eyebrow">Admin</div>
        <h1>Free Tickets Dashboard</h1>
      </header>
      <main className="wrap" style={{ maxWidth: 420 }}>
        <form className="card" onSubmit={submit}>
          <h2>Log in</h2>
          <label htmlFor="pw">Admin password</label>
          <input id="pw" type="password" autoFocus required value={password} onChange={(e) => setPassword(e.target.value)} />
          {error && <div className="alert error">{error}</div>}
          <button className="btn block" disabled={busy}>{busy ? "Checking…" : "Log in"}</button>
        </form>
      </main>
    </>
  );
}
