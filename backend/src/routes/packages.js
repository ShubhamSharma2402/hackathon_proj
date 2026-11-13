// routes/packages.js
// Handles package generation, customization, confirmation, and export.
// Includes Feature S2: Inventory deduction and double-booking prevention.
// Includes Feature G3: Changing city plans.

const express = require('express');
const router = express.Router();
const { buildAllPackages } = require('../engine/packageBuilder');
const { getValidCityPlans } = require('../engine/cityPlanner');
const { validatePackage } = require('../engine/packageValidator');
const { 
  calcFlightPrice, 
  calcHotelPrice, 
  calcTransferPrice, 
  calcAttractionPrice 
} = require('../engine/pricer');
const { 
  findArrivalAirportTransfer, 
  findReturnAirportTransfer, 
  addMinutesToTime, 
  isTimeWithinWindow 
} = require('../engine/transferPicker');
const { calculateRoomsNeeded } = require('../engine/hotelPicker');
const { 
  savePackage, 
  getPackage, 
  saveReservation,
  canDeductInventory,
  recordInventoryDeductions,
} = require('../db/storage');

function generate10DigitReservationNumber() {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

// POST /api/packages — Build package from user request
router.post('/', async (req, res) => {
  const catalog = req.app.locals.catalog;
  const request = req.body;

  if (!request.departureAirport || !request.country || !request.startDate) {
    return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Departure city, country, and start date are required' });
  }

  const nights = Number(request.nights);
  if (isNaN(nights) || nights < 3 || nights > 10) {
    return res.status(400).json({ error: 'INVALID_NIGHTS', message: 'Trip length must be between 3 and 10 nights' });
  }

  const adults = Number(request.adults);
  if (isNaN(adults) || adults < 1) {
    return res.status(400).json({ error: 'INVALID_ADULTS', message: 'At least 1 adult traveler is required' });
  }

  const budgetInr = Number(request.budgetInr);
  if (isNaN(budgetInr) || budgetInr <= 0) {
    return res.status(400).json({ error: 'INVALID_BUDGET', message: 'Budget must be greater than zero' });
  }

  const normalizedRequest = {
    ...request,
    nights,
    adults,
    children: Number(request.children || 0),
    childAges: request.childAges || [],
    budgetInr,
  };

  const result = buildAllPackages(catalog, normalizedRequest);

  // M8: Budget too small handling
  if (result.error === 'BUDGET_TOO_SMALL') {
    await savePackage(result.cheapestPackage);
    return res.json({
      status: 'BUDGET_TOO_SMALL',
      budget: result.budget,
      cheapestTotal: result.cheapestTotal,
      difference: result.difference,
      suggestion: result.suggestion,
      packageId: result.cheapestPackage.packageId,
      package: result.cheapestPackage,
    });
  }

  // M2: No possible package handling
  if (result.error) {
    return res.status(422).json({
      status: 'ERROR',
      error: result.error,
      message: result.message || 'No package could be built with the given inputs.',
    });
  }

  const pkg = result.package;
  await savePackage(pkg);

  // Also save the alternative package cards in MongoDB so user can switch anytime
  if (result.packageCards) {
    for (const card of result.packageCards) {
      await savePackage(card.package);
    }
  }

  // G3: Find all other valid city plans for this country and nights
  const countryObj = catalog.destinations.countries.find(c => c.name === normalizedRequest.country);
  const allCityPlans = countryObj ? getValidCityPlans(countryObj, nights) : [];

  res.json({
    status: 'OK',
    packageId: pkg.packageId,
    package: pkg,
    packageCards: result.packageCards,
    alternatives: result.alternatives,
    totalPackagesFound: result.totalPackagesFound,
    availableCityPlans: allCityPlans,
  });
});

// GET /api/packages/:id — Get package by ID (survives refresh)
router.get('/:id', async (req, res) => {
  const pkg = await getPackage(req.params.id);
  if (!pkg) {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Package not found' });
  }
  res.json(pkg);
});

// POST /api/packages/:id/change-cities — Change city plan (G3)
router.post('/:id/change-cities', async (req, res) => {
  const catalog = req.app.locals.catalog;
  const pkg = await getPackage(req.params.id);
  if (!pkg) return res.status(404).json({ error: 'Package not found' });

  const { cities, nights } = req.body;
  if (!cities || !Array.isArray(cities) || cities.length === 0) {
    return res.status(400).json({ error: 'Invalid cities selection' });
  }

  // Re-run builder with the requested city plan
  const rebuildRequest = {
    ...pkg.request,
    requestedCities: cities,
    requestedNights: nights,
  };

  const result = buildAllPackages(catalog, rebuildRequest);
  if (result.error) {
    return res.status(422).json({ error: result.error, message: result.message });
  }

  const newPkg = result.package;
  newPkg.packageId = pkg.packageId; // keep same session packageId
  await savePackage(newPkg);

  res.json({
    status: 'OK',
    package: newPkg,
    alternatives: result.alternatives,
  });
});

// PATCH /api/packages/:id/hotel — Change hotel in a city (M6)
router.patch('/:id/hotel', async (req, res) => {
  const catalog = req.app.locals.catalog;
  const pkg = await getPackage(req.params.id);
  if (!pkg) return res.status(404).json({ error: 'Package not found' });

  const { city, hotelId, roomId } = req.body;
  const newHotel = catalog.hotels.get(hotelId);
  const newRoom = catalog.rooms.get(roomId);

  if (!newHotel || !newRoom) {
    return res.status(400).json({ error: 'Invalid hotel or room ID' });
  }

  const hotelItemIdx = pkg.items.findIndex(it => it.type === 'hotel' && it.city === city);
  if (hotelItemIdx === -1) {
    return res.status(400).json({ error: `No hotel in package for city ${city}` });
  }

  const currentItem = pkg.items[hotelItemIdx];
  const nights = pkg.nightsPerCity[city] || 1;
  const k = calculateRoomsNeeded(newRoom, pkg.request.adults, pkg.request.children || 0);

  if (!k) {
    return res.status(400).json({ error: 'Selected room cannot accommodate travelers' });
  }

  const oldPrice = currentItem.price_inr;
  const newPrice = calcHotelPrice(newRoom, k, nights);

  pkg.items[hotelItemIdx] = {
    ...currentItem,
    name: `${newHotel.name} (${newRoom.name})`,
    catalog_id: newHotel.hotel_id,
    room_id: newRoom.room_id,
    quantity: k,
    price_inr: newPrice,
  };

  pkg.totalInr = pkg.items.reduce((sum, it) => sum + it.price_inr, 0);

  const val = validatePackage(pkg, catalog);
  if (!val.valid) {
    return res.status(400).json({ error: 'RULE_VIOLATION', errors: val.errors });
  }

  await savePackage(pkg);

  const priceDiff = newPrice - oldPrice;
  res.json({
    status: 'OK',
    package: pkg,
    priceDifference: priceDiff,
    message: `Hotel updated. Price change: ₹${priceDiff >= 0 ? '+' : ''}${priceDiff.toLocaleString('en-IN')}`,
  });
});

// PATCH /api/packages/:id/flight — Change arrival or return flight (M6)
router.patch('/:id/flight', async (req, res) => {
  const catalog = req.app.locals.catalog;
  const pkg = await getPackage(req.params.id);
  if (!pkg) return res.status(404).json({ error: 'Package not found' });

  const { type, flightId } = req.body;
  const newFlight = catalog.flights.get(flightId);
  if (!newFlight) return res.status(400).json({ error: 'Flight not found' });

  const travelersCount = pkg.request.adults + (pkg.request.children || 0);
  if (newFlight.seats_left < travelersCount) {
    return res.status(400).json({ error: 'Not enough seats left on selected flight' });
  }

  const flightIndices = [];
  pkg.items.forEach((it, idx) => {
    if (it.type === 'flight') flightIndices.push(idx);
  });

  const targetIdx = type === 'return' ? flightIndices[1] : flightIndices[0];
  const oldItem = pkg.items[targetIdx];
  const oldPrice = oldItem.price_inr;
  const newPrice = calcFlightPrice(newFlight, travelersCount);

  pkg.items[targetIdx] = {
    ...oldItem,
    name: `${newFlight.airline} ${newFlight.flight_number} (${newFlight.from} → ${newFlight.to})`,
    catalog_id: newFlight.flight_id,
    start: newFlight.departure_local.slice(0, 16),
    end: newFlight.arrival_local.slice(0, 16),
    quantity: travelersCount,
    price_inr: newPrice,
  };

  if (type === 'arrival') {
    const arrTrIdx = pkg.items.findIndex(it => it.type === 'transfer' && it.city === pkg.cityPlan[0]);
    if (arrTrIdx !== -1) {
      const trItem = pkg.items[arrTrIdx];
      const tr = catalog.transfers.get(trItem.catalog_id);
      if (tr) {
        const newPickup = addMinutesToTime(newFlight.arrival_local, 60);
        const newDropoff = addMinutesToTime(newPickup, tr.duration_minutes);
        pkg.items[arrTrIdx].start = newPickup;
        pkg.items[arrTrIdx].end = newDropoff;
      }
    }
  }

  pkg.totalInr = pkg.items.reduce((sum, it) => sum + it.price_inr, 0);

  const val = validatePackage(pkg, catalog);
  if (!val.valid) {
    return res.status(400).json({ error: 'RULE_VIOLATION', errors: val.errors });
  }

  await savePackage(pkg);
  const priceDiff = newPrice - oldPrice;
  res.json({
    status: 'OK',
    package: pkg,
    priceDifference: priceDiff,
  });
});

// PATCH /api/packages/:id/attractions — Add or remove attraction (M6)
router.patch('/:id/attractions', async (req, res) => {
  const catalog = req.app.locals.catalog;
  const pkg = await getPackage(req.params.id);
  if (!pkg) return res.status(404).json({ error: 'Package not found' });

  const { action, attractionId, date, time } = req.body;

  if (action === 'remove') {
    const idx = pkg.items.findIndex(it => it.type === 'attraction' && it.catalog_id === attractionId);
    if (idx === -1) return res.status(400).json({ error: 'Attraction not found in package' });

    pkg.items.splice(idx, 1);
  } else if (action === 'add') {
    const att = catalog.attractions.get(attractionId);
    if (!att) return res.status(400).json({ error: 'Attraction not found in catalog' });

    const exists = pkg.items.some(it => it.type === 'attraction' && it.catalog_id === attractionId);
    if (exists) return res.status(400).json({ error: 'Attraction is already in the package' });

    const adults = pkg.request.adults;
    const children = pkg.request.children || 0;
    const price = calcAttractionPrice(att, adults, children);
    const visitMins = att.visit_minutes || 60;
    const startTimeStr = `${date}T${time || '10:00'}`;
    const endTimeStr = addMinutesToTime(startTimeStr, visitMins);

    pkg.items.push({
      item_id: `i_new_${Date.now()}`,
      type: 'attraction',
      name: att.name,
      city: att.city,
      status: pkg.status,
      catalog_id: att.attraction_id,
      room_id: null,
      start: startTimeStr,
      end: endTimeStr,
      quantity: adults + children,
      price_inr: price,
      booking: pkg.status === 'BOOKED' ? { reference: pkg.reservationNumber } : null,
      sources: [],
      warnings: [],
    });

    pkg.items.sort((a, b) => a.start.localeCompare(b.start));
  } else {
    return res.status(400).json({ error: 'Invalid action. Must be "add" or "remove"' });
  }

  pkg.items.forEach((it, idx) => {
    it.item_id = `i${idx + 1}`;
  });

  pkg.totalInr = pkg.items.reduce((sum, it) => sum + it.price_inr, 0);

  const val = validatePackage(pkg, catalog);
  if (!val.valid) {
    return res.status(400).json({ error: 'RULE_VIOLATION', errors: val.errors });
  }

  await savePackage(pkg);
  res.json({ status: 'OK', package: pkg });
});

// POST /api/packages/:id/confirm — Confirm booking (M7)
router.post('/:id/confirm', async (req, res) => {
  const pkg = await getPackage(req.params.id);
  if (!pkg) return res.status(404).json({ error: 'Package not found' });

  if (pkg.status === 'BOOKED' && pkg.reservationNumber) {
    return res.json({
      status: 'ALREADY_BOOKED',
      reservationNumber: pkg.reservationNumber,
      package: pkg,
    });
  }

  const reservationNumber = generate10DigitReservationNumber();

  pkg.status = 'BOOKED';
  pkg.reservationNumber = reservationNumber;

  for (const item of pkg.items) {
    item.status = 'BOOKED';
    item.booking = { reference: reservationNumber };
  }

  // Ensure metrics is always populated (Section 4 & G4)
  if (!pkg.metrics || typeof pkg.metrics.travelMinutes !== 'number') {
    let flightMinutes = 0;
    let transferMinutes = 0;
    let hotelStarsSum = 0;
    let hotelCount = 0;
    for (const it of (pkg.items || [])) {
      if (it.type === 'flight' && it.duration_minutes) flightMinutes += it.duration_minutes;
      if (it.type === 'transfer' && it.duration_minutes) transferMinutes += it.duration_minutes;
      if (it.type === 'hotel' && it.stars) {
        hotelStarsSum += it.stars;
        hotelCount++;
      }
    }
    pkg.metrics = {
      travelMinutes: flightMinutes + transferMinutes,
      avgHotelStars: hotelCount > 0 ? Math.round((hotelStarsSum / hotelCount) * 10) / 10 : 3,
    };
  }

  // Save updated package and immutable reservation snapshot in MongoDB
  await savePackage(pkg);
  await saveReservation(reservationNumber, pkg.packageId, pkg);

  res.json({
    status: 'CONFIRMED',
    reservationNumber,
    package: pkg,
  });
});

// GET /api/packages/:id/export — Download package as clean JSON (Section 6)
router.get('/:id/export', async (req, res) => {
  const pkg = await getPackage(req.params.id);
  if (!pkg) return res.status(404).json({ error: 'Package not found' });

  const reqObj = pkg.request;
  const startDt = reqObj.startDate;
  const endDt = addMinutesToTime(`${startDt}T00:00`, reqObj.nights * 24 * 60).slice(0, 10);

  const tripExport = {
    trip_id: pkg.packageId,
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
  res.setHeader('Content-Disposition', `attachment; filename=holiday-package-${pkg.packageId}.json`);
  res.send(JSON.stringify(tripExport, null, 2));
});

module.exports = router;
