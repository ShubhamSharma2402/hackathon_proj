// src/engine/packageBuilder.js
// Orchestrates the complete holiday package generation according to Section 4 & Section 5 rules.
// Calculates all possible packages and returns the 3 packages:
// 1. Cheapest (lowest total price)
// 2. Fastest (least travel time: sum of flight durations + intercity transfer durations)
// 3. Best Rated (highest average hotel stars per night, within budget)

const { v4: uuidv4 } = require('uuid');
const { getValidCityPlans } = require('./cityPlanner');
const { findArrivalFlights, findReturnFlights } = require('./flightPicker');
const { findValidHotelsForCity } = require('./hotelPicker');
const { 
  findArrivalAirportTransfer, 
  findReturnAirportTransfer, 
  findIntercityTransfers, 
  addMinutesToTime, 
  isTimeWithinWindow 
} = require('./transferPicker');
const { scheduleAttractionsForDay } = require('./attractionScheduler');
const { 
  calcFlightPrice, 
  calcHotelPrice, 
  calcTransferPrice, 
  calcAttractionPrice 
} = require('./pricer');
const { validatePackage } = require('./packageValidator');

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildAllPackages(catalog, request) {
  const { departureAirport, country, startDate, nights, adults, children = 0, budgetInr } = request;
  const travelersCount = adults + children;

  // 1. Check if source / destination match the dataset
  const inputSource = String(departureAirport || '').trim();
  const inputCountry = String(country || '').trim();

  const depCity = catalog.destinations.departure_cities.find(d => 
    d.airport.toUpperCase() === inputSource.toUpperCase() || 
    d.city.toLowerCase() === inputSource.toLowerCase()
  );

  if (!depCity) {
    return {
      error: 'NO_PACKAGE_POSSIBLE',
      message: `We do not support flight and travel arrangements at this source: "${inputSource}". Supported sources are Bengaluru (BLR), Delhi (DEL), Mumbai (BOM), and Chennai (MAA).`
    };
  }

  // Normalize departureAirport to the standard code (e.g. "BLR")
  const normalizedAirport = depCity.airport;

  const countryObj = catalog.destinations.countries.find(c => 
    c.name.toLowerCase() === inputCountry.toLowerCase() || 
    c.code.toLowerCase() === inputCountry.toLowerCase()
  );

  if (!countryObj) {
    return {
      error: 'NO_PACKAGE_POSSIBLE',
      message: `We do not support flight and travel arrangements at this destination: "${inputCountry}". Supported destinations are Japan and United Arab Emirates.`
    };
  }

  // Normalize country name to standard (e.g. "Japan")
  const normalizedCountry = countryObj.name;

  // Check data window (1 to 20 April 2027)
  const returnDate = addDays(startDate, nights);
  if (startDate < '2027-04-01' || returnDate > '2027-04-20') {
    return {
      error: 'NO_PACKAGE_POSSIBLE',
      message: `There are no available packages for the dates ${startDate} to ${returnDate}. Packages are available from 1 to 20 April 2027 only.`
    };
  }

  let validCityPlans = getValidCityPlans(countryObj, nights);

  // Feature G3: If specific cities are requested by the traveler, filter to that plan
  if (request.requestedCities && Array.isArray(request.requestedCities)) {
    const matched = validCityPlans.filter(p => 
      p.cities.length === request.requestedCities.length &&
      p.cities.every((c, idx) => c === request.requestedCities[idx])
    );
    if (matched.length > 0) {
      validCityPlans = matched;
    }
  }

  if (validCityPlans.length === 0) {
    return {
      error: 'NO_PACKAGE_POSSIBLE',
      message: `There are no available packages for ${nights} nights in ${country}. Trip must be between 3 and 10 nights with at least 2 nights per city.`
    };
  }

  const candidates = [];
  const failureReasons = new Set();

  for (const plan of validCityPlans) {
    const { cities, nights: nightsList } = plan;
    const firstCity = cities[0];
    const lastCity = cities[cities.length - 1];

    // Outbound & Return Flights
    const arrFlights = findArrivalFlights(catalog, normalizedAirport, firstCity, startDate, travelersCount);
    if (arrFlights.length === 0) {
      failureReasons.add(`No arrival flights from ${normalizedAirport} to ${firstCity} landing on ${startDate}`);
      continue;
    }

    const retFlights = findReturnFlights(catalog, normalizedAirport, lastCity, returnDate, travelersCount);
    if (retFlights.length === 0) {
      failureReasons.add(`No return flights from ${lastCity} to ${normalizedAirport} departing on ${returnDate}`);
      continue;
    }

    // City Dates
    const cityDates = [];
    let currentCheckIn = startDate;
    for (let i = 0; i < cities.length; i++) {
      const cityNights = nightsList[i];
      const checkOut = addDays(currentCheckIn, cityNights);
      cityDates.push({
        city: cities[i],
        nights: cityNights,
        checkIn: currentCheckIn,
        checkOut,
      });
      currentCheckIn = checkOut;
    }

    // Hotels for each city
    const hotelOptionsByCity = [];
    let allCitiesHaveHotels = true;
    for (const cd of cityDates) {
      const options = findValidHotelsForCity(catalog, cd.city, cd.checkIn, cd.checkOut, adults, children);
      if (options.length === 0) {
        failureReasons.add(`No available hotels in ${cd.city} from ${cd.checkIn} to ${cd.checkOut}`);
        allCitiesHaveHotels = false;
        break;
      }
      hotelOptionsByCity.push(options);
    }
    if (!allCitiesHaveHotels) continue;

    // Flight variants: cheapest flight + fastest flight
    const selectedArrFlights = [arrFlights[0]];
    const fastestArr = [...arrFlights].sort((a, b) => a.duration_minutes - b.duration_minutes)[0];
    if (fastestArr.flight_id !== arrFlights[0].flight_id) selectedArrFlights.push(fastestArr);

    const selectedRetFlights = [retFlights[0]];
    const fastestRet = [...retFlights].sort((a, b) => a.duration_minutes - b.duration_minutes)[0];
    if (fastestRet.flight_id !== retFlights[0].flight_id) selectedRetFlights.push(fastestRet);

    // Hotel variants per city:
    // 1. Cheapest hotel
    // 2. Highest stars hotel
    // 3. Medium hotel
    const hotelCombinations = [];
    const cheapestCombo = hotelOptionsByCity.map(opts => opts[0]);
    hotelCombinations.push(cheapestCombo);

    const bestStarCombo = hotelOptionsByCity.map(opts => {
      const sortedByStars = [...opts].sort((a, b) => (b.hotel.stars || 3) - (a.hotel.stars || 3));
      return sortedByStars[0];
    });
    hotelCombinations.push(bestStarCombo);

    if (hotelOptionsByCity[0].length > 1) {
      const midCombo = hotelOptionsByCity.map(opts => opts[Math.min(1, opts.length - 1)]);
      hotelCombinations.push(midCombo);
    }

    // Evaluate combinations
    for (const arrFlight of selectedArrFlights) {
      for (const retFlight of selectedRetFlights) {
        for (const chosenHotels of hotelCombinations) {
          const firstHotel = chosenHotels[0].hotel;
          const lastHotel = chosenHotels[chosenHotels.length - 1].hotel;

          // Arrival Transfer
          const arrTransfers = findArrivalAirportTransfer(catalog, arrFlight.to, firstHotel);
          const validArrTransfers = arrTransfers.filter(tr => {
            const pickupTimeStr = addMinutesToTime(arrFlight.arrival_local, 60);
            const pickupHHMM = pickupTimeStr.slice(11, 16);
            return isTimeWithinWindow(pickupHHMM, tr.service_from, tr.service_until);
          });
          if (validArrTransfers.length === 0) continue;
          const chosenArrTransfer = validArrTransfers[0];

          // Return Transfer
          const retTransfers = findReturnAirportTransfer(catalog, lastHotel, retFlight.from);
          const validRetTransfers = retTransfers.filter(tr => {
            const hotelLeaveTimeStr = addMinutesToTime(retFlight.departure_local, -(180 + tr.duration_minutes));
            const hotelLeaveHHMM = hotelLeaveTimeStr.slice(11, 16);
            return isTimeWithinWindow(hotelLeaveHHMM, tr.service_from, tr.service_until);
          });
          if (validRetTransfers.length === 0) continue;
          const chosenRetTransfer = validRetTransfers[0];

          // Intercity Transfers
          const chosenIntercityTransfers = [];
          let allIntercityValid = true;
          for (let i = 0; i < cities.length - 1; i++) {
            const fromC = cities[i];
            const toC = cities[i + 1];
            const interTransfers = findIntercityTransfers(catalog, fromC, toC);
            if (interTransfers.length === 0) {
              allIntercityValid = false;
              break;
            }
            const moveDay = cityDates[i].checkOut;
            const tr = interTransfers[0];
            const depTime = `${moveDay}T10:00`;
            const arrTime = addMinutesToTime(depTime, tr.duration_minutes);
            chosenIntercityTransfers.push({
              transfer: tr,
              date: moveDay,
              start: depTime,
              end: arrTime,
            });
          }
          if (!allIntercityValid) continue;

          // Schedule Attractions
          const usedAttractionIds = new Set();
          const scheduledAttractions = [];

          for (let dayIdx = 0; dayIdx < nights; dayIdx++) {
            const currentDateStr = addDays(startDate, dayIdx);
            let currentCity = cities[0];
            for (const cd of cityDates) {
              if (currentDateStr >= cd.checkIn && currentDateStr < cd.checkOut) {
                currentCity = cd.city;
                break;
              }
            }

            if (dayIdx === 0) {
              const hotelArrivalStr = addMinutesToTime(arrFlight.arrival_local, 60 + chosenArrTransfer.duration_minutes);
              const hotelArrivalHHMM = hotelArrivalStr.slice(11, 16);
              const atts = scheduleAttractionsForDay(catalog, currentCity, currentDateStr, hotelArrivalHHMM, 1, usedAttractionIds);
              scheduledAttractions.push(...atts);
            } else {
              const cityChange = chosenIntercityTransfers.find(cit => cit.date === currentDateStr);
              if (cityChange) {
                const cityArrHHMM = cityChange.end.slice(11, 16);
                const atts = scheduleAttractionsForDay(catalog, currentCity, currentDateStr, cityArrHHMM, 1, usedAttractionIds);
                scheduledAttractions.push(...atts);
              } else {
                const atts = scheduleAttractionsForDay(catalog, currentCity, currentDateStr, '09:30', 2, usedAttractionIds);
                scheduledAttractions.push(...atts);
              }
            }
          }

          // Build Items
          const items = [];
          let itemCounter = 1;

          items.push({
            item_id: `i${itemCounter++}`,
            type: 'flight',
            name: `${arrFlight.airline} ${arrFlight.flight_number} (${arrFlight.from} → ${arrFlight.to})`,
            city: firstCity,
            status: 'PLANNED',
            catalog_id: arrFlight.flight_id,
            room_id: null,
            image: arrFlight.image || null,
            start: arrFlight.departure_local.slice(0, 16),
            end: arrFlight.arrival_local.slice(0, 16),
            quantity: travelersCount,
            price_inr: calcFlightPrice(arrFlight, travelersCount),
            booking: null,
            sources: [],
            warnings: [],
          });

          const arrPickupStr = addMinutesToTime(arrFlight.arrival_local, 60);
          const arrDropoffStr = addMinutesToTime(arrPickupStr, chosenArrTransfer.duration_minutes);
          items.push({
            item_id: `i${itemCounter++}`,
            type: 'transfer',
            name: chosenArrTransfer.name,
            city: firstCity,
            status: 'PLANNED',
            catalog_id: chosenArrTransfer.transfer_id,
            room_id: null,
            image: chosenArrTransfer.image || null,
            start: arrPickupStr,
            end: arrDropoffStr,
            quantity: chosenArrTransfer.pricing === 'PER_PERSON' ? travelersCount : Math.ceil(travelersCount / (chosenArrTransfer.max_passengers || 4)),
            price_inr: calcTransferPrice(chosenArrTransfer, adults, children),
            booking: null,
            sources: [],
            warnings: [],
          });

          for (let i = 0; i < cities.length; i++) {
            const cd = cityDates[i];
            const hOpt = chosenHotels[i];
            items.push({
              item_id: `i${itemCounter++}`,
              type: 'hotel',
              name: `${hOpt.hotel.name} (${hOpt.room.name})`,
              city: cd.city,
              status: 'PLANNED',
              catalog_id: hOpt.hotel.hotel_id,
              room_id: hOpt.room.room_id,
              image: hOpt.hotel.image || null,
              start: cd.checkIn,
              end: cd.checkOut,
              quantity: hOpt.roomsCount,
              price_inr: calcHotelPrice(hOpt.room, hOpt.roomsCount, cd.nights),
              details: {
                hotelName: hOpt.hotel.name,
                stars: hOpt.hotel.stars,
                rating: hOpt.hotel.rating,
                area: hOpt.hotel.area,
                roomName: hOpt.room.name,
                roomType: hOpt.room.room_type,
                check_in_from: hOpt.hotel.check_in_from,
                check_out_until: hOpt.hotel.check_out_until,
                family_friendly: hOpt.hotel.family_friendly,
                nights: cd.nights,
              },
              booking: null,
              sources: [],
              warnings: [],
            });

            if (i < chosenIntercityTransfers.length) {
              const cit = chosenIntercityTransfers[i];
              items.push({
                item_id: `i${itemCounter++}`,
                type: 'transfer',
                name: cit.transfer.name,
                city: cities[i + 1],
                status: 'PLANNED',
                catalog_id: cit.transfer.transfer_id,
                room_id: null,
                image: cit.transfer.image || null,
                start: cit.start,
                end: cit.end,
                quantity: cit.transfer.pricing === 'PER_PERSON' ? travelersCount : Math.ceil(travelersCount / (cit.transfer.max_passengers || 4)),
                price_inr: calcTransferPrice(cit.transfer, adults, children),
                booking: null,
                sources: [],
                warnings: [],
              });
            }
          }

          for (const att of scheduledAttractions) {
            items.push({
              item_id: `i${itemCounter++}`,
              type: 'attraction',
              name: att.attraction.name,
              city: att.attraction.city,
              status: 'PLANNED',
              catalog_id: att.attraction.attraction_id,
              room_id: null,
              image: att.attraction.image || null,
              start: att.startDateTime,
              end: att.endDateTime,
              quantity: travelersCount,
              price_inr: calcAttractionPrice(att.attraction, adults, children),
              details: {
                category: att.attraction.category,
                visit_minutes: att.attraction.visit_minutes,
                open_from: att.attraction.open_from,
                open_until: att.attraction.open_until,
                child_friendly: att.attraction.child_friendly,
                accessible: att.attraction.accessible,
              },
              booking: null,
              sources: [],
              warnings: [],
            });
          }

          const retPickupStr = addMinutesToTime(retFlight.departure_local, -(180 + chosenRetTransfer.duration_minutes));
          const retDropoffStr = addMinutesToTime(retPickupStr, chosenRetTransfer.duration_minutes);
          items.push({
            item_id: `i${itemCounter++}`,
            type: 'transfer',
            name: chosenRetTransfer.name,
            city: lastCity,
            status: 'PLANNED',
            catalog_id: chosenRetTransfer.transfer_id,
            room_id: null,
            image: chosenRetTransfer.image || null,
            start: retPickupStr,
            end: retDropoffStr,
            quantity: chosenRetTransfer.pricing === 'PER_PERSON' ? travelersCount : Math.ceil(travelersCount / (chosenRetTransfer.max_passengers || 4)),
            price_inr: calcTransferPrice(chosenRetTransfer, adults, children),
            booking: null,
            sources: [],
            warnings: [],
          });

          items.push({
            item_id: `i${itemCounter++}`,
            type: 'flight',
            name: `${retFlight.airline} ${retFlight.flight_number} (${retFlight.from} → ${retFlight.to})`,
            city: lastCity,
            status: 'PLANNED',
            catalog_id: retFlight.flight_id,
            room_id: null,
            image: retFlight.image || null,
            start: retFlight.departure_local.slice(0, 16),
            end: retFlight.arrival_local.slice(0, 16),
            quantity: travelersCount,
            price_inr: calcFlightPrice(retFlight, travelersCount),
            booking: null,
            sources: [],
            warnings: [],
          });

          items.sort((a, b) => a.start.localeCompare(b.start));
          items.forEach((it, idx) => {
            it.item_id = `i${idx + 1}`;
          });

          const totalInr = items.reduce((sum, it) => sum + it.price_inr, 0);

          // G4 metric: total travel minutes = flight durations + intercity transfer durations
          const travelMinutes = arrFlight.duration_minutes + retFlight.duration_minutes +
            chosenIntercityTransfers.reduce((sum, cit) => sum + cit.transfer.duration_minutes, 0);

          // G4 metric: average hotel stars per night
          let starSum = 0;
          for (let i = 0; i < cities.length; i++) {
            starSum += (chosenHotels[i].hotel.stars || 3) * nightsList[i];
          }
          const avgHotelStars = Number((starSum / nights).toFixed(2));

          const nightsPerCity = {};
          for (let i = 0; i < cities.length; i++) {
            nightsPerCity[cities[i]] = nightsList[i];
          }

          const candidatePkg = {
            packageId: uuidv4(),
            request,
            cityPlan: cities,
            nightsPerCity,
            items,
            totalInr,
            status: 'DRAFT',
            reservationNumber: null,
            metrics: {
              travelMinutes,
              avgHotelStars,
            },
          };

          const val = validatePackage(candidatePkg, catalog);
          if (val.valid) {
            candidates.push(candidatePkg);
          }
        }
      }
    }
  }

  if (candidates.length === 0) {
    const reason = Array.from(failureReasons)[0] || 'No available packages fit all travel rules for the given inputs.';
    return { error: 'NO_PACKAGE_POSSIBLE', message: `There are no available packages for this request. Reason: ${reason}` };
  }

  // Deduplicate candidates by item catalog_ids signature
  const seenSignatures = new Set();
  const distinctCandidates = [];
  for (const c of candidates) {
    const sig = `${c.cityPlan.join(',')}_${c.items.map(it => `${it.catalog_id}-${it.room_id || ''}`).join('|')}`;
    if (!seenSignatures.has(sig)) {
      seenSignatures.add(sig);
      distinctCandidates.push(c);
    }
  }

  // Find packages within budget
  const withinBudget = distinctCandidates.filter(c => c.totalInr <= budgetInr);

  if (withinBudget.length === 0) {
    // M8: Budget too small! Show cheapest total and suggest a change.
    distinctCandidates.sort((a, b) => a.totalInr - b.totalInr);
    const cheapest = distinctCandidates[0];
    return {
      error: 'BUDGET_TOO_SMALL',
      budget: budgetInr,
      cheapestTotal: cheapest.totalInr,
      difference: cheapest.totalInr - budgetInr,
      cheapestPackage: cheapest,
      suggestion: `The lowest price available is ₹${cheapest.totalInr.toLocaleString('en-IN')}. Consider increasing your budget by ₹${(cheapest.totalInr - budgetInr).toLocaleString('en-IN')}, reducing the number of nights, or adjusting traveler count.`,
    };
  }

  // 1. Cheapest: lowest totalInr
  const cheapest = [...withinBudget].sort((a, b) => a.totalInr - b.totalInr)[0];

  // 2. Fastest: least total travel time
  const fastest = [...withinBudget].sort((a, b) => a.metrics.travelMinutes - b.metrics.travelMinutes)[0];

  // 3. Best Rated: highest average hotel stars per night
  const bestRated = [...withinBudget].sort((a, b) => {
    if (b.metrics.avgHotelStars !== a.metrics.avgHotelStars) {
      return b.metrics.avgHotelStars - a.metrics.avgHotelStars;
    }
    return a.totalInr - b.totalInr; // tie-breaker: cheaper
  })[0];

  // Package variants list to show the user
  // If 3 or more distinct packages fit: show 3 distinct packages under the 3 categories
  // If less than 3 packages fit: show both/all under applicable categories
  const packageCards = [];

  packageCards.push({
    category: 'cheapest',
    title: 'Cheapest',
    badge: '💰 Lowest Total Price',
    description: 'Best value for your budget with all required amenities.',
    package: cheapest,
  });

  if (fastest.packageId !== cheapest.packageId) {
    packageCards.push({
      category: 'fastest',
      title: 'Fastest',
      badge: '⚡ Least Travel Time',
      description: 'Quickest flight & transit durations to maximize your holiday.',
      package: fastest,
    });
  } else if (withinBudget.length >= 2) {
    // Pick the second cheapest or second fastest as alternative
    const second = withinBudget.find(p => p.packageId !== cheapest.packageId);
    if (second) {
      packageCards.push({
        category: 'fastest',
        title: 'Alternative Option',
        badge: '⚡ Alternate Route',
        description: 'Balanced duration and route configuration.',
        package: second,
      });
    }
  }

  const existingIds = new Set(packageCards.map(c => c.package.packageId));
  if (!existingIds.has(bestRated.packageId)) {
    packageCards.push({
      category: 'bestRated',
      title: 'Best Rated',
      badge: '⭐ Highest Hotel Class',
      description: 'Top-tier accommodations with highest hotel stars.',
      package: bestRated,
    });
  } else if (withinBudget.length >= 3 && packageCards.length < 3) {
    const third = withinBudget.find(p => !existingIds.has(p.packageId));
    if (third) {
      packageCards.push({
        category: 'bestRated',
        title: 'Top Rated',
        badge: '⭐ Premium Stay',
        description: 'Excellent hotel ratings and prime locations.',
        package: third,
      });
    }
  }

  return {
    package: cheapest, // default active selection
    packageCards,      // the 3 (or available) package cards
    alternatives: {
      cheapest,
      fastest,
      bestRated,
    },
    totalPackagesFound: withinBudget.length,
  };
}

module.exports = {
  buildAllPackages,
};
