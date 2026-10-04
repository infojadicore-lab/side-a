import 'dotenv/config';
import { buildApp } from './app.js';
import { config } from './config.js';
import { runMigrations } from './db/migrate.js';

async function main(): Promise<void> {
  const app = buildApp();

  try {
    // Self-heal: a deploy whose pre-deploy migrate never ran (or a freshly
    // wiped database) rebuilds its schema here instead of serving 500s.
    // runMigrations is a no-op ledger check when everything is applied.
    await runMigrations();
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

void main();
