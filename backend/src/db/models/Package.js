// db/models/Package.js
// Stores the user's holiday package — updated every time they make a change.
// Survives page refresh and backend restart because it lives in MongoDB.

const mongoose = require('mongoose');

const PackageSchema = new mongoose.Schema({

  packageId:    { type: String, required: true, unique: true }, // our own UUID (used by frontend)

  // What the user entered in the form
  request: {
    departureAirport: String,  // e.g. "BLR"
    departureCity:    String,  // e.g. "Bengaluru"
    country:          String,  // e.g. "Japan"
    startDate:        String,  // "YYYY-MM-DD" — arrival day in destination
    nights:           Number,
    adults:           Number,
    children:         Number,
    childAges:        [Number],
    budgetInr:        Number,
  },

  // The city plan the engine chose, e.g. ["Tokyo", "Kyoto"]
  cityPlan:     [String],

  // How many nights per city, e.g. { Tokyo: 2, Kyoto: 4 }
  nightsPerCity: { type: Map, of: Number },

  // All items in the trip: flights, hotels, transfers, attractions
  // Stored as plain objects — same shape as the JSON export format
  items: [mongoose.Schema.Types.Mixed],

  totalInr:   { type: Number, default: 0 },

  status: {
    type:    String,
    enum:    ['DRAFT', 'BOOKED'],
    default: 'DRAFT',
  },

  reservationNumber: { type: String, default: null }, // set after confirm

  metrics: { type: mongoose.Schema.Types.Mixed, default: {} },

}, { timestamps: true, strict: false }); // adds createdAt, updatedAt automatically & preserves all fields

module.exports = mongoose.model('Package', PackageSchema);
