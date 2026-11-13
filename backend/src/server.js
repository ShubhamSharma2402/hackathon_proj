// server.js — entry point
// Express API for Build My Holiday
// Connects to MongoDB, loads catalog, registers routes

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB } = require('./db/connection');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// Serve static frontend files from public/ if present
app.use(express.static(path.join(__dirname, '../public')));

async function startServer() {
  // Connect to MongoDB
  await connectDB();

  // Load all catalog JSON files into memory once at startup
  const catalog = require('./catalog/loader');
  app.locals.catalog = catalog;

  // --- API Routes ---
  app.use('/api/catalog',       require('./routes/catalog'));
  app.use('/api/packages',      require('./routes/packages'));
  app.use('/api/reservations',  require('./routes/reservations'));

  // Health check
  app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

  // Fallback for SPA routing if serving public/
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    const indexPath = path.join(__dirname, '../public/index.html');
    res.sendFile(indexPath, err => {
      if (err) res.status(404).json({ error: 'Not found' });
    });
  });

  app.listen(PORT, () => {
    console.log(`🚀 Build My Holiday backend running on http://localhost:${PORT}`);
  });
}

startServer();
