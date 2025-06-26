import { MongoClient } from 'mongodb';
import jwt from 'jsonwebtoken';

let cachedClient = null;

async function connectToDatabase() {
  if (cachedClient) {
    return cachedClient;
  }

  const client = new MongoClient(process.env.MONGODB_URI, {
    tls: true,
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 30000
  });

  await client.connect();
  cachedClient = client;
  return client;
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
    const client = await connectToDatabase();
    const { database = 'somnusuat', collection, action } = req.body;
    const db = client.db(database);

    switch (action) {
      case 'find':
        const { filter = {}, sort = {}, limit = 50, skip = 0, projection } = req.body;
        const findOptions = { sort, limit, skip };
        if (projection) findOptions.projection = projection;
        
        const documents = await db.collection(collection)
          .find(filter, findOptions)
          .toArray();
        res.json({ documents });
        break;

      case 'aggregate':
        const { pipeline } = req.body;
        const aggregateResult = await db.collection(collection)
          .aggregate(pipeline)
          .toArray();
        res.json({ documents: aggregateResult });
        break;

      case 'distinct':
        const { field } = req.body;
        const distinctResult = await db.collection(collection)
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