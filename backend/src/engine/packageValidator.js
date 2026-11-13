// src/engine/packageValidator.js
// Comprehensive validation of Section 4 rules.
// Re-runs on initial package build and whenever any change is made.

const { isTimeWithinWindow } = require('./transferPicker');
const { calculateRoomsNeeded } = require('./hotelPicker');

function validatePackage(pkg, catalog) {
  const errors = [];
  const req = pkg.request;
  const items = pkg.items || [];

  // --- 1. Dates and Cities ---
  if (req.nights < 2 || req.nights > 10) {
    errors.push(`Nights must be 2-10, got ${req.nights}`);
  }

  const startDate = req.startDate;
  if (startDate < '2027-04-01') {
    errors.push(`Start date must be on or after 2027-04-01, got ${startDate}`);
  }

  // Calculate return date = startDate + nights
  const startDt = new Date(startDate);
  const endDt = new Date(startDate);
  endDt.setDate(startDt.getDate() + req.nights);
  const expectedReturnDate = endDt.toISOString().slice(0, 10);

  if (expectedReturnDate > '2027-04-20') {
    errors.push(`Return date must be on or before 2027-04-20, got ${expectedReturnDate}`);
  }

  const countryObj = catalog.destinations.countries.find(c => c.name === req.country);
  if (!countryObj) {
    errors.push(`Invalid country ${req.country}`);
  }

  const countryCities = countryObj ? countryObj.cities.map(c => c.name) : [];
  const cityPlan = pkg.cityPlan || [];

  for (const city of cityPlan) {
    if (!countryCities.includes(city)) {
      errors.push(`City ${city} is not in country ${req.country}`);
    }
  }

  // City uniqueness check
  const seenCities = new Set();
  for (const city of cityPlan) {
    if (seenCities.has(city)) {
      errors.push(`City ${city} appears more than once in the plan`);
    }
    seenCities.add(city);
  }

  // Nights per city check (at least 2 nights in a row)
  let totalCityNights = 0;
  for (const [city, n] of Object.entries(pkg.nightsPerCity || {})) {
    if (n < 2) {
      errors.push(`City ${city} has ${n} nights, minimum is 2`);
    }
    totalCityNights += n;
  }
  if (totalCityNights !== req.nights) {
    errors.push(`Total city nights (${totalCityNights}) does not match requested nights (${req.nights})`);
  }

  // --- 2. Flights ---
  const flights = items.filter(it => it.type === 'flight');
  if (flights.length !== 2) {
    errors.push(`Package must have exactly 2 flights, found ${flights.length}`);
  } else {
    const [arrFlightItem, retFlightItem] = flights;
    const arrFlight = catalog.flights.get(arrFlightItem.catalog_id);
    const retFlight = catalog.flights.get(retFlightItem.catalog_id);

    const totalTravelers = req.adults + (req.children || 0);

    if (!arrFlight) {
      errors.push(`Arrival flight ${arrFlightItem.catalog_id} not found in catalog`);
    } else {
      if (arrFlight.from !== req.departureAirport) {
        errors.push(`Arrival flight from airport ${arrFlight.from} does not match departure airport ${req.departureAirport}`);
      }
      const arrAirport = catalog.airports.get(arrFlight.to);
      const firstCity = cityPlan[0];
      if (!arrAirport || !arrAirport.serves_cities || !arrAirport.serves_cities.includes(firstCity)) {
        errors.push(`Arrival airport ${arrFlight.to} does not serve first city ${firstCity}`);
      }
      if (!arrFlight.arrival_local.startsWith(startDate)) {
        errors.push(`Arrival flight must land on start date ${startDate}, landed on ${arrFlight.arrival_local}`);
      }
      if (arrFlight.seats_left < totalTravelers) {
        errors.push(`Arrival flight seats_left (${arrFlight.seats_left}) < travelers (${totalTravelers})`);
      }
    }

    if (!retFlight) {
      errors.push(`Return flight ${retFlightItem.catalog_id} not found in catalog`);
    } else {
      if (retFlight.to !== req.departureAirport) {
        errors.push(`Return flight to airport ${retFlight.to} does not match departure airport ${req.departureAirport}`);
      }
      const lastCity = cityPlan[cityPlan.length - 1];
      const retAirport = catalog.airports.get(retFlight.from);
      if (!retAirport || !retAirport.serves_cities || !retAirport.serves_cities.includes(lastCity)) {
        errors.push(`Return airport ${retFlight.from} does not serve last city ${lastCity}`);
      }
      if (!retFlight.departure_local.startsWith(expectedReturnDate)) {
        errors.push(`Return flight must depart on ${expectedReturnDate}, departs on ${retFlight.departure_local}`);
      }
      if (retFlight.seats_left < totalTravelers) {
        errors.push(`Return flight seats_left (${retFlight.seats_left}) < travelers (${totalTravelers})`);
      }
    }
  }

  // --- 3. Hotels ---
  const hotelItems = items.filter(it => it.type === 'hotel');
  if (hotelItems.length !== cityPlan.length) {
    errors.push(`Must have exactly 1 hotel booking per city, found ${hotelItems.length} for ${cityPlan.length} cities`);
  }

  for (const hItem of hotelItems) {
    const hotel = catalog.hotels.get(hItem.catalog_id);
    const room = catalog.rooms.get(hItem.room_id);

    if (!hotel) {
      errors.push(`Hotel ${hItem.catalog_id} not found`);
      continue;
    }
    if (!room) {
      errors.push(`Room ${hItem.room_id} not found`);
      continue;
    }

    const k = calculateRoomsNeeded(room, req.adults, req.children || 0);
    if (!k || hItem.quantity < k) {
      errors.push(`Hotel ${hotel.name} room capacity insufficient for ${req.adults} adults and ${req.children} children`);
    }
  }

  // --- 4. Attractions ---
  const attractionItems = items.filter(it => it.type === 'attraction');
  const seenAttractions = new Set();
  const attsByDate = {};

  // Find city change dates
  const cityChangeDates = new Set();
  items.filter(it => it.type === 'transfer' && it.start).forEach(tr => {
    // If it's an intercity transfer
    const catTr = catalog.transfers.get(tr.catalog_id);
    if (catTr && catTr.from_city && catTr.to_city) {
      cityChangeDates.add(tr.start.slice(0, 10));
    }
  });

  for (const attItem of attractionItems) {
    if (seenAttractions.has(attItem.catalog_id)) {
      errors.push(`Attraction ${attItem.name} (${attItem.catalog_id}) included more than once`);
    }
    seenAttractions.add(attItem.catalog_id);

    const attDate = attItem.start ? attItem.start.slice(0, 10) : '';
    if (!attsByDate[attDate]) attsByDate[attDate] = [];
    attsByDate[attDate].push(attItem);

    // No attractions on last day
    if (attDate === expectedReturnDate) {
      errors.push(`No attractions allowed on the last day (${expectedReturnDate})`);
    }
  }

  // Check per-day attraction count and overlap
  for (const [date, atts] of Object.entries(attsByDate)) {
    if (atts.length > 2) {
      errors.push(`Day ${date} has ${atts.length} attractions; maximum allowed is 2`);
    }

    // Check overlap
    atts.sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 0; i < atts.length - 1; i++) {
      if (atts[i].end && atts[i + 1].start && atts[i].end > atts[i + 1].start) {
        errors.push(`Attractions overlap on ${date}: ${atts[i].name} ends at ${atts[i].end.slice(11, 16)} but ${atts[i + 1].name} starts at ${atts[i + 1].start.slice(11, 16)}`);
      }
    }
  }

  // Check full days have at least 1 attraction
  let cur = new Date(startDate);
  const end = new Date(expectedReturnDate);
  // Advance to Day 2
  cur.setDate(cur.getDate() + 1);
  while (cur < end) {
    const curStr = cur.toISOString().slice(0, 10);
    if (!cityChangeDates.has(curStr)) {
      // It is a full day
      const count = (attsByDate[curStr] || []).length;
      if (count < 1) {
        errors.push(`Full day ${curStr} must have between 1 and 2 attractions, found 0`);
      }
    }
    cur.setDate(cur.getDate() + 1);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  validatePackage,
};
