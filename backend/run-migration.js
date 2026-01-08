// Run database migration for Phase 3
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    // Railway Postgres doesn't require SSL
    ssl: false,
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected ✅');

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add-job-workflow-fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('\nRunning migration...');
    console.log('Adding columns to jobs table...');

    // Execute migration
    await client.query(migrationSQL);

    console.log('Migration completed successfully ✅');

    // Verify columns exist
    console.log('\nVerifying migration...');
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name='jobs'
      AND column_name IN ('start_date', 'end_date', 'billing_status', 'customer_id', 'archived_at');
    `);

    console.log('New columns found:', result.rows.length);
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

    // Check if customers table exists
    const customersCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'customers'
      );
    `);

    if (customersCheck.rows[0].exists) {
      console.log('✅ Customers table created');
    } else {
      console.log('❌ Customers table not found');
    }

    console.log('\n✅ Phase 3 database migration complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
