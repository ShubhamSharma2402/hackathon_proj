// db/models/Inventory.js
// Tracks booked seats and rooms in MongoDB (Feature S2).
// When a reservation is confirmed, inventory is deducted here.
// Survives page refresh and backend restart.

const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  reservationNumber: { type: String, required: true },
  
  // Array of flight deductions: [{ flightId, seats }]
  flights: [{
    flightId: String,
    seats: Number,
  }],

  // Array of room deductions: [{ roomId, date, rooms }]
  rooms: [{
    roomId: String,
    date: String,
    rooms: Number,
  }],

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Inventory', InventorySchema);
