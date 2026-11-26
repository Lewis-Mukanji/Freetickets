# Hair by Akose Festival: Free Tickets

A small website for giving out **free** festival tickets (paid tickets stay on hairbyakose.com).

| Page | Who uses it |
|---|---|
| `/` | The public. **Solo** free ticket, 1 per person |
| `/g/<code>` | Private link for each **Panelist** (6), **Vendor** (4) or **Believers Runway** (20) |
| `/admin` | You. Dashboard, check-in at the door, create the private links, download CSV |

**Rules the system enforces**

- At most **120** free tickets in total (`MAX_TICKETS`), numbered #001, #002, … in the order they're claimed.
- Each email address can only ever get **one** ticket.
- Each link caps new claims at 6 for panelists, 4 for vendors, or 20 for Believers Runway. A Solo claim is always exactly 1.
- A ticket can only be **checked in once**. A second attempt shows a red "ALREADY checked in" warning.
- Each person gets an email with a welcome message, their ticket number and a QR code.

---

## Run it on your computer

```powershell
npm install
npm run dev
```

Open http://localhost:3010. The admin is at http://localhost:3010/admin (password is in `.env.local`).
Locally, if email isn't set up, the emails are saved in the `outbox` folder so you can open and preview them.

---

## Host it on your own server (tickets subdomain)

Database = **Turso**, email = **Brevo SMTP**, hosting = **your server**.

### What the server needs
- **Node.js 20 or newer** (`node -v` to check)
- **HTTPS** on the subdomain. The admin login cookie only works over `https://`.

### 1. Upload the project
Copy this folder to the server **without** these: `node_modules`, `.next`, `local.db`, `outbox`, `.env.local`.

### 2. Create the settings file on the server
In the project folder on the server, create a file named **`.env.production.local`**:

```
ADMIN_PASSWORD=choose-a-strong-password
SESSION_SECRET=any-long-random-text-at-least-32-characters
MAX_TICKETS=120
DATABASE_URL=libsql://your-database.turso.io
DATABASE_AUTH_TOKEN=your-turso-token
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-login@smtp-brevo.com
SMTP_PASS=your-brevo-smtp-key
EMAIL_FROM="Hair by Akose Festival <tickets@hairbyakose.com>"
```

**`EMAIL_FROM` must be a sender you have verified in Brevo** (Brevo → Senders, Domains & Dedicated IPs).
Your Brevo SMTP login (`…@smtp-brevo.com`) is *not* a sender address, so emails fail without this.

### 3. Install, build and start
```
npm ci
npm run build
PORT=3010 npm start
```

To keep it running after you log out and after reboots, use pm2:
```
npm install -g pm2
PORT=3010 pm2 start npm --name hba-tickets -- start
pm2 save
pm2 startup
```

### 4. Point the subdomain at it
**VPS with Nginx:** add a site for the subdomain that forwards to the app, then turn on HTTPS:
```
server {
    server_name tickets.hairbyakose.com;
    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
```
sudo certbot --nginx -d tickets.hairbyakose.com
```

**cPanel hosting:** see the cPanel section below.

---

## cPanel: step by step

The site is built on your computer and uploaded as **`hba-tickets-upload.zip`** (already built, with
the settings file inside), so no terminal is needed on the server.

**To make a fresh zip after changing anything**, run in this folder:
```powershell
Remove-Item -Recurse -Force .next; npm run build; Remove-Item -Recurse -Force .next\cache; tar.exe -a -cf hba-tickets-upload.zip app components lib .next server.js package.json package-lock.json next.config.mjs tsconfig.json .env.production.local README.md
```

1. **Set the sender:** open `.env.production.local` in Notepad and replace
   `PUT-YOUR-VERIFIED-BREVO-SENDER-HERE` with your verified Brevo sender email, then make the zip again (above).
2. **cPanel → Setup Node.js App → Create Application**
   - Node.js version: **20** or higher (pick the highest offered)
   - Application mode: **Production**
   - Application root: `hba-tickets`
   - Application URL: your tickets subdomain
   - Application startup file: `server.js`
   - Click **Create**, then **Stop App**.
3. **cPanel → File Manager** → open the `hba-tickets` folder → **Upload** `hba-tickets-upload.zip`
   → right-click it → **Extract** → then delete the zip. (Turn on *Settings → Show Hidden Files*
   to see `.next` and `.env.production.local`.)
4. Back in **Setup Node.js App** → edit the app → click **Run NPM Install** and wait for it to finish
   → click **Start App** (or **Restart**).
5. **SSL:** cPanel → **SSL/TLS Status** → tick the subdomain → **Run AutoSSL**. The admin login needs `https://`.
6. Test it (step 5 above).

**If the page shows an error:** in the app's folder open `stderr.log` (or cPanel → Setup Node.js App →
the app's log) and send me what it says.

### 5. Check it works
1. Open `https://<your subdomain>/admin` and log in.
2. Claim a Solo ticket with **your own email** and check it arrives (look in spam too).
3. In the admin, find that ticket. Its **Email** column should say **Sent**.

---

## On the day

1. Open `/admin` on a phone or laptop at the entrance.
2. Type the guest's ticket number into **Check in at the door** (`7`, `007` or `#007` all work).
   - Green = welcome them in.
   - Red = already used or doesn't exist.
3. Download the CSV beforehand as a backup list in case the internet is bad.
