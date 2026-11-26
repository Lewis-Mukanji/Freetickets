import Hero from "@/components/Hero";
import ClaimForm from "@/components/ClaimForm";
import { maxTickets } from "@/lib/config";
import { totalIssued } from "@/lib/tickets";

export const dynamic = "force-dynamic";

export default async function Home() {
  const left = maxTickets() - (await totalIssued());
  return (
    <>
      <Hero subtitle="A gathering created for natural beauty, creativity and connection. Claim your free solo ticket below." />
      <main className="wrap">
        <div className="card">
          <h2>Claim your free ticket</h2>
          <p className="muted">One free ticket per person. Your ticket number will be sent to your email.</p>
          {left > 0 ? (
            <ClaimForm maxGuests={1} />
          ) : (
            <div className="alert error">Sorry, all free tickets have been given out.</div>
          )}
        </div>
        <p className="note">
          Panelists, vendors and Believers Runway: please use the private link you were sent.
          <br />
          Want a paid ticket instead? <a href="https://hairbyakose.com/events.html">Buy on hairbyakose.com</a>
        </p>
      </main>
    </>
  );
}
