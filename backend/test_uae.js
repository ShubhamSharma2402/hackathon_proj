const catalog = require('./src/catalog/loader');
const { calcTransferPrice } = require('./src/engine/pricer');

// CRITICAL DISCOVERY: Abu Dhabi airports = ["AUH", "DXB"]
// So Abu Dhabi can be SERVED BY both AUH and DXB airports!
// 
// This means: for a city plan starting in Abu Dhabi:
//   - Arrival flight can land at EITHER AUH or DXB
//   - If landing at DXB (Dubai airport), need to transfer to Abu Dhabi city (taxi ~100min)
//   - If landing at AUH (Abu Dhabi airport), need to transfer to Corniche area (taxi 35min)
//
// Similarly, for a city plan ending in Dubai:
//   - Return flight can depart from DXB (Dubai airport) - NO extra transfer needed
//   - Just need hotel->airport transfer in Dubai
//
// User's cheapest plan: AUH 3n (Apr 5-8) -> DXB 2n (Apr 8-10)
// FL-1088 (BOM->AUH, landing at Abu Dhabi airport AUH on Apr 5) -> TR-AUH-COR-TAXI (35min, ₹2,176)
// Then intercity: TR-AUH-DXB-BUS (150min) on Apr 8
// Then departure: TR-DXB-BAR-METRO (doesn't exist in catalog)
// Then FL-1180 (DXB->BOM, depart Apr 10)
//
// Let's verify what TR-DXB-BAR-METRO might be (maybe user meant TR-DXB-BSH-BUS):
// User says "TR-AUH-COR-TAXI + TR-DXB-BAR-METRO = ₹4,236"
// TR-AUH-COR-TAXI = ₹2,176 -> ₹4,236 - ₹2,176 = ₹2,060 for TR-DXB-BAR-METRO
// None of our transfers cost ₹2,060

// User may be referring to a METRO line transfer that uses a different pricing.
// Perhaps there's a Dubai Metro that our catalog doesn't have.
// Let's check all DXB area transfers:
console.log('All DXB airport transfers:');
for (const [id, t] of catalog.transfers) {
  if (t.airport === 'DXB') {
    const price2 = calcTransferPrice(t, 2, 0);
    console.log(id, t.name, t.type, t.area, t.duration_minutes+'m', '₹'+t.price.amount, t.pricing, 'for 2 adults: ₹'+price2);
  }
}

// User's hotel prices: "₹14,561" for Corniche 3n + Barsha 2n
// Our catalog: Corniche Twin ₹5,267*3 + Barsha Twin ₹5,496*2 = ₹15,801 + ₹10,992 = ₹26,793
// That's VERY different from ₹14,561.
// If using SINGLE rooms: Corniche Single ₹3,664*3 + Barsha Single ₹3,893*2 = ₹10,992 + ₹7,786 = ₹18,778
// Still different from ₹14,561.
// User's AI might have a different price source.
//
// Let's check: ₹14,561 / 5 nights = ₹2,912/night average. That's cheaper than any twin room.
// Our cheapest room is Corniche Single ₹3,664/night. So user's AI calculation must be wrong or
// using a different version of the catalog.
//
// BOTTOM LINE on user's cheapest calculation:
// 1. Flight cost discrepancy: User says ₹68,000. With FL-1088+FL-1180 for 2 adults = (13000+16000)*2 = ₹58,000
//    The only way to get ₹68,000 is FL-1088+FL-1182 (AUH->BOM) = (13000+21000)*2 = ₹68,000
//    but then the return is from AUH, not DXB.
// 2. Hotel cost discrepancy: User says ₹14,561, catalog gives min ₹18,778 for 5 nights.
// 3. Transfer ID TR-DXB-BAR-METRO doesn't exist in our catalog.
//
// CONCLUSION: The user's AI made calculation errors. Our engine uses the ACTUAL catalog prices.

