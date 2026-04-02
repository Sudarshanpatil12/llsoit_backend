const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('passport');
const path = require('path');

require('dotenv').config();
require('./config/passport');

const authRoutes = require('./routes/auth');
const alumniRoutes = require('./routes/alumni');
const adminRoutes = require('./routes/admin');
const eventsRoutes = require('./routes/events');
const { ensureDefaultAdmin } = require('./utils/seedAdmin');
const { ensureSampleAlumni } = require('./utils/seedSampleAlumni');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

let dbConnectPromise = null;
let startupSeedPromise = null;

const getFrontendOrigin = () => process.env.FRONTEND_URL || 'http://localhost:3000';
const getAllowedOrigins = () => {
  const configuredOrigins = String(process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set([
    ...configuredOrigins,
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ]);
};

const isAllowedOrigin = (origin) => {
  if (!origin) {
    return true;
  }

  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.has(origin)) {
    return true;
  }

  try {
    const { hostname } = new URL(origin);
    return hostname.endsWith('.vercel.app') || hostname.endsWith('.netlify.app');
  } catch (error) {
    return false;
  }
};

const runStartupSeeds = async () => {
  if (!startupSeedPromise) {
    startupSeedPromise = (async () => {
      await ensureDefaultAdmin();
      try {
        await ensureSampleAlumni();
      } catch (error) {
        console.error('Sample alumni sync failed:', error.message);
      }
    })().catch((error) => {
      startupSeedPromise = null;
      throw error;
    });
  }

  return startupSeedPromise;
};

const connectToDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!dbConnectPromise) {
    dbConnectPromise = mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/rgpv_alumni'
    )
      .then(async (connection) => {
        console.log('Connected to MongoDB');
        await runStartupSeeds();
        return connection;
      })
      .catch((error) => {
        dbConnectPromise = null;
        throw error;
      });
  }

  return dbConnectPromise;
};

const corsOptions = {
  origin(origin, callback) {
    if (process.env.NODE_ENV !== 'production') {
      callback(null, true);
      return;
    }

    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin || 'unknown'}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(passport.initialize());

app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (error) {
    console.error('MongoDB connection error:', error);
    res.status(503).json({
      success: false,
      message: 'Database connection failed'
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/alumni', alumniRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/events', eventsRoutes);

app.get('/api/health', async (req, res) => {
  try {
    await connectToDatabase();
    res.json({
      status: 'OK',
      message: 'RGPV Alumni API is running',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      message: 'Database connection failed',
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/', (req, res) => {
  res.send('<h2>RGPV Alumni API</h2><p>Server is running. Use <a href="/api/health">/api/health</a> for a JSON status.</p>');
});

app.use(errorHandler);

if (process.env.NODE_ENV === 'production' && process.env.SERVE_FRONTEND === 'true') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  connectToDatabase()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Frontend URL: ${getFrontendOrigin()}`);
        console.log(`API URL: http://localhost:${PORT}/api`);
      });
    })
    .catch((error) => {
      console.error('MongoDB startup error:', error);
      process.exit(1);
    });
}

module.exports = app;
