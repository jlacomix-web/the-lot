# The Lot: Radio City Music Hall Edition

Self-hosted version of the game: accounts and avatars (step 2), live multiplayer (step 3), and the livestream screen, moderation, backups and load testing (step 4).
Nothing here has been run end to end yet; expect to fix small things on first launch.

## Layout
- `client/` the game (static files). `js/game.js` is the whole game for now; `assets/models.json` holds the vehicle models.
- `server/` Node.js game server (`src/index.js`) and the database schema (`db/schema.sql`).
- `Caddyfile`, `Dockerfile.web`, `docker-compose.yml` the web server, game server and database.

## Try it on your own computer (Docker)
1. Install Docker Desktop (or Docker Engine + Compose).
2. `cp .env.example .env` and set a real `POSTGRES_PASSWORD`.
3. `docker compose up --build`
4. Open https://localhost (accept the local certificate warning). Check https://localhost/healthz shows `{"ok":true,"db":"ok",...}`.

Open the page, create an account, then build your avatar. While `SMTP_URL` is empty, the confirmation email is **printed in the game server log**:
`docker compose logs game` (look for `[mail:dev]`), then open the link it shows. To skip email while testing, set `REQUIRE_EMAIL_VERIFICATION=false` in `.env`.

## Multiplayer (step 3)
After you press START the game opens a live connection (`/ws`, signed-in players only). You then see everyone else's avatar with a name tag.
- **Seats:** the server owns seat claims. Two people cannot take the same seat; a seat frees when you stand up or disconnect. You must be near a seat to claim it.
- **Emotes:** keys 1-5 (wave, dance, cheer, clap, point). **Chat:** Enter to type, Enter to send, Esc to cancel. Commands: `/mute name`, `/unmute name` (saved to your account).
- **Livestream screen:** its animation runs off a server-synced clock, so everyone sees the same thing.
- **Server checks:** movement is limited to the world bounds and a maximum speed (jumps are ignored), messages are rate limited per connection, chat is cleaned (control and direction-override characters removed, 140 characters max, 5-message burst then 1 per second), emote and mute commands are throttled, and one connection per account (signing in elsewhere disconnects the old one).
- **Not synced (each player sees their own):** the street crowd and traffic.
- **Bandwidth saving:** snapshots only include players who moved (idle seated players are resent every 2 seconds), and players more than 70 m away update at half rate.
- **Tests:** `cd server && npm test` runs the security and game-logic tests (no database needed).
- **Load:** see "Load and capacity" below.

## Accounts and security notes
- Passwords are stored only as salted scrypt hashes (built into Node). Sessions are random tokens in an HttpOnly, SameSite=Lax cookie (Secure over HTTPS); only a hash of each token is stored.
- Sign-in, sign-up, resend and reset are rate limited in memory (this resets if the server restarts).
- Sign-up and "forgot password" give the same reply whether or not an email is registered.
- Avatars are a handful of whitelisted numbers (`client/assets/avatar-options.json`); the server rejects anything else.
- Real email: set `SMTP_URL` and `MAIL_FROM` in `.env` using an email-sending service (mail sent straight from your server often lands in spam).
- Not done yet: CAPTCHA, profanity filter on display names, admin tools to ban/mute, a Content-Security-Policy header, and a privacy policy and terms page.

## Database changes
Tables are created by the numbered files in `server/db/migrations/`. The server applies any new ones automatically on start, so rebuilding is safe.

## Deploy to a rented server
1. Rent an Ubuntu LTS VPS; add your SSH key; log in as a non-root user with sudo.
2. Point your domain's A record at the server's IP.
3. Install Docker (follow docs.docker.com for Ubuntu), then enable a firewall allowing only SSH, 80 and 443:
   `sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable`
4. Copy this folder to the server, `cp .env.example .env`, set `DOMAIN=your.domain` and a strong password.
5. `docker compose up -d --build`. Caddy gets the HTTPS certificate automatically.

## Without Docker (quick local check)
The page now needs the server for sign-in, so use Docker as above. (Running only the static files will show "Can't reach the server".)

## Roadmap
1. Project, server skeleton, deployment files. (done)
2. Accounts and the avatar creator, saved to the database. (this step)
3. Live movement, seat claims, emotes, chat, with server-side checks. (done)
4. Real livestream screen, moderation tools, backups, load testing. (this step)
5. Still to do: test everything on a real server with real players, privacy policy and terms, profanity filter, CAPTCHA, a Content-Security-Policy header, an admin web page.

