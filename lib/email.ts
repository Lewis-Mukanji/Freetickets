import QRCode from "qrcode";
import { EVENT, SECTIONS, formatTicket, type Section } from "./config";

type TicketEmail = {
  ticketNumber: number;
  name: string;
  email: string;
  section: Section;
  groupName: string | null;
};

function esc(s: string) {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

export function ticketEmailHtml(t: TicketEmail, qrSrc: string) {
  const first = esc(t.name.split(" ")[0]);
  const sectionLabel = SECTIONS[t.section]?.label ?? t.section;
  const via = t.groupName ? ` &middot; ${esc(t.groupName)}` : "";
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f1ecdf;font-family:Georgia,'Times New Roman',serif;color:#0d0d0b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1ecdf;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6d8b1">
  <tr><td style="background:#0d0d0b;padding:28px 28px 24px;text-align:center">
    <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#d6c187;font-family:Arial,sans-serif">Free ticket</div>
    <div style="font-size:30px;line-height:1.2;color:#f1ecdf;margin-top:8px">${esc(EVENT.name)}</div>
  </td></tr>
  <tr><td style="padding:28px 28px 8px">
    <p style="font-size:20px;margin:0 0 12px">Karibu, ${first}!</p>
    <p style="font-size:16px;line-height:1.6;margin:0 0 12px;font-family:Arial,sans-serif;color:#333">
      You're in. We're delighted to welcome you to the ${esc(EVENT.name)}, a gathering
      created for natural beauty, creativity and connection. Your free ticket is below.
    </p>
  </td></tr>
  <tr><td style="padding:8px 28px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px dashed #d6c187;background:#faf6ec">
      <tr><td style="padding:20px;text-align:center">
        <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#806628;font-family:Arial,sans-serif">Ticket number</div>
        <div style="font-size:48px;font-weight:bold;margin:4px 0 6px;letter-spacing:2px">${formatTicket(t.ticketNumber)}</div>
        <div style="font-size:15px;font-family:Arial,sans-serif;color:#333">${esc(t.name)}</div>
        <div style="font-size:13px;font-family:Arial,sans-serif;color:#806628;margin-top:2px">${esc(sectionLabel)}${via}</div>
        <img src="${qrSrc}" width="140" height="140" alt="Ticket ${formatTicket(t.ticketNumber)}" style="display:block;margin:16px auto 0;border:0">
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:20px 28px 8px;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#333">
    <strong>Date:</strong> ${esc(EVENT.date)}<br>
    <strong>Time:</strong> ${esc(EVENT.time)}<br>
    <strong>Venue:</strong> ${esc(EVENT.venue)}
  </td></tr>
  <tr><td style="padding:12px 28px 28px;font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#555">
    Please show your <strong>ticket number</strong> at the entrance. Each ticket admits one person
    and can only be checked in once.
    <br><br>See you there!<br><span style="font-family:Georgia,serif;font-size:17px;color:#0d0d0b">Hair by Akose</span>
  </td></tr>
  <tr><td style="background:#0d0d0b;padding:14px;text-align:center;font-family:Arial,sans-serif;font-size:12px">
    <a href="${EVENT.website}" style="color:#d6c187;text-decoration:none">hairbyakose.com</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function emailText(t: TicketEmail) {
  return `Karibu, ${t.name}!

You're in. Here is your free ticket for the ${EVENT.name}.

Ticket number: ${formatTicket(t.ticketNumber)}
Section: ${SECTIONS[t.section]?.label ?? t.section}${t.groupName ? ` (${t.groupName})` : ""}

Date: ${EVENT.date}
Time: ${EVENT.time}
Venue: ${EVENT.venue}

Please show your ticket number at the entrance. Each ticket admits one person.

See you there!
Hair by Akose`;
}

/** Returns "sent", or "outbox" when SMTP isn't configured (local testing). */
export async function sendTicketEmail(t: TicketEmail): Promise<"sent" | "outbox" | "not_configured"> {
  const qrPayload = `HBA-FESTIVAL-2026|${formatTicket(t.ticketNumber)}|${t.email}`;
  const subject = `Your free ticket ${formatTicket(t.ticketNumber)} – ${EVENT.name}`;

  if (!process.env.SMTP_HOST) {
    // No email server set up: save the email as a file so it can be previewed.
    if (process.env.VERCEL) return "not_configured";
    const fs = await import("node:fs/promises");
    const dataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 280 });
    await fs.mkdir("outbox", { recursive: true });
    await fs.writeFile(`outbox/ticket-${String(t.ticketNumber).padStart(3, "0")}.html`, ticketEmailHtml(t, dataUrl));
    return "outbox";
  }

  const from = process.env.EMAIL_FROM?.trim();
  if (!from || /PUT-YOUR|example\.com/i.test(from) || /@smtp-brevo\.com/i.test(from))
    throw new Error("EMAIL_FROM is not set to a verified sender address. Ticket emails cannot be sent.");

  const nodemailer = (await import("nodemailer")).default;
  const port = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const png = await QRCode.toBuffer(qrPayload, { margin: 1, width: 280 });
  await transport.sendMail({
    from,
    to: `"${t.name.replace(/"/g, "")}" <${t.email}>`,
    subject,
    text: emailText(t),
    html: ticketEmailHtml(t, "cid:ticket-qr"),
    attachments: [{ filename: "ticket-qr.png", content: png, cid: "ticket-qr" }],
  });
  return "sent";
}
