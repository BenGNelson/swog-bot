# Deploying swog-bot

Everything here uses `<PLACEHOLDERS>`. Real hostnames and paths live in `.env`
(gitignored) — this file is committed to a public repo, so it never names a box.

---

## The shape of it

```
your laptop                          the server
───────────                          ──────────
make test      ─── must be green
git push       ─────────────────►  GitHub
make deploy    ─── ssh ──────────►  git pull --ff-only
                                    docker compose up --build -d
                                    wait for HEALTHY  ◄── the deploy gate
```

The server builds its own image from the checkout. **There is no registry.**

A Discord bot is **outbound-only** — it opens a websocket *to* Discord. This
surprises people who've only deployed web apps, so, explicitly:

- **no inbound ports**
- **no nginx / Apache / reverse proxy**
- **no TLS, no certificate, no domain**
- **no firewall change**

It coexists with whatever else is on the box without touching any of it.

---

## Where things live

| Thing | Path |
|---|---|
| Checkout | `<DEPLOY_PATH>` (e.g. `/home/<user>/swog-bot`) |
| Secrets | `<DEPLOY_PATH>/.env` — **chmod 600**, gitignored, hand-placed once |
| Database | Docker named volume `swog-bot_swog-data` → `/data/swog.db` in the container |
| Logs | `docker compose logs -f` (capped at 3×10MB — see the `x-logging` anchor) |

The database is a **named volume, not a bind mount**. `docker compose down`
keeps it; only `down -v` destroys it. That's what makes swog survive a deploy.

---

## First-time provision

Once, by hand. `deploy.sh` deliberately does not provision — it refuses to run
against a path that isn't already a git checkout, rather than silently creating one.

```bash
ssh <DEPLOY_HOST>

# 1. Docker, if it isn't already there
docker --version || curl -fsSL https://get.docker.com | sh

# 2. Clone
git clone https://github.com/BenGNelson/swog-bot.git <DEPLOY_PATH>
cd <DEPLOY_PATH>

# 3. The secret. Hand-placed, once. Never rsynced, never committed, never in git.
cp .env.example .env
chmod 600 .env
vi .env
#    DISCORD_TOKEN=<the PROD bot token>
#    DISCORD_CLIENT_ID=<the PROD application id>
#    DISCORD_GUILD_ID=            <-- LEAVE EMPTY in production (global commands)

# 4. Start it
docker compose up --build -d bot

# 5. Verify — this is the real check, not `docker ps`
docker compose ps                  # expect: healthy
docker compose logs bot | tail     # expect: "swog-bot ready"
```

Then, from your laptop, register the commands globally **once**:

```bash
# with DISCORD_GUILD_ID empty in your local .env
make register
```

Command registration is **not** part of `deploy.sh`. Registering on every boot is
a well-known anti-pattern: Discord allows only 200 command creations per day per
guild, so a crash-looping bot burns the quota and locks you out of fixing it. Run
it deliberately, only when the command list changes.

---

## Deploying a change

```bash
make test     # typecheck + tests + docker build + secret scan
git push
make deploy
```

`make deploy` will **refuse** to run if:

- the tests fail,
- the secret scan finds a token or a hostname,
- the server's working tree is dirty (someone hot-patched it — that's worth knowing about),
- the bot doesn't reach **healthy** within 5 minutes.

That last one matters: `docker compose up -d` returns as soon as the container
*starts*, and a bot with a bad token starts fine and then dies. The deploy waits
for the healthcheck.

---

## How do I…

**…see the logs?**
`ssh <DEPLOY_HOST> 'cd <DEPLOY_PATH> && docker compose logs -f bot'`

**…rotate the token?**
Reset it in the Developer Portal, edit `<DEPLOY_PATH>/.env`, then
`docker compose up -d --force-recreate bot`. No rebuild needed — the token is
runtime config, not baked into the image.

**…add or change a command?**
Edit `src/commands/`, `make test`, `git push`, `make deploy`, then `make register`.
The last step is easy to forget: without it Discord still advertises the old list.

**…look at the swog state?**
```bash
docker compose exec bot node -e "
  const db = require('better-sqlite3')('/data/swog.db');
  console.table(db.prepare('SELECT * FROM guilds').all());
"
```

**…wipe all swog state?**
`docker compose down && docker volume rm swog-bot_swog-data && docker compose up -d`

**…roll back?**
`git checkout <good-sha> && make deploy`. The image is rebuilt from the checkout,
so the checkout *is* the version.

---

## Operational notes

- **Restart policy is `unless-stopped`**, and the bot **exits rather than retrying**
  a rejected token. That combination is deliberate: Docker's restart backoff spaces
  failed attempts out to roughly one per minute. Discord blocks an IP after 10,000
  invalid requests in 10 minutes, and a bot on a home network shares that IP with
  the whole household.
- **Watchtower is opted out** (`com.centurylinklabs.watchtower.enable=false`). The
  image is built from source and has no registry to poll; without the label
  Watchtower complains on every cycle.
- **The database is never backed up.** If the volume is lost, every server resets
  to unswogged. For a joke bot that's acceptable — but it's a decision, not an
  oversight.
- **Only ever run ONE process per token.** Two instances both receive every
  interaction: users see doubled replies and the two race each other's writes.
  This is why dev uses a separate Discord application.
