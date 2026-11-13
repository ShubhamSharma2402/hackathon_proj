// routes/packages.js
// Handles package generation, customization, confirmation, and export.
// Includes Feature S2: Inventory deduction and double-booking prevention.
// Includes Feature G3: Changing city plans.

const express = require('express');
const router = express.Router();
const { buildAllPackages } = require('../engine/packageBuilder');
const { getValidCityPlans } = require('../engine/cityPlanner');
const { findArrivalFlights, findReturnFlights } = require('../engine/flightPicker');
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
  if (isNaN(nights) || nights < 2 || nights > 10) {
    return res.status(400).json({ error: 'INVALID_NIGHTS', message: 'Trip length must be between 2 and 10 nights' });
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

// Helper: Schedule breakdown of the trip days and cities
function getTripDaySchedule(pkg, catalog) {
  const req = pkg.request;
  const startDate = req.startDate;
  const totalNights = req.nights;
  const days = [];

  const cityPlan = pkg.cityPlan || [];
  const nightsPerCity = pkg.nightsPerCity || {};
  const cityByNight = [];
  for (const city of cityPlan) {
    const n = nightsPerCity[city] || 0;
    for (let i = 0; i < n; i++) {
      cityByNight.push(city);
    }
  }

  let cur = new Date(startDate);
  for (let d = 0; d <= totalNights; d++) {
    const dateStr = cur.toISOString().slice(0, 10);
    const dayNumber = d + 1;
    let dayType = 'full';
    let city = cityByNight[d] || cityPlan[cityPlan.length - 1];

    if (d === 0) {
      dayType = 'arrival';
      city = cityPlan[0];
    } else if (d === totalNights) {
      dayType = 'departure';
      city = cityPlan[cityPlan.length - 1];
    } else if (cityByNight[d] !== cityByNight[d - 1]) {
      dayType = 'city-change';
      city = cityByNight[d];
    }

    days.push({
      dayNumber,
      date: dateStr,
      dayType,
      city,
    });

    cur.setDate(cur.getDate() + 1);
  }

  return days;
}

function recalculateMetrics(pkg, catalog) {
  let flightMinutes = 0;
  let transferMinutes = 0;
  let hotelStarsSum = 0;
  let hotelNightsCount = 0;

  for (const it of (pkg.items || [])) {
    if (it.type === 'flight') {
      const f = catalog.flights.get(it.catalog_id);
      if (f && f.duration_minutes) flightMinutes += f.duration_minutes;
    }
    if (it.type === 'transfer') {
      const t = catalog.transfers.get(it.catalog_id);
      if (t && t.duration_minutes) transferMinutes += t.duration_minutes;
    }
    if (it.type === 'hotel') {
      const h = catalog.hotels.get(it.catalog_id);
      const n = (pkg.nightsPerCity && pkg.nightsPerCity[it.city]) || 1;
      if (h && h.stars) {
        hotelStarsSum += h.stars * n;
        hotelNightsCount += n;
      }
    }
  }

  pkg.metrics = {
    travelMinutes: flightMinutes + transferMinutes,
    avgHotelStars: hotelNightsCount > 0 ? Math.round((hotelStarsSum / hotelNightsCount) * 10) / 10 : 3,
  };
}

// GET /api/packages/:id/change-options — Returns available alternatives with price diffs & warnings (G1, G2, G3)
router.get('/:id/change-options', async (req, res) => {
  const catalog = req.app.locals.catalog;
  const pkg = await getPackage(req.params.id);
  if (!pkg) return res.status(404).json({ error: 'Package not found' });

  const reqObj = pkg.request;
  const travelersCount = reqObj.adults + (reqObj.children || 0);
  const adults = reqObj.adults;
  const children = reqObj.children || 0;
  const startDate = reqObj.startDate;
  const nights = reqObj.nights;
  const expectedReturnDate = addMinutesToTime(`${startDate}T00:00`, nights * 24 * 60).slice(0, 10);

  // 1. G3: Available City Plans
  const countryObj = catalog.destinations.countries.find(c => c.name === reqObj.country);
  const rawCityPlans = countryObj ? getValidCityPlans(countryObj, nights) : [];
  const availableCityPlans = rawCityPlans.map(plan => {
    const isCurrent = plan.cities.length === pkg.cityPlan.length &&
      plan.cities.every((c, i) => c === pkg.cityPlan[i]) &&
      plan.nights.every((n, i) => n === (pkg.nightsPerCity[plan.cities[i]] || 0));
    return {
      cities: plan.cities,
      nights: plan.nights,
      label: plan.cities.map((c, i) => `${c} (${plan.nights[i]}N)`).join(' → '),
      isCurrent,
    };
  });

  // Current items lookups
  const currentFlights = pkg.items.filter(it => it.type === 'flight');
  const currentArrFlightItem = currentFlights[0];
  const currentRetFlightItem = currentFlights[1];

  const arrTrItem = pkg.items.find(it => it.type === 'transfer' && it.start && it.start.startsWith(startDate));
  const retTrItem = pkg.items.slice().reverse().find(it => it.type === 'transfer');
  const arrTr = arrTrItem ? catalog.transfers.get(arrTrItem.catalog_id) : null;
  const retTr = retTrItem ? catalog.transfers.get(retTrItem.catalog_id) : null;

  // 2. Hotel Options per City (M6, G1, G2)
  const hotelOptions = [];
  for (const city of pkg.cityPlan) {
    const curHotelItem = pkg.items.find(it => it.type === 'hotel' && it.city === city);
    const cityNights = pkg.nightsPerCity[city] || 1;
    const isFirstCity = city === pkg.cityPlan[0];
    const isLastCity = city === pkg.cityPlan[pkg.cityPlan.length - 1];

    const candidates = [];
    const cityHotels = catalog.hotelsByCity.get(city) || [];

    for (const hotel of cityHotels) {
      const hotelRooms = catalog.roomsByHotel.get(hotel.hotel_id) || [];
      for (const room of hotelRooms) {
        const k = calculateRoomsNeeded(room, adults, children);
        if (!k) continue;

        // Check availability
        const stayStartDate = curHotelItem?.start?.slice(0, 10) || startDate;
        let curStay = new Date(stayStartDate);
        let allAvail = true;
        for (let n = 0; n < cityNights; n++) {
          const dtStr = curStay.toISOString().slice(0, 10);
          const left = catalog.availability.get(`${room.room_id}|${dtStr}`) ?? 0;
          if (left < k) {
            allAvail = false;
            break;
          }
          curStay.setDate(curStay.getDate() + 1);
        }
        if (!allAvail) continue;

        const candidatePrice = calcHotelPrice(room, k, cityNights);
        const priceDiff = candidatePrice - (curHotelItem ? curHotelItem.price_inr : 0);
        const isCurrent = curHotelItem && curHotelItem.catalog_id === hotel.hotel_id && curHotelItem.room_id === room.room_id;

        // Warnings (G1)
        const warnings = [];
        if (isFirstCity && arrTr && arrTr.area && hotel.area && arrTr.area.toLowerCase() !== hotel.area.toLowerCase()) {
          warnings.push(`⚠️ Area mismatch: Scheduled arrival airport transfer is for "${arrTr.area}" area, but "${hotel.name}" is located in "${hotel.area}".`);
        }
        if (isLastCity && retTr && retTr.area && hotel.area && retTr.area.toLowerCase() !== hotel.area.toLowerCase()) {
          warnings.push(`⚠️ Area mismatch: Scheduled departure airport transfer is for "${retTr.area}" area, but "${hotel.name}" is located in "${hotel.area}".`);
        }
        warnings.push(`Check-in: ${hotel.check_in_from || '15:00'} • Check-out: ${hotel.check_out_until || '11:00'}`);

        candidates.push({
          hotelId: hotel.hotel_id,
          hotelName: hotel.name,
          roomId: room.room_id,
          roomName: room.name,
          stars: hotel.stars || 3,
          rating: hotel.rating || 4.0,
          area: hotel.area || '',
          image: hotel.image || null,
          roomsNeeded: k,
          pricePerNight: room.price_per_night.amount,
          totalPrice: candidatePrice,
          priceDifference: priceDiff,
          isCurrent,
          warnings,
        });

        break;
      }
    }

    candidates.sort((a, b) => a.totalPrice - b.totalPrice);

    hotelOptions.push({
      city,
      nights: cityNights,
      currentHotel: curHotelItem ? {
        ...curHotelItem,
        stars: catalog.hotels.get(curHotelItem.catalog_id)?.stars || 3,
        area: catalog.hotels.get(curHotelItem.catalog_id)?.area || '',
      } : null,
      candidates,
    });
  }

  // 3. Flight Options (M6, G1, G2)
  const firstCity = pkg.cityPlan[0];
  const lastCity = pkg.cityPlan[pkg.cityPlan.length - 1];

  const rawArrFlights = findArrivalFlights(catalog, reqObj.departureAirport, firstCity, startDate, travelersCount);
  const arrivalCandidates = rawArrFlights.map(flight => {
    const flightPrice = calcFlightPrice(flight, travelersCount);
    const priceDiff = flightPrice - (currentArrFlightItem ? currentArrFlightItem.price_inr : 0);
    const isCurrent = currentArrFlightItem && currentArrFlightItem.catalog_id === flight.flight_id;

    const warnings = [];
    if (arrTr) {
      const pickupTime = addMinutesToTime(flight.arrival_local, 60);
      const pickupHHMM = pickupTime.slice(11, 16);
      if (!isTimeWithinWindow(pickupHHMM, arrTr.service_from, arrTr.service_until)) {
        warnings.push(`⚠️ Transfer conflict: Pickup at ${pickupHHMM} is outside transfer service window (${arrTr.service_from} - ${arrTr.service_until}).`);
      }
    }
    const firstHotel = catalog.hotels.get(pkg.items.find(it => it.type === 'hotel')?.catalog_id);
    if (firstHotel && firstHotel.check_in_from) {
      const estArrival = addMinutesToTime(flight.arrival_local, (arrTr?.duration_minutes || 60) + 60);
      if (estArrival.slice(11, 16) < firstHotel.check_in_from) {
        warnings.push(`ℹ️ Early arrival: Reaches hotel at ${estArrival.slice(11, 16)}, before check-in opens (${firstHotel.check_in_from}). Luggage drop required.`);
      }
    }

    return {
      flightId: flight.flight_id,
      airline: flight.airline,
      flightNumber: flight.flight_number,
      from: flight.from,
      to: flight.to,
      departureLocal: flight.departure_local,
      arrivalLocal: flight.arrival_local,
      durationMinutes: flight.duration_minutes,
      seatsLeft: flight.seats_left,
      pricePerSeat: flight.price_per_seat.amount,
      totalPrice: flightPrice,
      priceDifference: priceDiff,
      isCurrent,
      warnings,
    };
  });

  const rawRetFlights = findReturnFlights(catalog, reqObj.departureAirport, lastCity, expectedReturnDate, travelersCount);
  const returnCandidates = rawRetFlights.map(flight => {
    const flightPrice = calcFlightPrice(flight, travelersCount);
    const priceDiff = flightPrice - (currentRetFlightItem ? currentRetFlightItem.price_inr : 0);
    const isCurrent = currentRetFlightItem && currentRetFlightItem.catalog_id === flight.flight_id;

    const warnings = [];
    if (retTr) {
      const leaveTime = addMinutesToTime(flight.departure_local, -180);
      const leaveHHMM = leaveTime.slice(11, 16);
      if (!isTimeWithinWindow(leaveHHMM, retTr.service_from, retTr.service_until)) {
        warnings.push(`⚠️ Transfer conflict: Hotel leave time at ${leaveHHMM} is outside transfer service window (${retTr.service_from} - ${retTr.service_until}).`);
      }
    }
    const lastHotel = catalog.hotels.get(pkg.items.slice().reverse().find(it => it.type === 'hotel')?.catalog_id);
    if (lastHotel && lastHotel.check_out_until) {
      const leaveTime = addMinutesToTime(flight.departure_local, -180);
      if (leaveTime.slice(11, 16) > lastHotel.check_out_until) {
        warnings.push(`ℹ️ Late departure: Flight leaves at ${flight.departure_local.slice(11, 16)}. Hotel check-out is at ${lastHotel.check_out_until}. Luggage storage required.`);
      }
    }

    return {
      flightId: flight.flight_id,
      airline: flight.airline,
      flightNumber: flight.flight_number,
      from: flight.from,
      to: flight.to,
      departureLocal: flight.departure_local,
      arrivalLocal: flight.arrival_local,
      durationMinutes: flight.duration_minutes,
      seatsLeft: flight.seats_left,
      pricePerSeat: flight.price_per_seat.amount,
      totalPrice: flightPrice,
      priceDifference: priceDiff,
      isCurrent,
      warnings,
    };
  });

  // 4. Attractions Options per Day (M6, Section 4 limits 1-2, G2)
  const scheduleDays = getTripDaySchedule(pkg, catalog);
  const attractionOptions = scheduleDays.map(day => {
    const currentOnDay = pkg.items.filter(it => it.type === 'attraction' && it.start && it.start.startsWith(day.date));
    const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(day.date).getDay()];

    const canAdd = day.dayType !== 'departure' && currentOnDay.length < 2;
    const canRemove = !(day.dayType === 'full' && currentOnDay.length <= 1) && currentOnDay.length > 0;
    const removeReason = (day.dayType === 'full' && currentOnDay.length <= 1) ? 'Cannot remove: Full days require at least 1 attraction per Section 4 rules.' : null;
    const addReason = currentOnDay.length >= 2 ? 'Cannot add: Maximum 2 attractions per day allowed (Section 4 rule).' : (day.dayType === 'departure' ? 'No attractions allowed on departure day.' : null);

    const openInCity = (catalog.attractionsByCity.get(day.city) || []).filter(att => {
      const isOpen = att.open_days.includes(dayOfWeek);
      const isNotClosed = !(att.closed_dates || []).includes(day.date);
      const notInPkg = !pkg.items.some(it => it.type === 'attraction' && it.catalog_id === att.attraction_id);
      return isOpen && isNotClosed && notInPkg;
    }).map(att => {
      const price = calcAttractionPrice(att, adults, children);
      return {
        attractionId: att.attraction_id,
        name: att.name,
        name_ja: att.name_ja,
        city: att.city,
        category: att.category,
        image: att.image,
        visitMinutes: att.visit_minutes,
        openFrom: att.open_from,
        openUntil: att.open_until,
        totalPrice: price,
        priceDifference: price,
      };
    });

    return {
      dayNumber: day.dayNumber,
      date: day.date,
      dayType: day.dayType,
      city: day.city,
      currentAttractions: currentOnDay.map(it => ({
        ...it,
        image: catalog.attractions.get(it.catalog_id)?.image || null,
        category: catalog.attractions.get(it.catalog_id)?.category || 'Sightseeing',
      })),
      canAdd,
      canRemove,
      addReason,
      removeReason,
      availableToAdd: openInCity,
    };
  });

  res.json({
    status: 'OK',
    packageId: pkg.packageId,
    totalInr: pkg.totalInr,
    budgetInr: reqObj.budgetInr,
    remainingBudget: reqObj.budgetInr - pkg.totalInr,
    availableCityPlans,
    hotelOptions,
    flightOptions: {
      arrival: {
        current: currentArrFlightItem,
        candidates: arrivalCandidates,
      },
      return: {
        current: currentRetFlightItem,
        candidates: returnCandidates,
      },
    },
    attractionOptions,
  });
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
  newPkg.packageId = pkg.packageId; // preserve package ID
  if (pkg.status === 'BOOKED' && pkg.reservationNumber) {
    newPkg.status = 'BOOKED';
    newPkg.reservationNumber = pkg.reservationNumber;
    newPkg.items.forEach(it => {
      it.status = 'BOOKED';
      it.booking = { reference: pkg.reservationNumber };
    });
    await saveReservation(pkg.reservationNumber, newPkg.packageId, newPkg);
  }

  await savePackage(newPkg);

  res.json({
    status: 'OK',
    package: newPkg,
    alternatives: result.alternatives,
  });
});

