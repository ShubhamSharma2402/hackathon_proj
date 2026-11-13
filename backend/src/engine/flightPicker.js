// src/engine/flightPicker.js
// Handles flight selection according to Section 4 rules:
// - Arrival flight from departure airport to an airport serving the first city
// - Arrival flight lands on holiday start date (local time)
// - Return flight leaves on last day (local time) from an airport serving the last city to departure airport
// - seats_left >= total travelers (adults + children)
// Availability is NOT decreased on booking — multiple travelers can book packages freely.

function findArrivalFlights(catalog, departureAirport, firstCity, startDate, travelersCount) {
  const matchingAirports = [];
  for (const [code, airport] of catalog.airports.entries()) {
    if (airport.serves_cities && airport.serves_cities.includes(firstCity)) {
      matchingAirports.push(code);
    }
  }

  const validFlights = [];
  for (const destAirport of matchingAirports) {
    const key = `${departureAirport}|${destAirport}|arr:${startDate}`;
    const flights = catalog.flightsByRoute.get(key) || [];
    for (const flight of flights) {
      if (flight.seats_left >= travelersCount) {
        validFlights.push(flight);
      }
    }
  }

  validFlights.sort((a, b) => a.price_per_seat.amount - b.price_per_seat.amount);
  return validFlights;
}

function findReturnFlights(catalog, departureAirport, lastCity, returnDate, travelersCount) {
  const matchingAirports = [];
  for (const [code, airport] of catalog.airports.entries()) {
    if (airport.serves_cities && airport.serves_cities.includes(lastCity)) {
      matchingAirports.push(code);
    }
  }

  const validFlights = [];
  for (const originAirport of matchingAirports) {
    const key = `${originAirport}|${departureAirport}|dep:${returnDate}`;
    const flights = catalog.flightsByRoute.get(key) || [];
    for (const flight of flights) {
      if (flight.seats_left >= travelersCount) {
        validFlights.push(flight);
      }
    }
  }

  validFlights.sort((a, b) => a.price_per_seat.amount - b.price_per_seat.amount);
  return validFlights;
}

module.exports = {
  findArrivalFlights,
  findReturnFlights,
};
