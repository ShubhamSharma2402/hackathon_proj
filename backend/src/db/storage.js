// src/db/storage.js
// MongoDB persistence layer for Packages and Reservations.
// Auto-creates collections and saves all package details and customer choices.
// Ensures that data ALWAYS survives server restarts and page refreshes.

const fs = require('fs');
const path = require('path');
const { isMongoConnected } = require('./connection');
const PackageModel = require('./models/Package');
const ReservationModel = require('./models/Reservation');

const STORE_FILE = path.join(__dirname, '../../data/store.json');

// In-memory cache synced with disk as fallback
let localStore = {
  packages: {},
  reservations: {},
};

if (fs.existsSync(STORE_FILE)) {
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    localStore = {
      packages: parsed.packages || {},
      reservations: parsed.reservations || {},
    };
  } catch (e) {
    console.error('Failed to parse store.json:', e);
  }
}

function persistLocalStore() {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(localStore, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save to store.json:', err);
  }
}

// --- Package Methods ---

async function savePackage(pkg) {
  const pkgData = JSON.parse(JSON.stringify(pkg));
  localStore.packages[pkg.packageId] = pkgData;
  persistLocalStore();

  if (isMongoConnected()) {
    try {
      await PackageModel.findOneAndUpdate(
        { packageId: pkg.packageId },
        pkgData,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      console.warn('MongoDB package save error:', err.message);
    }
  }

  return pkgData;
}

async function getPackage(packageId) {
  if (isMongoConnected()) {
    try {
      const doc = await PackageModel.findOne({ packageId }).lean();
      if (doc) return doc;
    } catch (err) {
      console.warn('MongoDB package lookup error:', err.message);
    }
  }
  return localStore.packages[packageId] || null;
}

// --- Reservation Methods ---

async function saveReservation(reservationNumber, packageId, snapshot) {
  const resData = {
    reservationNumber,
    packageId,
    snapshot: JSON.parse(JSON.stringify(snapshot)),
    createdAt: new Date().toISOString(),
  };

  localStore.reservations[reservationNumber] = resData;
  persistLocalStore();

  if (isMongoConnected()) {
    try {
      await ReservationModel.findOneAndUpdate(
        { reservationNumber },
        resData,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      console.warn('MongoDB reservation save error:', err.message);
    }
  }

  return resData;
}

async function getReservation(reservationNumber) {
  if (isMongoConnected()) {
    try {
      const doc = await ReservationModel.findOne({ reservationNumber }).lean();
      if (doc) return doc;
    } catch (err) {
      console.warn('MongoDB reservation lookup error:', err.message);
    }
  }
  return localStore.reservations[reservationNumber] || null;
}

module.exports = {
  savePackage,
  getPackage,
  saveReservation,
  getReservation,
};
