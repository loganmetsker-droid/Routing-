// Script to update a customer with structured address for testing
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'routing-saas';

async function updateCustomer() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI environment variable not set');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(DB_NAME);
    const customers = db.collection('customers');

    // Update "Fat Dans Deli" with structured address
    const result = await customers.updateOne(
      { name: 'Fat Dans Deli' },
      {
        $set: {
          defaultAddressStructured: {
            line1: '5410 N College Ave',
            line2: null,
            city: 'Indianapolis',
            state: 'IN',
            zip: '46220'
          },
          updatedAt: new Date().toISOString()
        }
      }
    );

    if (result.matchedCount > 0) {
      console.log('✓ Successfully updated "Fat Dans Deli" with structured address');

      // Verify the update
      const customer = await customers.findOne({ name: 'Fat Dans Deli' });
      console.log('\nUpdated customer:', JSON.stringify(customer, null, 2));
    } else {
      console.log('✗ Customer "Fat Dans Deli" not found');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nConnection closed');
  }
}

updateCustomer();
