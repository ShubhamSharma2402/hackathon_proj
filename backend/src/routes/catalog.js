// routes/catalog.js
// Read-only endpoints that feed the frontend form dropdowns.
// All data comes from the in-memory catalog loaded at startup.

const express = require('express');
const router  = express.Router();

// GET /api/catalog/form-data
// Returns departure cities and destination countries for the request form.
router.get('/form-data', (req, res) => {
  const { destinations } = req.app.locals.catalog;

  res.json({
    departureCities: destinations.departure_cities,   // [{airport, city}, ...]
    countries:       destinations.countries.map(c => ({
      code: c.code,
      name: c.name,
    })),
    rules: destinations.rules,                        // min/max nights, date window
  });
});

// GET /api/catalog/flights?from=BLR&to=NRT&date=2027-04-10&type=arrival
// Returns available flights for a route on a date (used in Change Flight panel)
// type=arrival → match by arrival date; type=return → match by departure date
router.get('/flights', (req, res) => {
  const { from, to, date, type } = req.query;
  const { flightsByRoute } = req.app.locals.catalog;

  if (!from || !to || !date) {
    return res.status(400).json({ error: 'from, to, and date are required' });
  }

  const key = type === 'return'
    ? `${from}|${to}|dep:${date}`
    : `${from}|${to}|arr:${date}`;

  const results = flightsByRoute.get(key) || [];
  res.json(results);
});

// GET /api/catalog/hotels?city=Tokyo&checkIn=2027-04-10&checkOut=2027-04-12&adults=2&children=1
// Returns hotels in a city that have rooms available for the given dates and travelers
// (used in Change Hotel panel — shows alternatives with availability)
router.get('/hotels', (req, res) => {
  const { city, checkIn, checkOut, adults, children } = req.query;
  const { hotelsByCity, roomsByHotel, availability } = req.app.locals.catalog;

  if (!city || !checkIn || !checkOut) {
    return res.status(400).json({ error: 'city, checkIn, and checkOut are required' });
  }

  const numAdults   = parseInt(adults)   || 1;
  const numChildren = parseInt(children) || 0;
  const totalTravelers = numAdults + numChildren;

  // Build the list of nights: checkIn to checkOut (exclusive)
  const nights = getDatesInRange(checkIn, checkOut);

  const availableHotels = [];

  for (const hotel of (hotelsByCity.get(city) || [])) {
    const hotelRooms = roomsByHotel.get(hotel.hotel_id) || [];

    // Find the first room type that fits and is available on all nights
    for (const room of hotelRooms) {
      const k = roomsNeeded(room, numAdults, numChildren);
      if (k === null) continue; // room can't fit these travelers

      const allAvailable = nights.every(date => {
        const key = `${room.room_id}|${date}`;
        const left = availability.get(key) ?? 0;
        return left >= k;
      });

      if (allAvailable) {
        availableHotels.push({
          hotel,
          room,
          roomsNeeded: k,
          totalNights: nights.length,
          pricePerNight: room.price_per_night.amount,
          totalPrice: room.price_per_night.amount * k * nights.length,
        });
        break; // found a valid room for this hotel — move to next hotel
      }
    }
  }

  res.json(availableHotels);
});

// GET /api/catalog/attractions?city=Tokyo&date=2027-04-10
// Returns attractions in a city that are open on a given date
router.get('/attractions', (req, res) => {
  const { city, date } = req.query;
  const { attractionsByCity } = req.app.locals.catalog;

  if (!city || !date) {
    return res.status(400).json({ error: 'city and date are required' });
  }

  const dayOfWeek = getDayOfWeek(date); // "MON", "TUE", etc.

  const open = (attractionsByCity.get(city) || []).filter(att => {
    const isOpenDay    = att.open_days.includes(dayOfWeek);
    const isClosedDate = (att.closed_dates || []).includes(date);
    return isOpenDay && !isClosedDate;
  });

  res.json(open);
});

// --- Helpers ---

// Returns array of "YYYY-MM-DD" strings from startDate up to (not including) endDate
function getDatesInRange(startDate, endDate) {
  const dates = [];
  let current = new Date(startDate);
  const end   = new Date(endDate);
  while (current < end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// Returns 3-letter weekday string: "MON", "TUE", etc.
function getDayOfWeek(dateStr) {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return days[new Date(dateStr).getDay()];
}

// Returns how many rooms of this type are needed for the travelers.
// Returns null if the room type cannot fit the travelers at all.
// Rule from spec: adults ≤ k × max_adults  AND  adults+children ≤ k × (max_adults+max_children)  AND  adults ≥ k
function roomsNeeded(room, adults, children) {
  const maxA  = room.max_adults;
  const maxC  = room.max_children;
  const total = adults + children;

  for (let k = 1; k <= 10; k++) {
    const fitsAdults   = adults  <= k * maxA;
    const fitsTotal    = total   <= k * (maxA + maxC);
    const adultsGteK   = adults  >= k;
    if (fitsAdults && fitsTotal && adultsGteK) return k;
  }
  return null; // no valid k found
}

// GET /api/catalog/items-meta
// Returns image and metadata lookups for all hotels, attractions, flights, transfers, and rooms
router.get('/items-meta', (req, res) => {
  const { hotels, attractions, rooms, flights, transfers } = req.app.locals.catalog;
  const items = {};
  const roomsMap = {};

  if (hotels) {
    for (const [id, h] of hotels.entries()) {
      items[id] = {
        id,
        type: 'hotel',
        name: h.name,
        image: h.image || null,
        stars: h.stars || 3,
        rating: h.rating || 4.0,
        area: h.area || '',
        city: h.city || '',
        check_in_from: h.check_in_from || '15:00',
        check_out_until: h.check_out_until || '11:00',
        family_friendly: h.family_friendly ?? true,
      };
    }
  }

  if (attractions) {
    for (const [id, a] of attractions.entries()) {
      items[id] = {
        id,
        type: 'attraction',
        name: a.name,
        name_ja: a.name_ja || '',
        image: a.image || null,
        category: a.category || 'Sightseeing',
        city: a.city || '',
        visit_minutes: a.visit_minutes || 60,
        open_from: a.open_from || '09:00',
        open_until: a.open_until || '18:00',
        child_friendly: a.child_friendly ?? true,
        accessible: a.accessible ?? true,
        price_per_person: a.price_per_person,
        child_price: a.child_price,
      };
    }
  }

  if (flights) {
    for (const [id, f] of flights.entries()) {
      items[id] = {
        id,
        type: 'flight',
        name: `${f.airline} ${f.flight_number}`,
        image: f.image || null,
        airline: f.airline,
        flight_number: f.flight_number,
        cabin: f.cabin,
        duration_minutes: f.duration_minutes,
        stops: f.stops,
      };
    }
  }

  if (transfers) {
    for (const [id, t] of transfers.entries()) {
      items[id] = {
        id,
        type: 'transfer',
        name: t.name,
        image: t.image || null,
        type_name: t.type,
        service_from: t.service_from,
        service_until: t.service_until,
        duration_minutes: t.duration_minutes,
      };
    }
  }

  if (rooms) {
    for (const [id, r] of rooms.entries()) {
      roomsMap[id] = {
        room_id: r.room_id,
        hotel_id: r.hotel_id,
        name: r.name,
        room_type: r.room_type,
        max_adults: r.max_adults,
        max_children: r.max_children,
        price_per_night: r.price_per_night,
      };
    }
  }

  res.json({ items, rooms: roomsMap });
});

module.exports = router;