// PATCH /api/packages/:id/hotel — Change hotel in a city (M6, G1, G2)
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
  const nights = (pkg.nightsPerCity && pkg.nightsPerCity[city]) || 1;
  const k = calculateRoomsNeeded(newRoom, pkg.request.adults, pkg.request.children || 0);

  if (!k) {
    return res.status(400).json({ error: 'Selected room cannot accommodate travelers' });
  }

  const oldPrice = currentItem.price_inr;
  const newPrice = calcHotelPrice(newRoom, k, nights);
  const priceDiff = newPrice - oldPrice;

  // Strict budget check
  if (pkg.totalInr + priceDiff > pkg.request.budgetInr) {
    return res.status(400).json({
      error: 'BUDGET_EXCEEDED',
      message: `Changing to ${newHotel.name} would bring total to ₹${(pkg.totalInr + priceDiff).toLocaleString('en-IN')}, exceeding your budget of ₹${pkg.request.budgetInr.toLocaleString('en-IN')}.`,
    });
  }

  // Cascading warnings check (G1)
  const warnings = [];
  const isFirstCity = city === pkg.cityPlan[0];
  const isLastCity = city === pkg.cityPlan[pkg.cityPlan.length - 1];

  const arrTrItem = pkg.items.find(it => it.type === 'transfer' && it.start && it.start.startsWith(pkg.request.startDate));
  const retTrItem = pkg.items.slice().reverse().find(it => it.type === 'transfer');
  const arrTr = arrTrItem ? catalog.transfers.get(arrTrItem.catalog_id) : null;
  const retTr = retTrItem ? catalog.transfers.get(retTrItem.catalog_id) : null;

  if (isFirstCity && arrTr && arrTr.area && newHotel.area && arrTr.area.toLowerCase() !== newHotel.area.toLowerCase()) {
    warnings.push(`⚠️ Area mismatch: Scheduled arrival transfer is for "${arrTr.area}" area, but "${newHotel.name}" is in "${newHotel.area}".`);
  }
  if (isLastCity && retTr && retTr.area && newHotel.area && retTr.area.toLowerCase() !== newHotel.area.toLowerCase()) {
    warnings.push(`⚠️ Area mismatch: Scheduled departure transfer is for "${retTr.area}" area, but "${newHotel.name}" is in "${newHotel.area}".`);
  }

  pkg.items[hotelItemIdx] = {
    ...currentItem,
    name: `${newHotel.name} (${newRoom.name})`,
    catalog_id: newHotel.hotel_id,
    room_id: newRoom.room_id,
    quantity: k,
    price_inr: newPrice,
    warnings,
  };

  pkg.totalInr = pkg.items.reduce((sum, it) => sum + it.price_inr, 0);
  recalculateMetrics(pkg, catalog);

  const val = validatePackage(pkg, catalog);
  if (!val.valid) {
    return res.status(400).json({ error: 'RULE_VIOLATION', message: val.errors.join('; '), errors: val.errors });
  }

  if (pkg.status === 'BOOKED' && pkg.reservationNumber) {
    await saveReservation(pkg.reservationNumber, pkg.packageId, pkg);
  }
  await savePackage(pkg);

  res.json({
    status: 'OK',
    package: pkg,
    priceDifference: priceDiff,
    warnings,
    message: `Hotel updated to ${newHotel.name}. Price change: ₹${priceDiff >= 0 ? '+' : ''}${priceDiff.toLocaleString('en-IN')}`,
  });
});

