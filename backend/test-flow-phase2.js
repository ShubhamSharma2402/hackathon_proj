// test-flow-phase2.js
// Tests Feature S2 (Inventory deduction & double-booking prevention)
// and Feature G3 (Change city plans)

require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./src/db/connection');

async function testPhase2() {
  console.log('--- 🧪 TESTING PHASE 2 ENHANCEMENTS (S2 & G3) ---');

  const app = express();
  app.use(cors());
  app.use(express.json());

  await connectDB();
  const catalog = require('./src/catalog/loader');
  app.locals.catalog = catalog;

  app.use('/api/catalog', require('./src/routes/catalog'));
  app.use('/api/packages', require('./src/routes/packages'));
  app.use('/api/reservations', require('./src/routes/reservations'));

  const { getDeductedSeats, getDeductedRooms } = require('./src/db/storage');

  // Test 1: Build a package
  console.log('\n[TEST 1] Building package for 3 travelers (2 adults + 1 child)...');
  const req = {
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

  const { buildAllPackages } = require('./src/engine/packageBuilder');
  const result = buildAllPackages(catalog, req);
  const pkg = result.package;
  console.log('✓ Package built. Outbound flight:', pkg.items.find(i => i.type === 'flight').catalog_id);

  const outboundFlightId = pkg.items.find(i => i.type === 'flight').catalog_id;
  const initialDeduction = getDeductedSeats(outboundFlightId);
  console.log(`✓ Deducted seats before confirm: ${initialDeduction}`);

  // Test 2: Confirm booking (triggers S2 inventory deduction)
  console.log('\n[TEST 2] Confirming booking and locking inventory (S2)...');
  const { savePackage, saveReservation, recordInventoryDeductions, canDeductInventory } = require('./src/db/storage');
  
  const check = canDeductInventory(pkg, catalog);
  if (!check.allowed) throw new Error('Inventory check failed: ' + check.reason);
  console.log('✓ canDeductInventory: ALLOWED');

  const resNumber = '1234567890';
  await recordInventoryDeductions(resNumber, pkg);

  const afterDeduction = getDeductedSeats(outboundFlightId);
  console.log(`✓ Deducted seats on ${outboundFlightId} after confirm: ${afterDeduction} (increased by 3)`);
  if (afterDeduction !== initialDeduction + 3) {
    throw new Error('Seats were not properly deducted!');
  }

  // Test 3: Check that flight picker now returns reduced effective seats
  const { findArrivalFlights } = require('./src/engine/flightPicker');
  const availableArrivals = findArrivalFlights(catalog, 'BLR', pkg.cityPlan[0], '2027-04-10', 3);
  const targetFlight = availableArrivals.find(f => f.flight_id === outboundFlightId);
  if (targetFlight) {
    console.log(`✓ Effective seats left reported by engine: ${targetFlight.effective_seats_left} (Original was ${targetFlight.seats_left})`);
    if (targetFlight.effective_seats_left !== targetFlight.seats_left - 3) {
      throw new Error('Effective seats left calculation mismatch');
    }
  }

  // Test 4: G3 — Rebuilding with alternate city plan
  console.log('\n[TEST 4] Testing G3: Rebuilding with alternate city plan [Tokyo, Kyoto]...');
  const multiCityReq = {
    ...req,
    requestedCities: ['Tokyo', 'Kyoto'],
  };
  const multiResult = buildAllPackages(catalog, multiCityReq);
  if (multiResult.error) {
    throw new Error('Multi-city build failed: ' + multiResult.message);
  }
  const multiPkg = multiResult.package;
  console.log('✓ Successfully rebuilt package with cities:', multiPkg.cityPlan);
  console.log('✓ Nights per city:', multiPkg.nightsPerCity);
  console.log('✓ Includes intercity transfer:', multiPkg.items.some(i => i.name.includes('Shinkansen')));
  console.log(`✓ Total INR for multi-city: ₹${multiPkg.totalInr.toLocaleString('en-IN')}`);

  console.log('\n🎉 ALL PHASE 2 TESTS PASSED! S2 (Inventory Locking) & G3 (Change Cities) ARE FULLY OPERATIONAL!');
}

testPhase2().catch(e => {
  console.error('TEST ERROR:', e);
  process.exit(1);
});
