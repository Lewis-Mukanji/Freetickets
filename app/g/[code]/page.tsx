import Hero from "@/components/Hero";
import ClaimForm from "@/components/ClaimForm";
import { maxTickets, SECTIONS } from "@/lib/config";
import { getGroupByCode, totalIssued } from "@/lib/tickets";

export const dynamic = "force-dynamic";

export default async function GroupPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const group = await getGroupByCode(code);

  if (!group) {
    return (
      <>
        <Hero />
        <main className="wrap">
          <div className="card">
            <h2>Link not found</h2>
            <p className="muted">This ticket link isn&apos;t valid. Please check it with the Hair by Akose team.</p>
          </div>
        </main>
      </>
    );
  }

  const label = SECTIONS[group.section]?.label ?? group.section;
  const groupLeft = Math.max(0, group.max_tickets - group.used);
  const overallLeft = maxTickets() - (await totalIssued());
  const canAdd = Math.max(0, Math.min(groupLeft, overallLeft));
  const pct = Math.min(100, Math.round((group.used / group.max_tickets) * 100));

  return (
    <>
      <Hero subtitle={`${label} free tickets`} />
      <main className="wrap">
        <div className="card">
          <div className="eyebrow" style={{ color: "var(--bronze)" }}>{label}</div>
          <h2>{group.name}</h2>
          <p className="muted" style={{ marginTop: 6 }}>
            You can give out up to <strong>{group.max_tickets}</strong> free tickets.{" "}
            <strong>{group.used}</strong> used, <strong>{groupLeft}</strong> left.
          </p>
          <div className="progress"><span style={{ width: `${pct}%` }} /></div>

          {group.guests.length > 0 && (
            <p className="muted" style={{ marginTop: 12 }}>Already registered: {group.guests.join(", ")}</p>
          )}

          {canAdd > 0 ? (
            <>
              <p style={{ marginTop: 18, marginBottom: 0 }}>
                Enter the details of each person. Each guest needs their own email address, and each will receive
                their own ticket.
              </p>
              <ClaimForm code={group.code} maxGuests={canAdd} />
            </>
          ) : (
            <div className="alert error">
              {groupLeft <= 0
                ? "All tickets for this link have been claimed."
                : "Sorry, all free tickets for the festival have been given out."}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
