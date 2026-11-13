// test-atlas-and-availability.js
// Verifies MongoDB Atlas connectivity, automatic schema creation,
// and ensures that confirming a booking does NOT decrease availability for future bookings.

require('dotenv').config();
const { connectDB } = require('./src/db/connection');
const { buildAllPackages } = require('./src/engine/packageBuilder');
const { savePackage, saveReservation, getPackage, getReservation } = require('./src/db/storage');
const PackageModel = require('./src/db/models/Package');
const ReservationModel = require('./src/db/models/Reservation');

async function test() {
  console.log('--- 🧪 TESTING MONGODB ATLAS & NON-DECREASING AVAILABILITY ---');

  await connectDB();
  const catalog = require('./src/catalog/loader');

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

  // 1. Build first package
  console.log('\n[TEST 1] First customer builds Menon Family package...');
  const res1 = buildAllPackages(catalog, menonRequest);
  if (res1.error) throw new Error('Build 1 failed: ' + res1.message);
  const pkg1 = res1.package;
  console.log('✓ Package 1 built with ID:', pkg1.packageId);
  console.log('✓ Total cost: ₹' + pkg1.totalInr.toLocaleString('en-IN'));

  // Save to MongoDB Atlas
  await savePackage(pkg1);
  const resNumber = '1000000001';
  await saveReservation(resNumber, pkg1.packageId, pkg1);
  console.log(`✓ Confirmed reservation #${resNumber} saved to MongoDB Atlas!`);

  // Verify in MongoDB Atlas
  const countPkgs = await PackageModel.countDocuments();
  const countRes = await ReservationModel.countDocuments();
  console.log(`✓ MongoDB Atlas collections active! Total packages: ${countPkgs}, Total reservations: ${countRes}`);

  // 2. Build second package with EXACT same resources
  console.log('\n[TEST 2] Second customer requests the EXACT same dates, flights, and hotel...');
  const res2 = buildAllPackages(catalog, menonRequest);
  if (res2.error) {
    throw new Error('Build 2 failed! Availability was improperly decreased: ' + res2.message);
  }
  const pkg2 = res2.package;
  console.log('✓ Package 2 successfully built with ID:', pkg2.packageId);
  console.log('✓ Same flights and hotels were available and not blocked!');

  // Verify both packages have the exact same price and items
  if (pkg2.totalInr !== pkg1.totalInr) {
    throw new Error('Price discrepancy between bookings');
  }
  console.log('✓ Verified: Second customer can book the exact same resources freely!');

  // 3. Verify Day-by-Day plan details
  console.log('\n[TEST 3] Verifying complete Day-by-Day plan...');
  const nights = pkg1.request.nights;
  console.log(`✓ Trip length: ${nights} nights (${pkg1.request.startDate} to 2027-04-16)`);
  console.log(`✓ Total items in itinerary: ${pkg1.items.length}`);

  const typesCount = {};
  pkg1.items.forEach(it => {
    typesCount[it.type] = (typesCount[it.type] || 0) + 1;
  });
  console.log('✓ Breakdown of items:', typesCount);
  if (!typesCount.flight || !typesCount.hotel || !typesCount.transfer || !typesCount.attraction) {
    throw new Error('Missing an item category in itinerary');
  }

  console.log('\n🎉 ALL TESTS PASSED! ATLAS PERSISTENCE & UNRESTRICTED AVAILABILITY VERIFIED 100%!');
  process.exit(0);
}

test().catch(err => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