// PATCH /api/packages/:id/flight — Change arrival or return flight (M6, G1, G2)
router.patch('/:id/flight', async (req, res) => {
  const catalog = req.app.locals.catalog;
  const pkg = await getPackage(req.params.id);
  if (!pkg) return res.status(404).json({ error: 'Package not found' });

  const { type, flightId } = req.body;
  const newFlight = catalog.flights.get(flightId);
  if (!newFlight) return res.status(400).json({ error: 'Flight not found in catalog' });

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
  const priceDiff = newPrice - oldPrice;

  // Strict budget check
  if (pkg.totalInr + priceDiff > pkg.request.budgetInr) {
    return res.status(400).json({
      error: 'BUDGET_EXCEEDED',
      message: `Changing this flight would bring total to ₹${(pkg.totalInr + priceDiff).toLocaleString('en-IN')}, exceeding your budget of ₹${pkg.request.budgetInr.toLocaleString('en-IN')}.`,
    });
  }

  // Cascading warnings & transfer timing updates (G1)
  const warnings = [];

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

        const pickupHHMM = newPickup.slice(11, 16);
        if (!isTimeWithinWindow(pickupHHMM, tr.service_from, tr.service_until)) {
          warnings.push(`⚠️ Transfer conflict: Arrival transfer service operates ${tr.service_from} - ${tr.service_until}, but landing at ${newFlight.arrival_local.slice(11, 16)} schedules pickup at ${pickupHHMM}.`);
        }
      }
    }

    const firstHotelItem = pkg.items.find(it => it.type === 'hotel');
    if (firstHotelItem) {
      const h = catalog.hotels.get(firstHotelItem.catalog_id);
      if (h && h.check_in_from) {
        const estArrival = addMinutesToTime(newFlight.arrival_local, 120);
        if (estArrival.slice(11, 16) < h.check_in_from) {
          warnings.push(`ℹ️ Early arrival: Reaching hotel at ${estArrival.slice(11, 16)}. Check-in at ${h.name} begins at ${h.check_in_from}.`);
        }
      }
    }
  } else if (type === 'return') {
    const retTrIdx = pkg.items.slice().reverse().findIndex(it => it.type === 'transfer');
    const realRetTrIdx = retTrIdx !== -1 ? (pkg.items.length - 1 - retTrIdx) : -1;
    if (realRetTrIdx !== -1) {
      const trItem = pkg.items[realRetTrIdx];
      const tr = catalog.transfers.get(trItem.catalog_id);
      if (tr) {
        const leaveTime = addMinutesToTime(newFlight.departure_local, -180);
        const dropoffTime = addMinutesToTime(leaveTime, tr.duration_minutes);
        pkg.items[realRetTrIdx].start = leaveTime;
        pkg.items[realRetTrIdx].end = dropoffTime;

        const leaveHHMM = leaveTime.slice(11, 16);
        if (!isTimeWithinWindow(leaveHHMM, tr.service_from, tr.service_until)) {
          warnings.push(`⚠️ Transfer conflict: Departure transfer operates ${tr.service_from} - ${tr.service_until}, but flight leaves at ${newFlight.departure_local.slice(11, 16)} requiring pickup at ${leaveHHMM}.`);
        }
      }
    }

    const lastHotelItem = pkg.items.slice().reverse().find(it => it.type === 'hotel');
    if (lastHotelItem) {
      const h = catalog.hotels.get(lastHotelItem.catalog_id);
      if (h && h.check_out_until) {
        const leaveTime = addMinutesToTime(newFlight.departure_local, -180);
        if (leaveTime.slice(11, 16) > h.check_out_until) {
          warnings.push(`ℹ️ Late departure: Flight leaves at ${newFlight.departure_local.slice(11, 16)}. Hotel check-out is at ${h.check_out_until}.`);
        }
      }
    }
  }

  pkg.items[targetIdx] = {
    ...oldItem,
    name: `${newFlight.airline} ${newFlight.flight_number} (${newFlight.from} → ${newFlight.to})`,
    catalog_id: newFlight.flight_id,
    start: newFlight.departure_local.slice(0, 16),
    end: newFlight.arrival_local.slice(0, 16),
    quantity: travelersCount,
    price_inr: newPrice,
    warnings,
  };

  pkg.totalInr = pkg.items.reduce((sum, it) => sum + it.price_inr, 0);
  recalculateMetrics(pkg, catalog);

  const val = validatePackage(pkg, catalog);
  if (!val.valid) {
    return res.status(400).json({ error: 'RULE_VIOLATION', message: val.errors.join('; '), errors: val.errors });
  }

  if (pkg.status === 'BOOKED' && pkg.reservationNumber) {
    await saveReservation(pkg.reservationNumber, pkg.packageId, pkg);
  }
  await savePackage(pkg);

  res.json({
    status: 'OK',
    package: pkg,
    priceDifference: priceDiff,
    warnings,
    message: `Flight updated to ${newFlight.airline} ${newFlight.flight_number}. Price change: ₹${priceDiff >= 0 ? '+' : ''}${priceDiff.toLocaleString('en-IN')}`,
  });
});

