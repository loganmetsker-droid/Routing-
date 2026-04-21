#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { DataSource } = require('typeorm');
const { Client } = require('pg');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');

for (const file of [
  path.join(backendDir, '.env'),
  path.join(backendDir, '.env.local'),
  path.join(rootDir, '.env'),
]) {
  if (fs.existsSync(file)) {
    dotenv.config({ path: file, override: false });
  }
}

function getNodeEnv() {
  return process.env.NODE_ENV || 'development';
}

function getConnectionConfig() {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    const parsed = new URL(databaseUrl);
    return {
      client: {
        connectionString: databaseUrl,
        ssl: false,
      },
      dataSource: {
        type: 'postgres',
        url: databaseUrl,
        ssl: false,
      },
      host: parsed.hostname,
    };
  }

  return {
    client: {
      host: process.env.DATABASE_HOST || process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DATABASE_PORT || process.env.DB_PORT || '5432'),
      user: process.env.DATABASE_USER || process.env.DB_USERNAME || 'postgres',
      password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || process.env.DB_NAME || 'routing_dispatch',
      ssl: false,
    },
    dataSource: {
      type: 'postgres',
      host: process.env.DATABASE_HOST || process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DATABASE_PORT || process.env.DB_PORT || '5432'),
      username: process.env.DATABASE_USER || process.env.DB_USERNAME || 'postgres',
      password: process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || process.env.DB_NAME || 'routing_dispatch',
      ssl: false,
    },
    host: process.env.DATABASE_HOST || process.env.DB_HOST || '127.0.0.1',
  };
}

function isLocalDatabaseHost(host) {
  return ['127.0.0.1', 'localhost'].includes(host);
}

async function getMissingCoreTables(client) {
  const requiredTables = ['customers', 'drivers', 'vehicles', 'jobs', 'routes'];
  const result = await client.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
    `,
    [requiredTables],
  );

  const existing = new Set(result.rows.map((row) => row.table_name));
  return requiredTables.filter((table) => !existing.has(table));
}

async function ensureExtensions(client) {
  await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
}

async function synchronizeSchema(connection) {
  const dataSource = new DataSource({
    ...connection.dataSource,
    entities: [path.join(rootDir, 'backend', 'dist', 'backend', 'src', '**', '*.entity.js')],
    synchronize: true,
    logging: false,
  });

  await dataSource.initialize();
  await dataSource.synchronize();
  await dataSource.destroy();
}

async function seedIfEmpty(client) {
  const [{ count: driverCount }] = (
    await client.query('SELECT COUNT(*)::int AS count FROM drivers WHERE deleted_at IS NULL')
  ).rows;
  const [{ count: vehicleCount }] = (
    await client.query('SELECT COUNT(*)::int AS count FROM vehicles WHERE deleted_at IS NULL')
  ).rows;

  if (driverCount === 0) {
    await client.query(`
      INSERT INTO drivers (
        first_name,
        last_name,
        email,
        phone,
        license_number,
        license_expiry_date,
        roles
      )
      VALUES
        ('Alex', 'Mason', 'alex.mason@routing.local', '555-0101', 'DL-ALEX-001', '2027-12-31', '["DRIVER"]'::jsonb),
        ('Jamie', 'Lee', 'jamie.lee@routing.local', '555-0102', 'DL-JAMIE-002', '2027-12-31', '["DRIVER"]'::jsonb)
      ON CONFLICT (email) DO NOTHING
    `);
    console.log('Seeded local drivers');
  }

  if (vehicleCount === 0) {
    await client.query(`
      INSERT INTO vehicles (
        make,
        model,
        year,
        license_plate
      )
      VALUES
        ('Ford', 'Transit', 2023, 'LOCAL-101'),
        ('Mercedes', 'Sprinter', 2024, 'LOCAL-102')
      ON CONFLICT (license_plate) DO NOTHING
    `);
    console.log('Seeded local vehicles');
  }
}

async function main() {
  if (process.env.AUTO_BOOTSTRAP_LOCAL_DB === '0') {
    console.log('Skipping local DB bootstrap because AUTO_BOOTSTRAP_LOCAL_DB=0');
    return;
  }

  const nodeEnv = getNodeEnv();
  if (!['development', 'test', 'local'].includes(nodeEnv)) {
    console.log(`Skipping local DB bootstrap in ${nodeEnv} mode`);
    return;
  }

  const connection = getConnectionConfig();
  if (!isLocalDatabaseHost(connection.host)) {
    console.log(`Skipping local DB bootstrap for non-local database host ${connection.host}`);
    return;
  }

  const client = new Client(connection.client);
  let clientClosed = false;
  await client.connect();

  try {
    await ensureExtensions(client);

    const missingTables = await getMissingCoreTables(client);
    if (missingTables.length > 0) {
      console.log(`Bootstrapping local DB schema; missing tables: ${missingTables.join(', ')}`);
      await client.end();
      clientClosed = true;
      await synchronizeSchema(connection);
      const seededClient = new Client(connection.client);
      await seededClient.connect();
      await seedIfEmpty(seededClient);
      await seededClient.end();
    } else {
      console.log('Local DB schema already contains required core tables');
      await seedIfEmpty(client);
    }
  } finally {
    if (!clientClosed) {
      await client.end().catch(() => undefined);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
