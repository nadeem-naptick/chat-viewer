import { MongoClient } from 'mongodb';

// This will work as a Vercel serverless function
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

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const client = await connectToDatabase();
    const { database = 'somnusuat', collection, action } = req.body;
    const db = client.db(database);

    switch (action) {
      case 'find':
        const { filter = {}, sort = {}, limit = 50, skip = 0 } = req.body;
        const documents = await db.collection(collection)
          .find(filter)
          .sort(sort)
          .limit(limit)
          .skip(skip)
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