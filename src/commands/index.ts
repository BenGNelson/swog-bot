import type { Command } from './types.ts';
import { swog } from './swog.ts';
import { unswog } from './unswog.ts';
import { swogStatus } from './swog-status.ts';
import { swogHelp } from './swog-help.ts';

/**
 * The command registry -- the single source of truth for what this bot can do.
 *
 * Both consumers read from here:
 *   - scripts/register.ts  -> uploads `data` to Discord
 *   - src/interactions.ts  -> routes incoming interactions to `execute`
 *
 * Because the name is written exactly once (inside each command's builder), the
 * registered name and the handled name CANNOT drift. The 2022 bot registered
 * '$swog' while the handler compared against '!swog', so nothing ever matched --
 * that class of bug is now unrepresentable.
 *
 * This is an explicit list, not an fs.readdirSync() autoloader. Autoloaders are
 * what every tutorial does; they also swallow import errors, break silently when
 * a file is misnamed, and are the first thing someone forking this has to
 * reverse-engineer. To add a command: write the file, add one line here.
 */
export const commands: readonly Command[] = [swog, unswog, swogStatus, swogHelp];

export type { Command, CommandContext } from './types.ts';
