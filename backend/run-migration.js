const fs = require('fs');
const path = require('path');
const { DataSource } = require('typeorm');
const { Client } = require('pg');
const dotenv = require('dotenv');
const { chooseMigrationBaseline } = require('./migration-runtime');
require('reflect-metadata');

dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '.env') });

const TRACKED_TABLES = [
  'drivers',
  'vehicles',
  'routes',
  'customers',
  'jobs',
  'reroute_requests',
  'dispatch_events',
  'route_versions',
  'organizations',
  'app_users',
  'organization_memberships',
  'depots',
  'job_stops',
  'route_plans',
  'route_plan_groups',
  'route_plan_stops',
  'route_run_stops',
  'route_assignments',
  'stop_events',
  'exceptions',
  'proof_artifacts',
  'audit_logs',
];

function isProductionDatabase(databaseUrl = '') {
  return (
    process.env.NODE_ENV === 'production' ||
    databaseUrl.includes('railway.app') ||
    databaseUrl.includes('rlwy.net') ||
    databaseUrl.includes('render.com') ||
    databaseUrl.includes('supabase.co')
  );
}

function createTypeOrmDataSource() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const useDist = fs.existsSync(path.join(__dirname, 'dist', 'backend', 'src', 'database', 'migrations'));
  if (!useDist) {
    require('ts-node/register/transpile-only');
  }

  return new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [
      useDist
        ? path.join(__dirname, 'dist', 'backend', 'src', '**', '*.entity.js')
        : path.join(__dirname, 'src', '**', '*.entity.ts'),
    ],
    migrations: [
      useDist
        ? path.join(__dirname, 'dist', 'backend', 'src', 'database', 'migrations', '*.js')
        : path.join(__dirname, 'src', 'database', 'migrations', '*.ts'),
    ],
    synchronize: false,
    logging: ['error', 'warn', 'migration'],
    ssl: isProductionDatabase(databaseUrl) ? { rejectUnauthorized: false } : false,
  });
}

async function ensureMigrationMetadata(client) {
  await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      timestamp BIGINT NOT NULL,
      name VARCHAR(255) NOT NULL
    )
  `);
}

async function inspectSchema(client) {
  const tables = {};
  const columns = {};

  const tableRows = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
  );
  for (const row of tableRows.rows) {
    tables[row.table_name] = true;
  }

  for (const table of TRACKED_TABLES) {
    if (!tables[table]) continue;
    const result = await client.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
      [table],
    );
    columns[table] = result.rows.map((row) => row.column_name);
  }

  const migrationCount = Number((await client.query('SELECT COUNT(*)::int AS count FROM migrations')).rows[0].count || 0);
  return { tables, columns, migrationCount };
}

async function baselineExistingSchema(client) {
  const schema = await inspectSchema(client);
  const baseline = chooseMigrationBaseline(schema);
  if (!baseline.length) {
    console.log('No migration baseline reconciliation needed.');
    return;
  }

  const existing = new Set(
    (await client.query('SELECT name FROM migrations')).rows.map((row) => row.name),
  );

  let inserted = 0;
  for (const migration of baseline) {
    if (existing.has(migration.name)) continue;
    await client.query(
      'INSERT INTO migrations(timestamp, name) VALUES($1, $2)',
      [migration.timestamp, migration.name],
    );
    inserted += 1;
  }

  if (inserted > 0) {
    console.log(`Baselined ${inserted} existing migration(s) from live schema reality.`);
  } else {
    console.log('Migration baseline already matches the live schema.');
  }
}

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: isProductionDatabase(databaseUrl) ? { rejectUnauthorized: false } : false,
  });

  const dataSource = createTypeOrmDataSource();

  try {
    console.log('='.repeat(60));
    console.log('Starting Database Migrations');
    console.log('='.repeat(60));

    await client.connect();
    console.log('Connected to database');

    await ensureMigrationMetadata(client);
    await baselineExistingSchema(client);

    await dataSource.initialize();
    const migrations = await dataSource.runMigrations({ transaction: 'all' });

    if (migrations.length === 0) {
      console.log('No pending TypeORM migrations.');
    } else {
      console.log(`Executed ${migrations.length} migration(s):`);
      for (const migration of migrations) {
        console.log(`  - ${migration.name}`);
      }
    }

    console.log('='.repeat(60));
    console.log('Migration pass complete');
    console.log('='.repeat(60));
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    await client.end();
  }
}

runMigrations().catch((error) => {
  console.error('='.repeat(60));
  console.error('Migration failed:');
  console.error(error && error.stack ? error.stack : error);
  console.error('='.repeat(60));
  process.exit(1);
});
