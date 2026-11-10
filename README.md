# PROX Marketing Agency

A corporate site and CMS with Uzbek and Russian content, a lead inbox, and Telegram delivery. The server renders HTML from a relational SQLite database. The application uses Node.js 24+ with no third-party runtime packages.

The supplied master prompt is the implementation reference. The separately named TZ Prox Marketing v1.0 document was not supplied.

## Run locally

From the project folder in PowerShell:

```powershell
Copy-Item .env.example .env
npm.cmd run build
npm.cmd start
```

Open [the Uzbek homepage](http://localhost:3000/uz), [the Russian homepage](http://localhost:3000/ru), or [the CMS](http://localhost:3000/admin). The server creates the database, applies the SQL migration, and seeds the services, pricing, and contact details on first run. The default database path is `data/prox.sqlite`. Leave the server running while using the website.

## Create CMS accounts

Stop and restart the local server only if you change its environment settings. In a separate PowerShell window from the same project folder:

```powershell
$env:PROX_ADMIN_EMAIL = Read-Host 'Administrator email'
$env:PROX_ADMIN_ROLE = 'admin'
$proxPassword = Read-Host 'Password (14 to 128 characters)' -AsSecureString
$env:PROX_ADMIN_PASSWORD = [Net.NetworkCredential]::new('', $proxPassword).Password
try { npm.cmd run admin } finally { Remove-Item Env:PROX_ADMIN_PASSWORD -ErrorAction SilentlyContinue }
```

Use `editor` to provision a Content Manager account. Running the command with an existing email changes that account’s password and role and revokes its previous sessions. There are no default accounts. Sign in at `/admin`.

- Administrators manage public content, its order and visibility, branding, contacts, pricing, and leads.
- Content Managers edit permitted bilingual text and images on existing content. The server checks permissions for every change. Account provisioning uses the command above.
- Lower order numbers appear first. New partners, projects, team members, and banners start hidden unless **Visible on website** is selected. Add both languages and localized image descriptions.
- The CMS converts PNG, JPEG, and WebP uploads to WebP in the browser. Use a browser with WebP canvas encoding for uploads. The server limits the resulting files to 450 KB and 1,800 pixels per side, checks the container and image headers, strips the browser-generated color profile, and serves images with a fixed MIME type.
- Branding includes an accent color, font family, and logo upload. The initial wordmark and growth illustration are site design defaults. Replace them through the CMS when official artwork is available.

## Configure Telegram

1. Put the rotated bot token in the private server environment as `TELEGRAM_BOT_TOKEN`. The example configuration sets `TELEGRAM_CHAT_ID=6908762743` for the owner. The public link to `@manager_prox` is managed separately in the CMS.
2. From the owner’s Telegram account, open the bot and press **Start**. [Telegram bot setup](https://core.telegram.org/bots/tutorial) · [Telegram Bot API](https://core.telegram.org/bots/api#sendmessage)
3. Review pending leads before enabling the bot. The server attempts queued deliveries on startup. Restart the app after updating the environment.
4. Sign in as an Administrator and select **Send Telegram test message** on the dashboard. Confirm the message arrived in the owner’s Telegram chat. The test button sends a fixed message and creates no lead. It is rate-limited to one attempt per minute.

The server commits each accepted lead before attempting delivery. It sends a plain-text notification with the customer details, lead ID, and local date and time in Asia/Tashkent. The queue records attempts, applies backoff after failures, and resumes on startup. Administrators can see delivery status and retry from a lead detail page. If Telegram accepts a message but its response is lost, a retry may send a duplicate notification with the same lead number.

## Deploy

Use one Node.js 24+ process with a persistent local disk. Run under a dedicated OS account with access to the source, environment, and database directory. Configure the process supervisor to restart the server after failure. This deployment uses a single writer instance and an in-process form signing key. Use durable local storage for the database and configure database-aware backups. For offline file backups, stop the process before copying the database and its sidecar files.

Set the following environment values on the server:

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
SITE_URL=https://proxmarketing.uz
DATABASE_PATH=/var/lib/prox/prox.sqlite
TRUST_PROXY=1
```

Point DNS for `proxmarketing.uz` at the hosting server. Terminate TLS at a reverse proxy under your control and keep the Node listener private. The proxy must replace or safely append the client IP to `X-Forwarded-For`. Use `TRUST_PROXY=0` when the app does not sit behind such a proxy. With a matching DNS record, a Caddy configuration can be as short as:

```caddyfile
proxmarketing.uz {
  encode zstd gzip
  reverse_proxy 127.0.0.1:3000
}
```

Run `npm run build`, provision the first administrator, then launch `npm start` through the supervisor. Store the Telegram settings in the supervisor’s secret environment or a private environment file. Back up the database before upgrades. Verify the live site, HTTPS, the admin cookie, an authorized test lead, the destination chat, and sitemap URLs. Keep QA data in a separate database.

## Verification

- `npm run build` checks JavaScript syntax, startup imports, migration and initial data. The server runs the source directly.
- `npm test` runs the local HTTP and persistence suite plus a simulated Telegram failure and retry test. It needs loopback networking and a temporary directory.
- After HTTPS deployment, run Google PageSpeed Insights for mobile and desktop on the public homepage and representative interior pages. Record the URL, date, score and audit details for each run. The target is 90+ in both modes.
- For feature coverage, results and outstanding launch checks, see [COMPLIANCE.md](COMPLIANCE.md).