// Now let's verify our engine results against catalog:
// Our cheapest: Dubai 5n, FL-1086 (BOM->DXB) + FL-1180 (DXB->BOM) = (13000+16000)*2 = ₹58,000 for 2 adults
// Wait, that's ₹58,000 but our engine shows ₹91,202 total

const { buildAllPackages } = require('./src/engine/packageBuilder');
const req = { departureAirport: 'BOM', country: 'United Arab Emirates', startDate: '2027-04-05', nights: 5, adults: 2, children: 0, childAges: [], budgetInr: 300000 };
const res = buildAllPackages(catalog, req);

const cheapest = res.packageCards[0].package;
let runningTotal = 0;
console.log('\nOUR ENGINE CHEAPEST (Dubai 5n) = ₹' + cheapest.totalInr);
cheapest.items.forEach(i => {
  runningTotal += i.price_inr;
  console.log(i.type, '|', i.name, '| ₹'+i.price_inr, '| Running total: ₹'+runningTotal);
});

// User's fastest: ₹88,912 (Dubai 5n)
// FL-1086 (BOM->DXB 200m ₹13,000) + FL-1180 (DXB->BOM 185m ₹16,000)
// 2 adults: ₹58,000 flights
// Hotel: Barsha Budget Stay Twin ₹5,496 * 5n = ₹27,480
// TR-DXB-BAR-METRO (arrival) = user says ₹1,896 and departure = ₹1,896 -> total ₹3,792
// If TR-DXB-BSH-BUS costs ₹1,144 for 2 adults (not ₹1,896), there's discrepancy.
// Our fastest: ₹92,578 (Deira Spice Inn, TR-DXB-DRA-TAXI both ways)
// 2*1260 = ₹2,520 for transfers, 29770 hotel = 58000+29770+2520 = ₹90,290 + attractions = ₹92,578

// Let's check: user says "TR-DXB-BAR-METRO × 2 legs = ₹3,792" 
// ₹3,792 / 2 = ₹1,896 per leg. What transfer gives ₹1,896 for 2 adults?
// If PER_PERSON: ₹948/person * 2 = ₹1,896. 
// If PER_VEHICLE: ₹1,896 flat.
// Let's check TR-DXB-BSH-BUS: ₹572/person * 2 = ₹1,144. No.
// TR-DXB-BSH-TAXI: ₹2,290 flat vehicle. No.
// NONE of our transfers give ₹1,896. So TR-DXB-BAR-METRO doesn't exist in our catalog.
//
// FINAL VERDICT: The other AI's calculations contain errors:
// 1. It references transfer IDs that don't exist in our catalog (TR-DXB-BAR-METRO)
// 2. Its hotel prices differ from our catalog
// 3. Its flight totals don't add up consistently
//
// Our engine correctly uses the ACTUAL catalog data:
// Cheapest: ₹91,202 (Dubai 5n)
// Fastest: ₹92,578 (Dubai 5n, closest to DXB airport via Deira taxis 15min each way)
// Best Rated: ₹1,90,130 (Dubai 5n, 5★ Marina Sail Residences)

console.log('\n\nSUMMARY OF DISCREPANCIES:');
console.log('User AI cheapest: ₹87,997 vs Our engine: ₹91,202');
console.log('User AI fastest: ₹88,912 vs Our engine: ₹92,578');
console.log('User AI best rated: ₹1,87,382 vs Our engine: ₹1,90,130');
console.log('\nRoot causes:');
console.log('1. TR-DXB-BAR-METRO does NOT exist in our catalog. User AI fabricated this transfer ID.');
console.log('2. User hotel prices (₹14,561 for Corniche 3n + Barsha 2n) cannot be derived from catalog prices.');
console.log('3. User flight total (₹68,000) for FL-1088 + FL-1180 at catalog prices = (13000+16000)*2 = ₹58,000.');
console.log('4. The user AI wrongly added ₹68,000 (must be a different pair like FL-1088 + FL-1182 AUH->BOM).');
