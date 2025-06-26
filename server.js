import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Secure authentication configuration from environment variables
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET;

// Security checks
if (!ADMIN_PASSWORD || !JWT_SECRET) {
  console.error('❌ SECURITY ERROR: ADMIN_PASSWORD and JWT_SECRET must be set in .env file');
  process.exit(1);
}

// Rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per windowMs
  message: {
    error: 'Too many login attempts. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
});

// CORS configuration to allow Vercel frontend
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://chat-viewer-drab.vercel.app',
    'https://chat-viewer.vercel.app',
    /\.vercel\.app$/  // Allow any Vercel subdomain
  ],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(generalLimiter);

let cachedClient = null;

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Login endpoint with rate limiting
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    if (password === ADMIN_PASSWORD) {
      // Generate JWT token
      const token = jwt.sign(
        { userId: 'admin', role: 'admin' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      res.json({ 
        success: true, 
        token,
        message: 'Authentication successful' 
      });
    } else {
      res.status(401).json({ 
        success: false, 
        error: 'Invalid password' 
      });
    }
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

app.post('/api/mongodb', authenticateToken, async (req, res) => {
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
});

app.listen(PORT, () => {
  console.log(`Development API server running on http://localhost:${PORT}`);
});