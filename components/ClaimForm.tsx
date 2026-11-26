"use client";

import { useState } from "react";
import type { claimTickets } from "@/lib/tickets";

type Guest = { name: string; email: string; phone: string };
type Claimed = Awaited<ReturnType<typeof claimTickets>>;

const emailMessage: Record<Claimed[number]["email_status"], string> = {
  sent: "Email sent. Check the inbox and spam folder.",
  outbox: "Email saved to the local outbox.",
  not_configured: "Email delivery is unavailable.",
  failed: "Email delivery failed.",
  missing: "Email delivery is unavailable.",
};

const empty = (): Guest => ({ name: "", email: "", phone: "" });
const fmt = (n: number) => "#" + String(n).padStart(3, "0");

export default function ClaimForm({ code, maxGuests }: { code?: string; maxGuests: number }) {
  const [guests, setGuests] = useState<Guest[]>([empty()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Claimed | null>(null);
  const group = Boolean(code);

  function update(i: number, field: keyof Guest, value: string) {
    setGuests((g) => g.map((x, j) => (j === i ? { ...x, [field]: value } : x)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, attendees: guests }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setDone(data.tickets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div>
        <div className="alert ok">
          {done.length === 1 ? "Your free ticket is confirmed!" : `${done.length} free tickets confirmed!`}{" "}
          {group ? "Share each ticket number with its guest to show at the entrance." : "Save your ticket number to show at the entrance."}
        </div>
        <ul className="ticket-list">
          {done.map((t) => (
            <li key={t.ticket_number}>
              <div>
                <div style={{ fontWeight: 600 }}>{t.name}</div>
                <div className="muted">{t.email}</div>
                <div className="muted">{emailMessage[t.email_status]}</div>
              </div>
              <div className="ticket-no">{fmt(t.ticket_number)}</div>
            </li>
          ))}
        </ul>
        {group && (
          <button className="btn ghost block" onClick={() => location.reload()}>
            Back to my link
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      {guests.map((g, i) => (
        <div key={i} className={group ? "guest" : ""}>
          {group && (
            <div className="guest-head">
              <strong>Guest {i + 1}</strong>
              {guests.length > 1 && (
                <button type="button" className="linkish" onClick={() => setGuests((x) => x.filter((_, j) => j !== i))}>
                  Remove
                </button>
              )}
            </div>
          )}
          <label htmlFor={`name-${i}`}>Full name</label>
          <input id={`name-${i}`} required autoComplete={group ? "off" : "name"} value={g.name}
            onChange={(e) => update(i, "name", e.target.value)} placeholder="e.g. Wanjiru Kamau" />
          <label htmlFor={`email-${i}`}>Email address</label>
          <input id={`email-${i}`} type="email" required autoComplete={group ? "off" : "email"} value={g.email}
            onChange={(e) => update(i, "email", e.target.value)} placeholder="name@example.com" />
          <label htmlFor={`phone-${i}`}>Phone number</label>
          <input id={`phone-${i}`} type="tel" required autoComplete={group ? "off" : "tel"} value={g.phone}
            onChange={(e) => update(i, "phone", e.target.value)} placeholder="e.g. 0712 345 678" />
        </div>
      ))}

      {group && guests.length < maxGuests && (
        <button type="button" className="btn ghost block" onClick={() => setGuests((g) => [...g, empty()])}>
          + Add another guest ({maxGuests - guests.length} more allowed)
        </button>
      )}

      {error && <div className="alert error">{error}</div>}

      <button className="btn block" disabled={busy}>
        {busy
          ? "Sending tickets…"
          : group
          ? `Send ${guests.length} ticket${guests.length === 1 ? "" : "s"}`
          : guests.length === 1
          ? "Get my free ticket"
          : `Get ${guests.length} free tickets`}
      </button>
    </form>
  );
}
