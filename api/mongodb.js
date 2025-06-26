import { MongoClient } from 'mongodb';
import jwt from 'jsonwebtoken';

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(process.env.MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  });

  await client.connect();
  const db = client.db(process.env.MONGODB_DATABASE_NAME || 'somnusuat');
  
  cachedClient = client;
  cachedDb = db;
  
  return { client, db };
}

// Authentication middleware
function authenticateToken(req) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return { error: 'Access token required', status: 401 };
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    return { user };
  } catch (err) {
    return { error: 'Invalid or expired token', status: 403 };
  }
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check authentication
  const authResult = authenticateToken(req);
  if (authResult.error) {
    return res.status(authResult.status).json({ error: authResult.error });
  }

  try {
    const { db } = await connectToDatabase();
    const { database = 'somnusuat', collection, action } = req.body;
    const targetDb = database === 'somnusuat' ? db : db.client.db(database);

    switch (action) {
      case 'find':
        const { filter = {}, sort = {}, limit = 50, skip = 0, projection } = req.body;
        const findOptions = { sort, limit, skip };
        if (projection) findOptions.projection = projection;
        
        const documents = await targetDb.collection(collection)
          .find(filter, findOptions)
          .toArray();
        res.json({ documents });
        break;

      case 'aggregate':
        const { pipeline } = req.body;
        const aggregateResult = await targetDb.collection(collection)
          .aggregate(pipeline)
          .toArray();
        res.json({ documents: aggregateResult });
        break;

      case 'distinct':
        const { field } = req.body;
        const distinctResult = await targetDb.collection(collection)
          .distinct(field, req.body.filter || {});
        res.json({ values: distinctResult });
        break;

      default:
        res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('MongoDB error:', error);
    res.status(500).json({ error: error.message });
  }
}