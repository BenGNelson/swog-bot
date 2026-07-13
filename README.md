# swog-bot

A Discord bot with exactly one job: turning **swog** on and off.

Swog is swag + frog. Both good things. There is no deeper explanation.

It's a joke bot built like a real one — TypeScript, SQLite, Docker, a real test
suite, and a deploy that fails loudly instead of quietly leaving the bot dead.
If you want a Discord bot template that isn't a toy, [take this one](#fork-this-as-a-template).

_AI-assisted build._

---

## What it does

| Command | What it says |
|---|---|
| `/swog` | `Swog activated.` — then, separately, `Swog` |
| `/unswog` | `Swog deactivated.` |
| `/swog-status` | `Swog is active. (since 3 hours ago)` |
| `/swog-help` | An embed listing the commands. Only you see it. |

Two details that are load-bearing to the joke:

- **`/swog` fails 5% of the time**, with `Swog unsuccessful. Please swog harder.`
  This is not a bug. Tune it with `SWOG_FAIL_CHANCE`.
- **Swog is per-server and survives restarts.** Your server's swog is your own,
  and a deploy doesn't quietly un-swog everyone.

---

## Quick start

You need [Docker](https://docs.docker.com/get-docker/) and a Discord account.
You do **not** need Node installed — everything runs in a container.

```bash
git clone https://github.com/BenGNelson/swog-bot.git
cd swog-bot
cp .env.example .env        # then fill it in — see below
make dev                    # runs the bot with hot reload
```

### 1. Create a Discord application

This is the step every other bot README skips, and it's where everyone gets stuck.

1. Go to the [Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. **Bot** → **Reset Token** → copy it. It is shown **once**. That's `DISCORD_TOKEN`.
3. **General Information** → copy the **Application ID**. That's `DISCORD_CLIENT_ID`.
   (This one is public — it's in your invite URL. It is not a secret.)
4. **Do not enable any Privileged Gateway Intents.** A slash-command bot needs
   none. See [How it works](#how-it-works) — this is the single most common
   mistake, and it's what broke this bot's own 2019 version.

### 2. Invite it to a server

**OAuth2 → URL Generator**:

- Scopes: **`bot`** *and* **`applications.commands`** ← you need **both**.
  Forgetting `applications.commands` is *the* reason slash commands never show
  up, and Discord gives you no error — the bot just joins and does nothing.
- Bot permissions: **none**. Replies travel over the interaction webhook, so the
  bot needs zero server permissions.

```
https://discord.com/oauth2/authorize?client_id=<YOUR_CLIENT_ID>&scope=bot+applications.commands&permissions=0
```

### 3. Configure

| Variable | Required | What it's for |
|---|---|---|
| `DISCORD_TOKEN` | ✅ | Bot token. **Never commit this.** |
| `DISCORD_CLIENT_ID` | ✅ | Application ID. Public. |
| `DISCORD_GUILD_ID` | | **Set it while developing.** See below. |
| `SWOG_FAIL_CHANCE` | | Default `0.05`. Set to `1` to always fail. |
| `LOG_LEVEL` | | `debug` \| `info` \| `warn` \| `error`. Default `info`. |
| `DEPLOY_HOST`, `DEPLOY_PATH` | | Only used by `make deploy`. |

**`DISCORD_GUILD_ID` is the one that matters.** It picks your registration scope:

- **Set** → commands register to that one server and appear **instantly**. Use
  this while developing.
- **Empty** → commands register **globally**, to every server the bot is in. Use
  this in production.

### 4. Run it

```bash
make register   # push the slash commands to Discord (do this after ANY command change)
make dev        # start the bot
```

Type `/swog` in your server.

> **Use two Discord applications** — one for production, one for local dev, each
> with its own token. Two processes running on the *same* token both receive
> every interaction, so every command answers **twice** and they race each other's
> database writes. A separate dev app makes that impossible.

---

## How it works

```
                    ┌──────────────────┐
  Discord Gateway ◄─┤  outbound only   │  no inbound ports. no web server.
        │           │  (a websocket)   │  no TLS. no reverse proxy.
        │           └──────────────────┘
        ▼
  ┌───────────┐   interactionCreate   ┌──────────────────┐
  │ client.ts │ ────────────────────► │ interactions.ts  │  routes by name,
  └───────────┘                       └────────┬─────────┘  catches every throw
                                               │
                                               ▼
                                      ┌──────────────────┐
                                      │  commands/*.ts   │  ← the only swog-specific code
                                      └────────┬─────────┘
                                               ▼
                                      ┌──────────────────┐
                                      │  db (SQLite)     │  per-guild, transactional
                                      └──────────────────┘
```

A few decisions worth knowing about, because they're the ones people get wrong:

**Zero privileged intents.** Slash commands arrive over the interaction gateway
no matter what intents you request. We ask for `Guilds` (non-privileged, free)
only so interaction data resolves to real objects and so we can clean up state
when the bot is kicked. We never ask for `MessageContent` — it's privileged,
needs approval, and a slash bot has no use for it. Reading `message.content` is
what the 2019 version did, and Discord making that intent privileged in September
2022 is exactly why it went silent.

**`respond()`, never `interaction.reply()`.** An interaction can be *replied to*
once; every message after the first must be a `followUp()`. Calling `reply()`
twice throws `InteractionAlreadyReplied` and takes the command down. One helper
([`src/respond.ts`](src/respond.ts)) makes the first call a reply and any later
call a follow-up, so a command author cannot get it wrong — and neither can the
error handler, which is where naive bots die.

**SQLite, not a JSON file.** Two people running `/swog` at the same time is a
read-modify-write race. Against a file, one of those updates is silently lost.
Here the read and the write happen in one transaction, so exactly one of them is
told they flipped it. `better-sqlite3` is synchronous, so that transaction is a
real critical section rather than a hopeful one.

**No build step.** Node runs the TypeScript directly via native type stripping —
no `tsc` build, no `dist/`, no bundler. The trade-off: stripping *erases* types
without *checking* them, so `npm run typecheck` is load-bearing. CI runs it, and
if it ever gets skipped, the types are decoration.

---

## Testing

```bash
make test           # typecheck + unit tests + docker build + secret scan
make check-secrets  # just the secret scan
```

**The whole suite runs offline.** No Discord token, no network, no test server.

There is no usable Discord mocking library (the popular one was last published in
2018), so [`tests/helpers.ts`](tests/helpers.ts) hand-rolls a fake interaction —
about 20 lines. Crucially, the fake **enforces Discord's rules**: calling
`reply()` twice *throws*, exactly like the real API. So the 2022 outage is a test
failure here rather than a production one.

The highest-value tests are the boring structural ones — every command name is
checked against Discord's actual regex (`^[-_\p{L}\p{N}]{1,32}$`). That single
assertion would have caught the bug that killed this bot for four years.

---

## Deployment

**Production is Docker on a Linux box. There is no registry** — the server pulls
from GitHub and builds the image itself.

```bash
make test            # must be green
git push             # the server pulls from GitHub, so push FIRST
make deploy          # ssh → git pull → docker compose up --build → wait for healthy
```

`make deploy` **fails if the bot doesn't come back healthy.** `docker compose up -d`
returns as soon as the container *starts*, and a bot with a bad token starts
perfectly well before dying — so the deploy waits for the healthcheck, and a
deploy that leaves the bot down exits non-zero.

Healthchecking a bot is a little odd: it listens on no port, so there's nothing to
curl. Instead the bot touches a heartbeat file while its gateway connection is
actually `READY`, and the healthcheck asserts that file is fresh. A plain "is the
process alive?" check would happily call a silently-disconnected bot healthy,
which is the exact failure worth catching.

First-time server setup is in **[DEPLOY.md](DEPLOY.md)**.

---

## Project structure

```
src/
  index.ts          entrypoint: config → db → client → login → signal handlers
  config.ts         the ONLY place process.env is read; validates and redacts
  client.ts         the Discord client, intents, events, heartbeat
  interactions.ts   routes interactions; the error boundary
  respond.ts        reply-or-followUp. read this one.
  healthcheck.ts    the Docker HEALTHCHECK probe
  logger.ts         structured JSON to stdout
  db/
    schema.ts       one table: guilds
    index.ts        open, migrate, read/write swog transactionally
  commands/
    index.ts        THE registry — one explicit list, no autoloader
    swog.ts         ─┐
    unswog.ts        │  the only swog-specific code in the repo
    swog-status.ts   │
    swog-help.ts    ─┘
scripts/
  register.ts       push slash commands to Discord (run deliberately, not on boot)
  deploy.sh         ssh → pull → build → restart → wait for healthy
  test.sh           the full gate
  check-secrets.sh  refuses to let a token or a hostname be committed
drizzle/            generated SQL migrations (committed; applied at boot)
tests/              vitest. runs entirely offline.
```

---

## Fork this as a template

Everything outside `src/commands/` is generic. To make this your own bot:

1. **Write your commands** in `src/commands/`. Each file exports `{ data, execute }`:

   ```ts
   import { SlashCommandBuilder, InteractionContextType } from 'discord.js';
   import { respond } from '../respond.ts';
   import type { Command } from './types.ts';

   export const ping: Command = {
     data: new SlashCommandBuilder()
       .setName('ping')
       .setDescription('Pong')
       .setContexts(InteractionContextType.Guild),

     async execute(interaction) {
       await respond(interaction, 'Pong!');
     },
   };
   ```

2. **Add one line** to `src/commands/index.ts`.
3. `make register`, then `make dev`.

That's the whole extension story. The registry is an explicit list rather than an
`fs.readdirSync()` autoloader on purpose: autoloaders swallow import errors, break
silently on a typo'd filename, and are the first thing you'd have to reverse-
engineer. One list you can grep is better.

Then rename the project: `package.json`, `docker-compose.yml`, and this README.

---

## Troubleshooting

Every item here is a real failure this repo has actually had.

**The slash commands don't appear.**
Either the invite was missing the **`applications.commands`** scope (re-invite
with both scopes), or you registered globally and are impatient. Set
`DISCORD_GUILD_ID` and re-run `make register` for instant, server-scoped commands.

**`Invalid Form Body` / `name: must match ^[-_\p{L}\p{N}]{1,32}$`**
A command name is illegal: uppercase, a space, or a symbol. Slash command names
are lowercase, ≤32 chars, no spaces, no `$`. (This bot once tried to register
`$swog status`. Discord rejected the entire batch, so *none* of the commands were
created, and nothing worked for four years.) `make test` catches this now.

**`InteractionAlreadyReplied`**
You called `interaction.reply()` twice. Use `respond()` from `src/respond.ts`.

**Every command answers twice.**
Two processes are running on the same token — probably a local `make dev` while
production is live. Use a separate dev application.

**The bot is online but silent.**
`make logs`, or on the server `docker compose logs -f`. If it's a wedged gateway,
the healthcheck will already have marked the container unhealthy.

**`Discord rejected the token (401)`**
The token is wrong or was reset. Note that the bot **exits immediately** rather
than retrying: Discord blocks an IP after 10,000 invalid requests in 10 minutes,
and this bot runs on a home network — a retry loop could get the whole house
IP-banned at the Cloudflare edge.

---

## License

MIT.

Original swog: 2019. Rebuilt from the ground up in 2026 after four years of being
extremely broken.
