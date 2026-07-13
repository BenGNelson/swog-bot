import { describe, it, expect } from 'vitest';
import { inspect } from 'node:util';
import { loadConfig, ConfigError } from '../src/config.ts';

const VALID = {
  DISCORD_TOKEN: 'fake.token.value',
  DISCORD_CLIENT_ID: '531657454140915719',
};

describe('config', () => {
  it('parses a valid environment', () => {
    const config = loadConfig(VALID);
    expect(config.token).toBe('fake.token.value');
    expect(config.clientId).toBe('531657454140915719');
    expect(config.guildId).toBeUndefined();
    expect(config.swogFailChance).toBe(0.05);
  });

  it('reports EVERY problem at once, not just the first', () => {
    // Being told about a missing token, fixing it, re-running, and only then
    // being told the client ID is malformed is a bad afternoon.
    try {
      loadConfig({});
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const message = (error as Error).message;
      expect(message).toContain('DISCORD_TOKEN');
      expect(message).toContain('DISCORD_CLIENT_ID');
      expect(message).toContain('.env.example'); // tells you how to fix it
    }
  });

  it('rejects a client ID that is not a snowflake', () => {
    expect(() => loadConfig({ ...VALID, DISCORD_CLIENT_ID: 'not-a-snowflake' })).toThrow(ConfigError);
  });

  it('rejects a nonsensical fail chance', () => {
    expect(() => loadConfig({ ...VALID, SWOG_FAIL_CHANCE: '7' })).toThrow(ConfigError);
    expect(() => loadConfig({ ...VALID, SWOG_FAIL_CHANCE: 'frog' })).toThrow(ConfigError);
  });

  it('treats a set DISCORD_GUILD_ID as the dev/instant registration signal', () => {
    const config = loadConfig({ ...VALID, DISCORD_GUILD_ID: '222222222222222222' });
    expect(config.guildId).toBe('222222222222222222');
  });

  it('NEVER leaks the token when the config is serialized or inspected', () => {
    // This is how the token got onto GitHub in the first place. Make it
    // structurally hard to do again: a stray console.log(config), a JSON.stringify
    // in a log line, or an error that serializes its context must all be safe.
    const config = loadConfig({ ...VALID, DISCORD_TOKEN: 'super-secret-token' });

    expect(JSON.stringify(config)).not.toContain('super-secret-token');
    expect(inspect(config)).not.toContain('super-secret-token');

    // ...while the real value is still available to the code that needs it.
    expect(config.token).toBe('super-secret-token');
  });
});
