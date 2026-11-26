"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GROUP_SECTIONS, SECTIONS } from "@/lib/config";

type Ticket = {
  ticket_number: number;
  name: string;
  email: string;
  phone: string;
  section: string;
  group_name: string | null;
  checked_in_at: string | null;
  email_status: string;
  created_at: string;
};
type Group = { id: number; code: string; name: string; section: string; max_tickets: number; used: number };
type Data = { max: number; tickets: Ticket[]; groups: Group[] };

const LABEL: Record<string, string> = { solo: "Solo", panelist: "Panelist", vendor: "Vendor", runway: "Believers Runway" };
const fmt = (n: number) => "#" + String(n).padStart(3, "0");
const time = (iso: string | null) =>
  iso ? new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "";

const EMAIL_BADGE: Record<string, [string, string]> = {
  sent: ["Sent", "green"],
  outbox: ["Test (outbox)", "gold"],
  failed: ["Failed", "red"],
  not_configured: ["Not sent", "red"],
  pending: ["Sending…", ""],
};

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.status === 401) location.href = "/admin/login";
  return res.json();
}

export default function Dashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<"tickets" | "links">("tickets");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/data", { cache: "no-store" });
    if (res.status === 401) return (location.href = "/admin/login");
    setData(await res.json());
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000); // keep the numbers fresh
    return () => clearInterval(id);
  }, [load]);

  const stats = useMemo(() => {
    const t = data?.tickets ?? [];
    const by = (s: string) => t.filter((x) => x.section === s).length;
    return {
      total: t.length,
      checked: t.filter((x) => x.checked_in_at).length,
      solo: by("solo"),
      panelist: by("panelist"),
      vendor: by("vendor"),
      runway: by("runway"),
    };
  }, [data]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase().replace(/^#/, "");
    return (data?.tickets ?? []).filter((t) => {
      if (filter === "in" && !t.checked_in_at) return false;
      if (filter === "out" && t.checked_in_at) return false;
      if (!["all", "in", "out"].includes(filter) && t.section !== filter) return false;
      if (!needle) return true;
      return (
        String(t.ticket_number) === needle.replace(/^0+/, "") ||
        t.name.toLowerCase().includes(needle) ||
        t.email.includes(needle) ||
        t.phone.replace(/\D/g, "").includes(needle.replace(/\D/g, "") || "~") ||
        (t.group_name ?? "").toLowerCase().includes(needle)
      );
    });
  }, [data, filter, q]);

  if (!data) return <p style={{ padding: 24 }}>Loading…</p>;
  const left = data.max - stats.total;

  return (
    <>
      <div className="admin-top">
        <h1>HBA Free Tickets</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <a className="btn small gold" href="/api/admin/export">Download CSV</a>
          <button className="btn small ghost" style={{ color: "var(--ivory)" }}
            onClick={async () => { await post("/api/admin/logout", {}); location.href = "/admin/login"; }}>
            Log out
          </button>
        </div>
      </div>

      <main className="admin">
        <div className="stats">
          <Stat k="Free tickets given" v={`${stats.total}`} sub={`of ${data.max}`} />
          <Stat k="Remaining" v={`${left}`} />
          <Stat k="Checked in" v={`${stats.checked}`} sub={`of ${stats.total}`} />
        </div>
        <div className="stats" style={{ marginTop: 12 }}>
          <Stat k="Solo" v={`${stats.solo}`} />
          <Stat k="Panelists" v={`${stats.panelist}`} />
          <Stat k="Vendors" v={`${stats.vendor}`} />
          <Stat k="Believers Runway" v={`${stats.runway}`} />
        </div>

        <CheckIn onDone={load} />

        <div className="tabs">
          <button className={`tab ${tab === "tickets" ? "on" : ""}`} onClick={() => setTab("tickets")}>
            Tickets ({stats.total})
          </button>
          <button className={`tab ${tab === "links" ? "on" : ""}`} onClick={() => setTab("links")}>
            Group links ({data.groups.length})
          </button>
        </div>

        {tab === "tickets" ? (
          <div className="panel">
            <div className="row">
              <div>
                <label htmlFor="q">Search</label>
                <input id="q" placeholder="Ticket no., name, email, phone…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <div style={{ flex: "0 1 220px" }}>
                <label htmlFor="f">Show</label>
                <select id="f" value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option value="all">All tickets</option>
                  <option value="out">Not checked in</option>
                  <option value="in">Checked in</option>
                  <option value="solo">Solo</option>
                  <option value="panelist">Panelists</option>
                  <option value="vendor">Vendors</option>
                  <option value="runway">Believers Runway</option>
                </select>
              </div>
            </div>
            <TicketTable rows={rows} onChange={load} />
          </div>
        ) : (
          <Links groups={data.groups} onChange={load} />
        )}
      </main>
    </>
  );
}

