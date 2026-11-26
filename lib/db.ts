import { createClient, type Client } from "@libsql/client";
import { SECTIONS } from "./config";

let client: Client | null = null;
let ready: Promise<void> | null = null;

async function migrate(c: Client) {
  if (!process.env.DATABASE_URL) {
    // Local file database: let simultaneous writes wait instead of failing.
    await c.execute("PRAGMA busy_timeout = 5000");
  }
  await c.executeMultiple(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      section TEXT NOT NULL,
      max_tickets INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_number INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      section TEXT NOT NULL,
      group_id INTEGER REFERENCES groups(id),
      checked_in_at TEXT,
      email_status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await c.execute({
    sql: `WITH limits(section, max_tickets) AS (VALUES ('panelist', ?), ('vendor', ?))
          UPDATE groups SET max_tickets = limits.max_tickets FROM limits
          WHERE groups.section = limits.section AND groups.max_tickets <> limits.max_tickets`,
    args: [SECTIONS.panelist.max, SECTIONS.vendor.max],
  });
}

export async function db(): Promise<Client> {
  if (!client) {
    client = createClient({
      url: process.env.DATABASE_URL || "file:local.db",
      authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
    });
    ready = migrate(client);
  }
  await ready;
  return client;
}

export type TicketRow = {
  ticket_number: number;
  name: string;
  email: string;
  phone: string;
  section: string;
  group_id: number | null;
  group_name: string | null;
  checked_in_at: string | null;
  email_status: string;
  created_at: string;
};

export type GroupRow = {
  id: number;
  code: string;
  name: string;
  section: string;
  max_tickets: number;
  used: number;
  created_at: string;
};
