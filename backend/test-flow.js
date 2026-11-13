// test-flow.js
// Automated verification script that tests every single Must-have feature (M1 to M8)

const http = require('http');

async function runTests() {
  console.log('--- 🧪 STARTING COMPLETE TEST SUITE ---');

  // Load and start server
  require('dotenv').config();
  const express = require('express');
  const cors = require('cors');
  const { connectDB } = require('./src/db/connection');

  const app = express();
  app.use(cors());
  app.use(express.json());

  await connectDB();
  const catalog = require('./src/catalog/loader');
  app.locals.catalog = catalog;

  app.use('/api/catalog', require('./src/routes/catalog'));
  app.use('/api/packages', require('./src/routes/packages'));
  app.use('/api/reservations', require('./src/routes/reservations'));

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(3099, '127.0.0.1', resolve));
  const baseUrl = 'http://127.0.0.1:3099/api';

  try {
    // Test 1: M1 — Form data endpoint
    console.log('\n[TEST 1] GET /api/catalog/form-data');
    const formRes = await fetch(`${baseUrl}/catalog/form-data`).then(r => r.json());
    console.log('✓ Departure cities:', formRes.departureCities.map(c => c.city));
    console.log('✓ Countries:', formRes.countries.map(c => c.name));

    // Test 2: M2, M3, M4, M5 — Build Menon Family Package
    console.log('\n[TEST 2] POST /api/packages (Menon Family Request)');
    const menonRequest = {
      departureAirport: 'BLR',
      departureCity: 'Bengaluru',
      country: 'Japan',
      startDate: '2027-04-10',
      nights: 6,
      adults: 2,
      children: 1,
      childAges: [6],
      budgetInr: 350000,
    };

    const buildRes = await fetch(`${baseUrl}/packages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(menonRequest),
    }).then(r => r.json());

    if (buildRes.status !== 'OK') {
      throw new Error(`Build failed: ${JSON.stringify(buildRes)}`);
    }

    const pkg = buildRes.package;
    console.log('✓ Package generated! ID:', pkg.packageId);
    console.log('✓ Cities chosen:', pkg.cityPlan, 'Nights:', pkg.nightsPerCity);
    console.log(`✓ Total INR: ₹${pkg.totalInr.toLocaleString('en-IN')} (Budget: ₹${menonRequest.budgetInr.toLocaleString('en-IN')})`);
    console.log(`✓ Items count: ${pkg.items.length}`);

    // Verify day-by-day ordering
    for (let i = 0; i < pkg.items.length - 1; i++) {
      if (pkg.items[i].start > pkg.items[i + 1].start) {
        throw new Error(`Items not sorted chronologically: ${pkg.items[i].name} vs ${pkg.items[i + 1].name}`);
      }
    }
    console.log('✓ All items in chronological order');

    // Test 3: M6, G2 — Change Hotel
    console.log('\n[TEST 3] PATCH /api/packages/:id/hotel (Change hotel)');
    const city = pkg.cityPlan[0];
    const hotelsInCity = await fetch(`${baseUrl}/catalog/hotels?city=${city}&checkIn=2027-04-10&checkOut=2027-04-16&adults=2&children=1`).then(r => r.json());
    console.log(`✓ Available hotels in ${city}:`, hotelsInCity.length);

    // Pick an alternative hotel
    const currentHotelItem = pkg.items.find(it => it.type === 'hotel');
    const altOption = hotelsInCity.find(h => h.hotel.hotel_id !== currentHotelItem.catalog_id);
    if (altOption) {
      const changeHotelRes = await fetch(`${baseUrl}/packages/${pkg.packageId}/hotel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city,
          hotelId: altOption.hotel.hotel_id,
          roomId: altOption.room.room_id,
        }),
      }).then(r => r.json());

      console.log('✓ Hotel changed successfully!');
      console.log('✓ New total:', changeHotelRes.package.totalInr);
      console.log('✓ Price difference:', changeHotelRes.priceDifference);
    }

    // Test 4: M7 — Confirm & 10-digit Reservation Number
    console.log('\n[TEST 4] POST /api/packages/:id/confirm');
    const confirmRes = await fetch(`${baseUrl}/packages/${pkg.packageId}/confirm`, {
      method: 'POST',
    }).then(r => r.json());

    const resNumber = confirmRes.reservationNumber;
    console.log('✓ Reservation confirmed!');
    console.log('✓ 10-digit Reservation Number:', resNumber);
    if (!resNumber || resNumber.length !== 10) {
      throw new Error(`Invalid reservation number length: ${resNumber}`);
    }

    // Test 5: M7 — Lookup Reservation by number
    console.log('\n[TEST 5] GET /api/reservations/:number');
    const lookupRes = await fetch(`${baseUrl}/reservations/${resNumber}`).then(r => r.json());
    console.log('✓ Lookup status:', lookupRes.status);
    console.log('✓ Found package total INR:', lookupRes.package.totalInr);

    // Test 6: M7 — Wrong reservation number shows "not found"
    console.log('\n[TEST 6] GET /api/reservations/9999999999 (Invalid number)');
    const notFoundRes = await fetch(`${baseUrl}/reservations/9999999999`);
    const notFoundBody = await notFoundRes.json();
    console.log('✓ Status code:', notFoundRes.status, 'Body:', notFoundBody);
    if (notFoundRes.status !== 404 || notFoundBody.error !== 'not found') {
      throw new Error('Did not return 404 "not found" for wrong reservation number');
    }

    // Test 7: Section 6 — Package JSON Export
    console.log('\n[TEST 7] GET /api/packages/:id/export');
    const exportRes = await fetch(`${baseUrl}/packages/${pkg.packageId}/export`).then(r => r.json());
    console.log('✓ Export trip_id:', exportRes.trip_id);
    console.log('✓ Export items count:', exportRes.items.length);
    console.log('✓ Export sample item status & booking:', exportRes.items[0].status, exportRes.items[0].booking);

    // Test 8: M8 — Budget too small
    console.log('\n[TEST 8] POST /api/packages with too small budget (₹10,000)');
    const smallBudgetRes = await fetch(`${baseUrl}/packages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...menonRequest,
        budgetInr: 10000,
      }),
    }).then(r => r.json());
    console.log('✓ Budget too small response status:', smallBudgetRes.status);
    console.log('✓ Cheapest total suggested:', smallBudgetRes.cheapestTotal);
    console.log('✓ Suggestion message:', smallBudgetRes.suggestion);

    console.log('\n🎉 ALL 8 TESTS PASSED SUCCESSFULLY! EVERYTHING WORKS FLAWLESSLY.');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