function Stat({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div className="stat">
      <div className="k">{k}</div>
      <div className="v">
        {v} {sub && <span style={{ fontSize: 16, color: "var(--olive)", fontFamily: "var(--sans)" }}>{sub}</span>}
      </div>
    </div>
  );
}

type CheckResult = { status: string; message?: string; error?: string; ticket?: Ticket & { group_name: string | null } };

function CheckIn({ onDone }: { onDone: () => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    const r: CheckResult = await post("/api/admin/checkin", { ticket: value });
    setResult(r);
    setBusy(false);
    setValue("");
    onDone();
  }

  const t = result?.ticket;
  return (
    <div className="panel checkin-box">
      <h2>Check in at the door</h2>
      <form className="row" onSubmit={submit}>
        <div>
          <label htmlFor="tn">Ticket number</label>
          <input id="tn" inputMode="numeric" placeholder="e.g. 7 or #007" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <button className="btn" disabled={busy}>Check in</button>
      </form>
      {result && result.status === "checked_in" && t && (
        <div className="result ok">
          <strong>✓ {fmt(t.ticket_number)} checked in. Welcome, {t.name}!</strong>
          <div>{LABEL[t.section]}{t.group_name ? ` · ${t.group_name}` : ""}</div>
        </div>
      )}
      {result && result.status === "already" && t && (
        <div className="result bad">
          <strong>✗ {fmt(t.ticket_number)} was ALREADY checked in</strong>
          <div>{t.name}, at {time(t.checked_in_at)}. Do not let in again.</div>
        </div>
      )}
      {result && (result.status === "not_found" || result.error) && (
        <div className="result bad"><strong>✗ {result.message || result.error}</strong></div>
      )}
    </div>
  );
}

