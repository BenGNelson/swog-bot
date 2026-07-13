import { defineConfig } from 'drizzle-kit';

// Used only by `npm run db:generate`, which turns src/db/schema.ts into a
// versioned SQL migration in ./drizzle. Those migrations are COMMITTED and are
// applied automatically at boot (see openDatabase), so a deploy needs no manual
// migration step.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
