/**
 * Database module - MongoDB persistence layer
 * Replaces in-memory arrays with persistent storage
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/routing-saas';
const DB_NAME = 'routing-saas';

let client;
let db;

// Initialize database connection
async function connect() {
  if (db) return db;

  try {
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    await client.connect();
    db = client.db(DB_NAME);

    console.log('✅ Connected to MongoDB');

    // Create indexes
    await db.collection('jobs').createIndex({ id: 1 }, { unique: true });
    await db.collection('routes').createIndex({ id: 1 }, { unique: true });
    await db.collection('vehicles').createIndex({ id: 1 }, { unique: true });
    await db.collection('drivers').createIndex({ id: 1 }, { unique: true });

    // Initialize default vehicles and drivers if not exist
    await initializeDefaults();

    return db;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    // Fallback to in-memory if connection fails
    return null;
  }
}

// Initialize default data
async function initializeDefaults() {
  const vehicles = await db.collection('vehicles').countDocuments();
  if (vehicles === 0) {
    await db.collection('vehicles').insertMany([
      { id: 'v1', name: 'Truck 1', type: 'box_truck', capacity: 1000, status: 'available' },
      { id: 'v2', name: 'Van 1', type: 'cargo_van', capacity: 500, status: 'available' },
      { id: 'v3', name: 'Truck 2', type: 'box_truck', capacity: 1000, status: 'available' }
    ]);
    console.log('✅ Initialized default vehicles');
  }

  const drivers = await db.collection('drivers').countDocuments();
  if (drivers === 0) {
    await db.collection('drivers').insertMany([
      { id: 'd1', name: 'John Doe', status: 'available' },
      { id: 'd2', name: 'Jane Smith', status: 'available' },
      { id: 'd3', name: 'Bob Wilson', status: 'available' }
    ]);
    console.log('✅ Initialized default drivers');
  }
}

// Jobs operations
const jobs = {
  async getAll() {
    if (!db) return [];
    return await db.collection('jobs').find({}).toArray();
  },

  async create(job) {
    if (!db) return job;
    await db.collection('jobs').insertOne(job);
    return job;
  },

  async findById(id) {
    if (!db) return null;
    return await db.collection('jobs').findOne({ id });
  },

  async update(id, updates) {
    if (!db) return null;
    const result = await db.collection('jobs').findOneAndUpdate(
      { id },
      { $set: updates },
      { returnDocument: 'after' }
    );
    return result;
  },

  async updateMany(filter, updates) {
    if (!db) return;
    await db.collection('jobs').updateMany(filter, { $set: updates });
  }
};

// Routes operations
const routes = {
  async getAll() {
    if (!db) return [];
    return await db.collection('routes').find({}).toArray();
  },

  async create(route) {
    if (!db) return route;
    await db.collection('routes').insertOne(route);
    return route;
  },

  async findById(id) {
    if (!db) return null;
    return await db.collection('routes').findOne({ id });
  },

  async update(id, updates) {
    if (!db) return null;
    const result = await db.collection('routes').findOneAndUpdate(
      { id },
      { $set: updates },
      { returnDocument: 'after' }
    );
    return result;
  }
};

// Vehicles operations
const vehicles = {
  async getAll() {
    if (!db) return [
      { id: 'v1', name: 'Truck 1', type: 'box_truck', capacity: 1000, status: 'available' },
      { id: 'v2', name: 'Van 1', type: 'cargo_van', capacity: 500, status: 'available' },
      { id: 'v3', name: 'Truck 2', type: 'box_truck', capacity: 1000, status: 'available' }
    ];
    return await db.collection('vehicles').find({}).toArray();
  },

  async findById(id) {
    if (!db) return null;
    return await db.collection('vehicles').findOne({ id });
  },

  async update(id, updates) {
    if (!db) return null;
    const result = await db.collection('vehicles').findOneAndUpdate(
      { id },
      { $set: updates },
      { returnDocument: 'after' }
    );
    return result;
  }
};

// Drivers operations
const drivers = {
  async getAll() {
    if (!db) return [
      { id: 'd1', name: 'John Doe', status: 'available' },
      { id: 'd2', name: 'Jane Smith', status: 'available' },
      { id: 'd3', name: 'Bob Wilson', status: 'available' }
    ];
    return await db.collection('drivers').find({}).toArray();
  },

  async findById(id) {
    if (!db) return null;
    return await db.collection('drivers').findOne({ id });
  },

  async update(id, updates) {
    if (!db) return null;
    const result = await db.collection('drivers').findOneAndUpdate(
      { id },
      { $set: updates },
      { returnDocument: 'after' }
    );
    return result;
  }
};

// Graceful shutdown
async function disconnect() {
  if (client) {
    await client.close();
    console.log('✅ Disconnected from MongoDB');
  }
}

module.exports = {
  connect,
  disconnect,
  jobs,
  routes,
  vehicles,
  drivers
};
