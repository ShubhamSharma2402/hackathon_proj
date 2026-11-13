// routes/reservations.js
// Handles looking up a confirmed booking by its 10-digit reservation number.
// Survives page refresh and backend restart because it retrieves from MongoDB (or persisted storage).

const express = require('express');
const router  = express.Router();
const { getReservation } = require('../db/storage');

// GET /api/reservations/:number
// Returns the full package snapshot for a reservation number.
// A wrong number shows "not found" (Section 5, M7).
router.get('/:number', async (req, res) => {
  const reservation = await getReservation(req.params.number);
  if (!reservation) {
    return res.status(404).json({
      error: 'not found',
      message: 'Reservation not found. Please verify your 10-digit reservation number.',
    });
  }

  res.json({
    status: 'FOUND',
    reservationNumber: reservation.reservationNumber,
    createdAt: reservation.createdAt,
    package: reservation.snapshot,
  });
});

module.exports = router;
