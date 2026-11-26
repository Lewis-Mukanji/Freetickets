import { EVENT } from "@/lib/config";

export default function Hero({ subtitle }: { subtitle?: string }) {
  return (
    <header className="hero">
      <div className="eyebrow">Free tickets</div>
      <h1>{EVENT.name}</h1>
      {subtitle && <p>{subtitle}</p>}
      <div className="event-meta">
        <span>{EVENT.date}</span>
        <span>{EVENT.time}</span>
        <span>{EVENT.venue}</span>
      </div>
    </header>
  );
}
