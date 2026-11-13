// db/models/Reservation.js
// Immutable snapshot saved when the user clicks "Confirm".
// Never modified after creation — the source of truth for a booking.
// Looking up a 10-digit reservation number always returns this document.

const mongoose = require('mongoose');

const ReservationSchema = new mongoose.Schema({

  reservationNumber: { type: String, required: true, unique: true }, // 10-digit string

  packageId: { type: String, required: true }, // links back to the Package document

  // Full package snapshot at the time of confirm.
  // Stored here so it is correct even if the Package document is later changed.
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true },

}, { timestamps: true });

module.exports = mongoose.model('Reservation', ReservationSchema);
