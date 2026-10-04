import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runMigrations(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  // Match src/db/index.ts: Supabase pooler (PgBouncer transaction mode) rejects
  // prepared statements, so PG_PREPARE=false disables them here too.
  const sql = postgres(databaseUrl, {
    max: 1,
    ...(process.env.PG_PREPARE === 'false' ? { prepare: false as const } : {}),
  });

  try {
    await sql`
      create table if not exists migrations (
        id text primary key,
        applied_at timestamptz not null default now()
      )
    `;

    const rows = await sql<{ id: string }[]>`select id from migrations`;
    const applied = new Set(rows.map((r) => r.id));

    const dir = path.join(__dirname, 'sql');
    if (!fs.existsSync(dir)) {
      console.log('No sql directory — nothing to migrate');
      return;
    }

    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip ${file} (already applied)`);
        continue;
      }
      const content = fs.readFileSync(path.join(dir, file), 'utf8');
      console.log(`apply ${file}...`);
      await sql.unsafe(content);
      await sql`insert into migrations (id) values (${file})`;
      console.log(`applied ${file}`);
    }

    console.log('migrations complete');
  } finally {
    await sql.end();
  }
}

const invokedAsCli = (process.argv[1] ?? '').endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js');
if (invokedAsCli) {
  runMigrations().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
