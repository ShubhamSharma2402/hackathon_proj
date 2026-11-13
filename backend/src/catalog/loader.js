// catalog/loader.js
// Reads all 7 JSON data files ONCE at startup and builds fast lookup maps.
// Every engine function uses these maps — no file reads during requests.

const fs   = require('fs');
const path = require('path');

// Helper: read a JSON file relative to the data/catalog directory
function load(filename) {
  const filePath = path.join(__dirname, '../../data/catalog', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// --- Load raw data ---
const destinations  = load('destinations.json');
const airportsRaw   = load('airports.json');
const flightsRaw    = load('flights.json');
const hotelsRaw     = load('hotels.json');
const roomsRaw      = load('rooms.json');
const availRaw      = load('availability.json');
const transfersRaw  = load('transfers.json');
const attractionsRaw = load('attractions.json');

// --- Build lookup Maps for O(1) access ---

// airports: code → airport object
const airports = new Map(airportsRaw.map(a => [a.code, a]));

// flights: flight_id → flight object
const flights = new Map(flightsRaw.map(f => [f.flight_id, f]));

// hotels: hotel_id → hotel object
const hotels = new Map(hotelsRaw.map(h => [h.hotel_id, h]));

// rooms: room_id → room object
const rooms = new Map(roomsRaw.map(r => [r.room_id, r]));

// roomsByHotel: hotel_id → [room objects]  (to quickly get all rooms for a hotel)
const roomsByHotel = new Map();
for (const room of roomsRaw) {
  if (!roomsByHotel.has(room.hotel_id)) roomsByHotel.set(room.hotel_id, []);
  roomsByHotel.get(room.hotel_id).push(room);
}

// hotelsByCity: city name → [hotel objects]  (to quickly get all hotels in a city)
const hotelsByCity = new Map();
for (const hotel of hotelsRaw) {
  if (!hotelsByCity.has(hotel.city)) hotelsByCity.set(hotel.city, []);
  hotelsByCity.get(hotel.city).push(hotel);
}

// availability: "room_id|date" → rooms_left  (fast night-by-night availability check)
const availability = new Map();
for (const avail of availRaw) {
  const key = `${avail.room_id}|${avail.date}`;
  availability.set(key, avail.rooms_left);
}

// transfers: transfer_id → transfer object
const transfers = new Map(transfersRaw.map(t => [t.transfer_id, t]));

// attractions: attraction_id → attraction object
const attractions = new Map(attractionsRaw.map(a => [a.attraction_id, a]));

// attractionsByCity: city → [attraction objects]
const attractionsByCity = new Map();
for (const att of attractionsRaw) {
  if (!attractionsByCity.has(att.city)) attractionsByCity.set(att.city, []);
  attractionsByCity.get(att.city).push(att);
}

// flightsByRoute: "from|to|date" → [flight objects]  (fast flight lookup by route + date)
const flightsByRoute = new Map();
for (const flight of flightsRaw) {
  const date = flight.arrival_local.slice(0, 10); // "YYYY-MM-DD" of arrival
  const depDate = flight.departure_local.slice(0, 10);
  // Index by arrival date (for arrival flights) and departure date (for return flights)
  const keyArr = `${flight.from}|${flight.to}|arr:${date}`;
  const keyDep = `${flight.from}|${flight.to}|dep:${depDate}`;
  if (!flightsByRoute.has(keyArr)) flightsByRoute.set(keyArr, []);
  if (!flightsByRoute.has(keyDep)) flightsByRoute.set(keyDep, []);
  flightsByRoute.get(keyArr).push(flight);
  flightsByRoute.get(keyDep).push(flight);
}

console.log(`✅ Catalog loaded: ${flightsRaw.length} flights, ${hotelsRaw.length} hotels, ` +
            `${roomsRaw.length} rooms, ${attractionsRaw.length} attractions, ` +
            `${transfersRaw.length} transfers`);

// Export everything — the engine functions import from here
module.exports = {
  destinations,       // raw destinations object (has departure_cities, countries, rules)
  airports,           // Map: code → airport
  flights,            // Map: flight_id → flight
  flightsByRoute,     // Map: "from|to|arr:date" or "from|to|dep:date" → [flights]
  hotels,             // Map: hotel_id → hotel
  hotelsByCity,       // Map: city → [hotels]
  rooms,              // Map: room_id → room
  roomsByHotel,       // Map: hotel_id → [rooms]
  availability,       // Map: "room_id|date" → rooms_left
  transfers,          // Map: transfer_id → transfer
  attractions,        // Map: attraction_id → attraction
  attractionsByCity,  // Map: city → [attractions]
  allFlights:    flightsRaw,
  allTransfers:  transfersRaw,
};
