import { describe, it, expect } from 'vitest';
import { swog } from '../src/commands/swog.ts';
import { unswog } from '../src/commands/unswog.ts';
import { swogStatus } from '../src/commands/swog-status.ts';
import { swogHelp } from '../src/commands/swog-help.ts';
import { readSwog } from '../src/db/index.ts';
import { fakeInteraction, testContext, testDb, contentOf } from './helpers.ts';

const GUILD = '111111111111111111';

describe('/swog', () => {
  it('activates swog and sends the second message as a follow-up', async () => {
    const ctx = testContext({ db: testDb(), random: () => 1 }); // never fail
    const { interaction, calls } = fakeInteraction({ commandName: 'swog', guildId: GUILD });

    await swog.execute(interaction, ctx);

    // THE REGRESSION TEST. The 2022 code called reply() twice, which throws
    // InteractionAlreadyReplied. The fake interaction throws on a second reply()
    // exactly like the real API, so if anyone reintroduces that bug, this fails.
    expect(calls.map((c) => c.type)).toEqual(['reply', 'followUp']);
    expect(contentOf(calls[0]!)).toBe('Swog activated.');
    expect(contentOf(calls[1]!)).toBe('Swog');

    expect(readSwog(ctx.db, GUILD).swog).toBe(true);
  });

  it('says so when swog is already active, and does not re-announce', async () => {
    const ctx = testContext({ db: testDb(), random: () => 1 });
    await swog.execute(fakeInteraction({ commandName: 'swog', guildId: GUILD }).interaction, ctx);

    const { interaction, calls } = fakeInteraction({ commandName: 'swog', guildId: GUILD });
    await swog.execute(interaction, ctx);

    expect(calls).toHaveLength(1);
    expect(contentOf(calls[0]!)).toBe('Swog is already activated.');
  });

  it('sometimes fails, and leaves swog OFF when it does', async () => {
    // The 5% branch is deterministic because `random` is injected. This is the
    // payoff of passing context in rather than reaching for a module global.
    const ctx = testContext({ db: testDb(), random: () => 0.01, swogFailChance: 0.05 });
    const { interaction, calls } = fakeInteraction({ commandName: 'swog', guildId: GUILD });

    await swog.execute(interaction, ctx);

    expect(contentOf(calls[0]!)).toBe('Swog unsuccessful. Please swog harder.');
    // The important half: a failed swog must not have swogged.
    expect(readSwog(ctx.db, GUILD).swog).toBe(false);
  });

  it('keeps each guild independent', async () => {
    const ctx = testContext({ db: testDb(), random: () => 1 });
    const other = '222222222222222222';

    await swog.execute(fakeInteraction({ commandName: 'swog', guildId: GUILD }).interaction, ctx);

    expect(readSwog(ctx.db, GUILD).swog).toBe(true);
    expect(readSwog(ctx.db, other).swog).toBe(false); // one server swogging doesn't swog the rest
  });
});

describe('/unswog', () => {
  it('deactivates an active swog', async () => {
    const ctx = testContext({ db: testDb(), random: () => 1 });
    await swog.execute(fakeInteraction({ commandName: 'swog', guildId: GUILD }).interaction, ctx);

    const { interaction, calls } = fakeInteraction({ commandName: 'unswog', guildId: GUILD });
    await unswog.execute(interaction, ctx);

    expect(contentOf(calls[0]!)).toBe('Swog deactivated.');
    expect(readSwog(ctx.db, GUILD).swog).toBe(false);
  });

  it('says so when swog is already off', async () => {
    const ctx = testContext({ db: testDb() });
    const { interaction, calls } = fakeInteraction({ commandName: 'unswog', guildId: GUILD });

    await unswog.execute(interaction, ctx);

    expect(contentOf(calls[0]!)).toBe('Swog is already deactivated.');
  });
});

describe('/swog-status', () => {
  it('reports inactive swog, and says how to fix that', async () => {
    const ctx = testContext({ db: testDb() });
    const { interaction, calls } = fakeInteraction({ commandName: 'swog-status', guildId: GUILD });

    await swogStatus.execute(interaction, ctx);

    expect(contentOf(calls[0]!)).toBe('Swog is not active. Type /swog to activate swog.');
  });

  it('reports active swog with a relative timestamp', async () => {
    const ctx = testContext({ db: testDb(), random: () => 1 });
    await swog.execute(fakeInteraction({ commandName: 'swog', guildId: GUILD }).interaction, ctx);

    const { interaction, calls } = fakeInteraction({ commandName: 'swog-status', guildId: GUILD });
    await swogStatus.execute(interaction, ctx);

    expect(contentOf(calls[0]!)).toMatch(/^Swog is active\. \(since <t:\d+:R>\)$/);
  });
});

describe('/swog-help', () => {
  it('sends an embed, not a v11 `embed` object', async () => {
    const ctx = testContext({ db: testDb() });
    const { interaction, calls } = fakeInteraction({ commandName: 'swog-help', guildId: GUILD });

    await swogHelp.execute(interaction, ctx);

    const payload = calls[0]!.payload as { embeds?: unknown[]; embed?: unknown };
    expect(payload.embeds).toHaveLength(1);
    // The 2019 bot sent `{ embed: {...} }` -- v11 syntax that v14 silently
    // ignores. Asserting its ABSENCE is what keeps that from creeping back.
    expect(payload.embed).toBeUndefined();
  });
});
