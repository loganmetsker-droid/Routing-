// TypeORM Migration Runner for Production
const { DataSource } = require('typeorm');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runSQLMigrations(databaseUrl) {
  const isProduction = process.env.NODE_ENV === 'production' ||
    databaseUrl.includes('railway.app') ||
    databaseUrl.includes('rlwy.net') ||
    databaseUrl.includes('render.com');

  const client = new Client({
    connectionString: databaseUrl,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    // Run SQL migrations in order
    const sqlMigrations = [
      'src/database/migrations/V1_create_tables.sql',
      'src/database/migrations/V2_create_hypertables.sql',
      'migrations/add-job-workflow-fields.sql',
    ];

    for (const migrationFile of sqlMigrations) {
      const migrationPath = path.join(__dirname, migrationFile);

      if (!fs.existsSync(migrationPath)) {
        console.log(`⚠️  Skipping ${migrationFile} - file not found`);
        continue;
      }

      console.log(`\nRunning SQL migration: ${migrationFile}...`);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      try {
        await client.query(migrationSQL);
        console.log(`✅ ${migrationFile} completed`);
      } catch (error) {
        // Ignore errors for tables that already exist
        if (error.message.includes('already exists')) {
          console.log(`⚠️  ${migrationFile} - objects already exist (skipping)`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n✅ SQL migrations completed');
  } finally {
    await client.end();
  }
}

async function runTypeORMMigrations() {
  const isProduction = process.env.NODE_ENV === 'production' ||
    (process.env.DATABASE_URL && (
      process.env.DATABASE_URL.includes('railway.app') ||
      process.env.DATABASE_URL.includes('rlwy.net') ||
      process.env.DATABASE_URL.includes('render.com')
    ));

  const dataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [path.join(__dirname, 'dist', '**', '*.entity.js')],
    migrations: [path.join(__dirname, 'dist', 'database', 'migrations', '*.js')],
    synchronize: false,
    logging: true,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('\nInitializing TypeORM DataSource...');
    await dataSource.initialize();
    console.log('✅ TypeORM DataSource initialized');

    console.log('\nRunning TypeORM migrations...');
    const migrations = await dataSource.runMigrations({ transaction: 'all' });

    if (migrations.length === 0) {
      console.log('✅ No TypeORM migrations to run (all up to date)');
    } else {
      console.log(`✅ Executed ${migrations.length} TypeORM migration(s):`);
      migrations.forEach(migration => {
        console.log(`  - ${migration.name}`);
      });
    }

    // Verify jobs table exists
    console.log('\nVerifying jobs table...');
    const result = await dataSource.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'jobs'
      );
    `);

    if (result[0].exists) {
      console.log('✅ Jobs table exists');

      // Check for job_number column
      const columns = await dataSource.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'jobs'
        ORDER BY ordinal_position;
      `);
      console.log(`   Found ${columns.length} columns in jobs table`);
    } else {
      console.error('❌ Jobs table does not exist!');
      process.exit(1);
    }

  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  try {
    console.log('='.repeat(60));
    console.log('Starting Database Migrations');
    console.log('='.repeat(60));

    // Step 1: Run SQL migrations
    await runSQLMigrations(process.env.DATABASE_URL);

    // Step 2: Run TypeORM migrations
    await runTypeORMMigrations();

    console.log('\n' + '='.repeat(60));
    console.log('✅ All migrations completed successfully!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n' + '='.repeat(60));
    console.error('❌ Migration failed:');
    console.error(error.message);
    console.error('='.repeat(60));
    process.exit(1);
  }
}

runMigrations();
