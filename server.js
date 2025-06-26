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

// Log the port being used
console.log('PORT environment variable:', process.env.PORT);
console.log('Using port:', PORT);

// Trust proxy for Railway/Vercel deployment - REQUIRED for Railway
// This fixes the X-Forwarded-For header error
app.set('trust proxy', 1);

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    platform: process.env.RAILWAY_ENVIRONMENT ? 'railway' : 'other',
    version: '2025-06-26-v4' // To verify deployment
  });
});

// Test OPTIONS endpoint
app.get('/test-options', (req, res) => {
  res.json({ message: 'OPTIONS test endpoint - if you see this, server is running latest code' });
});

// CORS preflight handler - use middleware approach only
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.sendStatus(200);
  } else {
    next();
  }
});

let cachedClient = null;

// Authentication middleware
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    console.log('Auth check - token present:', !!token);

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        console.log('JWT verification error:', err.message);
        return res.status(403).json({ error: 'Invalid or expired token' });
      }
      req.user = user;
      next();
    });
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// Login endpoint with rate limiting
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    console.log('Login attempt received');
    console.log('Request body:', req.body);
    
    const { password } = req.body;
    
    if (!password) {
      console.log('No password provided');
      return res.status(400).json({ error: 'Password required' });
    }

    console.log('Password provided, checking against admin password');
    console.log('Admin password set:', !!ADMIN_PASSWORD);

    if (password === ADMIN_PASSWORD) {
      console.log('Password correct, generating token');
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
      console.log('Password incorrect');
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

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI environment variable is not set!');
    throw new Error('MONGODB_URI is required');
  }

  console.log('Connecting to MongoDB...');
  const client = new MongoClient(mongoUri, {
    tls: true,
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 30000
  });

  await client.connect();
  console.log('✅ Connected to MongoDB successfully');
  cachedClient = client;
  return client;
}

// Handle OPTIONS for the exact route that's failing
app.options('/api/mongodb', (req, res) => {
  res.sendStatus(200);
});

app.options('/api/auth/login', (req, res) => {
  res.sendStatus(200);
});

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

// Start server with proper host binding for Railway
const HOST = '0.0.0.0'; // Required for Railway
const server = app.listen(PORT, HOST, () => {
  console.log(`API server running on http://${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  if (process.env.RAILWAY_ENVIRONMENT) {
    console.log('Running on Railway platform');
  }
  console.log('Environment variables status:');
  console.log(`- MONGODB_URI: ${process.env.MONGODB_URI ? '✅ Set' : '❌ Missing'}`);
  console.log(`- ADMIN_PASSWORD: ${process.env.ADMIN_PASSWORD ? '✅ Set' : '❌ Missing'}`);
  console.log(`- JWT_SECRET: ${process.env.JWT_SECRET ? '✅ Set' : '❌ Missing'}`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    if (cachedClient) {
      cachedClient.close();
      console.log('MongoDB connection closed');
    }
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    if (cachedClient) {
      cachedClient.close();
      console.log('MongoDB connection closed');
    }
    process.exit(0);
  });
});