// PATCH /api/packages/:id/attractions — Add or remove attraction (M6, Section 4 limits 1-2, G2)
router.patch('/:id/attractions', async (req, res) => {
  const catalog = req.app.locals.catalog;
  const pkg = await getPackage(req.params.id);
  if (!pkg) return res.status(404).json({ error: 'Package not found' });

  const { action, attractionId, date, time } = req.body;
  const scheduleDays = getTripDaySchedule(pkg, catalog);
  const daySchedule = scheduleDays.find(d => d.date === date);

  if (action === 'remove') {
    const idx = pkg.items.findIndex(it => it.type === 'attraction' && it.catalog_id === attractionId);
    if (idx === -1) return res.status(400).json({ error: 'Attraction not found in package' });

    const item = pkg.items[idx];
    const attDate = item.start ? item.start.slice(0, 10) : '';
    const dayInfo = scheduleDays.find(d => d.date === attDate);
    const countOnDay = pkg.items.filter(it => it.type === 'attraction' && it.start && it.start.startsWith(attDate)).length;

    // Rule: On full days, must maintain 1-2 attractions
    if (dayInfo && dayInfo.dayType === 'full' && countOnDay <= 1) {
      return res.status(400).json({
        error: 'RULE_VIOLATION',
        message: 'Cannot remove attraction: Section 4 rules require at least 1 attraction on full days.',
      });
    }

    pkg.items.splice(idx, 1);
  } else if (action === 'add') {
    const att = catalog.attractions.get(attractionId);
    if (!att) return res.status(400).json({ error: 'Attraction not found in catalog' });

    const exists = pkg.items.some(it => it.type === 'attraction' && it.catalog_id === attractionId);
    if (exists) return res.status(400).json({ error: 'Attraction is already in the package' });

    // Rule: Departure day cannot have attractions
    if (daySchedule && daySchedule.dayType === 'departure') {
      return res.status(400).json({
        error: 'RULE_VIOLATION',
        message: 'Cannot add attraction: Section 4 rules prohibit attractions on departure day.',
      });
    }

    // Rule: Max 2 attractions per day
    const currentOnDay = pkg.items.filter(it => it.type === 'attraction' && it.start && it.start.startsWith(date));
    if (currentOnDay.length >= 2) {
      return res.status(400).json({
        error: 'RULE_VIOLATION',
        message: 'Cannot add attraction: Section 4 rules allow at most 2 attractions per day.',
      });
    }

    const adults = pkg.request.adults;
    const children = pkg.request.children || 0;
    const price = calcAttractionPrice(att, adults, children);

    // Budget check
    if (pkg.totalInr + price > pkg.request.budgetInr) {
      return res.status(400).json({
        error: 'BUDGET_EXCEEDED',
        message: `Adding ${att.name} (₹${price.toLocaleString('en-IN')}) would bring total to ₹${(pkg.totalInr + price).toLocaleString('en-IN')}, exceeding your budget of ₹${pkg.request.budgetInr.toLocaleString('en-IN')}.`,
      });
    }

    // Determine non-overlapping time slot
    let startTimeStr = `${date}T${time || '10:00'}`;
    if (currentOnDay.length > 0) {
      currentOnDay.sort((a, b) => a.start.localeCompare(b.start));
      const lastAtt = currentOnDay[currentOnDay.length - 1];
      startTimeStr = addMinutesToTime(lastAtt.end, 30);
    } else if (daySchedule && daySchedule.dayType === 'arrival') {
      const arrTr = pkg.items.find(it => it.type === 'transfer' && it.start && it.start.startsWith(date));
      if (arrTr && arrTr.end) {
        const minStart = addMinutesToTime(arrTr.end, 60);
        if (minStart.slice(11, 16) > '10:00') {
          startTimeStr = minStart;
        }
      }
    }

    const visitMins = att.visit_minutes || 60;
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
    return res.status(400).json({ error: 'RULE_VIOLATION', message: val.errors.join('; '), errors: val.errors });
  }

  if (pkg.status === 'BOOKED' && pkg.reservationNumber) {
    await saveReservation(pkg.reservationNumber, pkg.packageId, pkg);
  }
  await savePackage(pkg);

  res.json({
    status: 'OK',
    package: pkg,
    message: action === 'add' ? 'Attraction added successfully' : 'Attraction removed successfully',
  });
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