function TicketTable({ rows, onChange }: { rows: Ticket[]; onChange: () => void }) {
  const [busy, setBusy] = useState<number | null>(null);

  async function checkIn(t: Ticket) {
    if (!confirm(`Check in ${fmt(t.ticket_number)} (${t.name})?`)) return;
    setBusy(t.ticket_number);
    const r = await post("/api/admin/checkin", { ticket: t.ticket_number });
    if (r.status === "already") alert(`${fmt(t.ticket_number)} was already checked in.`);
    setBusy(null);
    onChange();
  }

  async function resend(t: Ticket) {
    setBusy(t.ticket_number);
    const r = await post("/api/admin/resend", { ticket: t.ticket_number });
    alert(r.status === "sent" ? `Email re-sent to ${t.email}.` : `Email status: ${r.status}`);
    setBusy(null);
    onChange();
  }

  if (!rows.length) return <p className="muted" style={{ marginTop: 16 }}>No tickets to show.</p>;
  return (
    <div className="table-wrap">
      <table className="t">
        <thead>
          <tr>
            <th>Ticket</th><th>Name</th><th>Email</th><th>Phone</th><th>Section</th>
            <th className="hide-sm">Email</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const [label, color] = EMAIL_BADGE[t.email_status] ?? [t.email_status, ""];
            return (
              <tr key={t.ticket_number} className={t.checked_in_at ? "in" : ""}>
                <td className="mono"><strong>{fmt(t.ticket_number)}</strong></td>
                <td>{t.name}</td>
                <td>{t.email}</td>
                <td style={{ whiteSpace: "nowrap" }}>{t.phone}</td>
                <td>
                  {LABEL[t.section] ?? t.section}
                  {t.group_name && <div className="muted" style={{ fontSize: 12 }}>{t.group_name}</div>}
                </td>
                <td className="hide-sm"><span className={`badge ${color}`}>{label}</span></td>
                <td>
                  {t.checked_in_at ? (
                    <span className="badge green" title={time(t.checked_in_at)}>✓ Checked in</span>
                  ) : (
                    <span className="badge">Not yet</span>
                  )}
                </td>
                <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                  {!t.checked_in_at && (
                    <button className="btn small" disabled={busy === t.ticket_number} onClick={() => checkIn(t)}>Check in</button>
                  )}{" "}
                  <button className="btn small ghost" disabled={busy === t.ticket_number} onClick={() => resend(t)}>Resend</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Links({ groups, onChange }: { groups: Group[]; onChange: () => void }) {
  const [name, setName] = useState("");
  const [section, setSection] = useState("panelist");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const r = await post("/api/admin/groups", { name, section });
    if (r.error) return setError(r.error);
    setName("");
    onChange();
  }

  async function remove(g: Group) {
    if (!confirm(`Delete the link for ${g.name}?`)) return;
    const r = await post("/api/admin/groups", { action: "delete", id: g.id });
    if (r.error) alert(r.error);
    onChange();
  }

  function copy(g: Group) {
    const url = `${origin}/g/${g.code}`;
    navigator.clipboard?.writeText(url);
    setCopied(g.code);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="panel">
      <h2>Create a private link</h2>
      <p className="muted">
        Make one link per panelist, one per vendor, and one for Believers Runway.
        Send them their link and they fill in their guests&apos; details.
      </p>
      <form className="row" onSubmit={create}>
        <div>
          <label htmlFor="gn">Name</label>
          <input id="gn" placeholder="e.g. Jane Wambui or Glow Naturals" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div style={{ flex: "0 1 240px" }}>
          <label htmlFor="gs">Section</label>
          <select id="gs" value={section} onChange={(e) => setSection(e.target.value)}>
            {GROUP_SECTIONS.map((section) => (
              <option key={section} value={section}>
                {SECTIONS[section].label} ({SECTIONS[section].max} tickets)
              </option>
            ))}
          </select>
        </div>
        <button className="btn">Create link</button>
      </form>
      {error && <div className="alert error">{error}</div>}

      {groups.length === 0 ? (
        <p className="muted" style={{ marginTop: 16 }}>No links yet.</p>
      ) : (
        <div className="table-wrap" style={{ marginTop: 18 }}>
          <table className="t">
            <thead>
              <tr><th>Name</th><th>Section</th><th>Used</th><th>Link</th><th></th></tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <td><strong>{g.name}</strong></td>
                  <td>{LABEL[g.section]}</td>
                  <td>
                    <span className={`badge ${Number(g.used) >= g.max_tickets ? "red" : ""}`}>
                      {g.used} / {g.max_tickets}
                    </span>
                  </td>
                  <td className="mono" style={{ wordBreak: "break-all" }}>
                    <a href={`/g/${g.code}`} target="_blank" rel="noreferrer">{origin}/g/{g.code}</a>
                  </td>
                  <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                    <button className="btn small" onClick={() => copy(g)}>{copied === g.code ? "Copied ✓" : "Copy link"}</button>{" "}
                    {Number(g.used) === 0 && (
                      <button className="btn small ghost" onClick={() => remove(g)}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
