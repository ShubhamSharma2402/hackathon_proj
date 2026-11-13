// routes/reservations.js
// Handles looking up a confirmed booking by its 10-digit reservation number.
// Survives page refresh and backend restart because it retrieves from MongoDB (or persisted storage).

const express = require('express');
const router  = express.Router();
const { getReservation } = require('../db/storage');
const { addMinutesToTime } = require('../engine/transferPicker');

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

// GET /api/reservations/:number/export — Download reservation snapshot as JSON
router.get('/:number/export', async (req, res) => {
  const reservation = await getReservation(req.params.number);
  if (!reservation) {
    return res.status(404).json({ error: 'Reservation not found' });
  }

  const pkg = reservation.snapshot;
  const reqObj = pkg.request;
  const startDt = reqObj.startDate;
  const endDt = addMinutesToTime(`${startDt}T00:00`, reqObj.nights * 24 * 60).slice(0, 10);

  const tripExport = {
    trip_id: pkg.packageId,
    reservation_number: reservation.reservationNumber,
    status: 'BOOKED',
    traveler: {
      name: `${reqObj.departureCity || 'Primary'} Traveler`,
      home_airport: reqObj.departureAirport,
      adults: reqObj.adults,
      children: reqObj.children || 0,
      child_ages: reqObj.childAges || [],
    },
    start_date: startDt,
    end_date: endDt,
    country: reqObj.country,
    budget_inr: reqObj.budgetInr,
    total_inr: pkg.totalInr,
    items: pkg.items.map(it => ({
      item_id: it.item_id,
      type: it.type,
      name: it.name,
      city: it.city,
      status: it.status,
      catalog_id: it.catalog_id,
      room_id: it.room_id || null,
      start: it.start,
      end: it.end || null,
      quantity: it.quantity,
      price_inr: it.price_inr,
      booking: it.booking || null,
      sources: [],
      warnings: it.warnings || [],
    })),
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=reservation-${reservation.reservationNumber}.json`);
  res.send(JSON.stringify(tripExport, null, 2));
});

module.exports = router;