## Livestream screen (step 4)
Video goes OBS -> streaming server (MediaMTX, RTMP in) -> Caddy -> players' browsers (HLS). Only signed-in players can watch: Caddy asks the game server to check the session cookie before serving any video.
1. Set `STREAM_PASS` in `.env` (letters and numbers only), open port 1935 in the firewall: `sudo ufw allow 1935`, then `docker compose up -d --build`.
2. In OBS: Settings > Stream > Custom. **Server:** `rtmp://your.domain/live`  **Stream key:** `?user=publisher&pass=YOUR_STREAM_PASS` (MediaMTX takes the credentials as URL parameters). Use H.264 video and AAC audio, a 2 second keyframe interval, and about 4-6 Mbps for 1080p.
3. Press Start Streaming. Inside the game the screen switches from the generated animation to your video within about 10 seconds, and switches back when you stop. The video is shown 16:9 across the width of the wall, with the animation filling the strips above and below.
4. In the hall: `[` and `]` change the screen volume, `B` mutes it.
- Latency is typically a few seconds (HLS). RTMP is not encrypted, so the publish password can be seen by anyone on the network between OBS and the server; use a password you use nowhere else, or restrict the publisher by IP (`ips:` in `stream/mediamtx.yml.template`).
- Video bandwidth is the big cost: every viewer pulls the full stream. 200 viewers at 5 Mbps is about 1 Gbps. For big audiences, put a CDN or a streaming service in front instead.
- I checked the MediaMTX settings against its documentation but have not run it. The image is `bluenviron/mediamtx:latest`; once it works for you, pin that version in `docker-compose.yml`. If OBS refuses the stream key format, look at `docker compose logs stream`.

## Moderation (step 4)
**First admin:** create your account in the game, confirm the email, then run
`docker compose exec game node scripts/admin.mjs promote you@example.com admin` and reconnect. Roles: `player`, `moderator`, `admin`.

In-game commands (type in chat):
| Command | Who | What it does |
|---|---|---|
| `/report name reason` | everyone | Saves a report with that player's recent chat lines and alerts online moderators (3 per 10 minutes) |
| `/mute name`, `/unmute name` | everyone | Hide that player's chat for you (saved to your account) |
| `/who` | moderator | Lists who is online |
| `/reports`, `/resolve number` | moderator | Shows open reports; marks one handled |
| `/kick name [reason]` | moderator | Removes them from the hall (they can reconnect) |
| `/timeout name minutes [reason]`, `/untimeout name` | moderator | Blocks their chat for 1 to 1440 minutes |
| `/announce text` | moderator | Message to everyone |
| `/ban name hours|perm [reason]`, `/unban name` | admin | Suspends the account, signs it out and disconnects it |
Moderators can only act on people of lower rank. Every kick, timeout, ban and announcement is saved in the audit log.

Admin tool (also handy for the basics without being in the game): `docker compose exec game node scripts/admin.mjs help` lists commands for users, promote, ban, unban, reports (with saved chat), audit log, forced sign-out and deleting an account.

## Backups (step 4)
The `backup` service dumps the database once a day into `./backups` (first one shortly after start) and deletes dumps older than `BACKUP_KEEP_DAYS`. Check it with `docker compose logs backup` and `ls backups`.
- **These are on the same server.** If the server is lost, so are they. Copy `./backups` somewhere else regularly (for example `rclone` to cloud storage, or `rsync` to another machine).
- **Restore:** `./scripts/restore.sh backups/thelot-DATE.dump` (asks for confirmation; replaces all data). Practise it once on a scratch copy before you need it.
- Not backed up: your `.env` file. Keep a copy somewhere safe.

## Load and capacity (step 4)
Measured with `cd server && npm run bench` (simulated players on the machine that ran it; no network or database):
| Players | Seated | Server time per 100 ms tick | Out per player | Total out |
|---|---|---|---|---|
| 100 | 60% | ~1 ms | ~11 KB/s | ~9 Mbit/s |
| 200 | 60% | ~3 ms | ~21 KB/s | ~34 Mbit/s |
| 200 | 0% (all walking) | ~5 ms | ~49 KB/s | ~80 Mbit/s |
| 200 | 95% | ~2 ms | ~3 KB/s | ~5 Mbit/s |
So the server's CPU work is small; **upload bandwidth is the limit**. A two-hour night with 200 people at about 34 Mbit/s moves roughly 30 GB, so check your host's traffic allowance. To reduce it, lower `tickMs`'s rate or `viewRadius` in `server/src/game.js`.

Test against the real server (real WebSockets, temporary bot accounts that are deleted afterwards):
`docker compose exec game node scripts/loadtest.mjs 100 60 --yes` (100 bots for 60 seconds). It prints per-bot bandwidth and the server's event-loop delay; `/healthz` also shows `loopLagMs` and `memMB`. Start small and raise the bot count while watching `loopLagMs` (anything steadily above ~50 means the server is struggling). This script has not been run yet.
