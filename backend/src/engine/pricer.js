// src/engine/pricer.js
// Strict pricing calculations as defined in Section 4 of the problem statement.
// All prices in INR whole numbers.

function calcFlightPrice(flight, travelersCount) {
  const pricePerSeat = flight.price_per_seat.amount;
  return pricePerSeat * travelersCount;
}

function calcHotelPrice(room, roomsCount, nightsCount) {
  const pricePerNight = room.price_per_night.amount;
  return pricePerNight * roomsCount * nightsCount;
}

function calcTransferPrice(transfer, adults, children) {
  const totalTravelers = adults + children;
  if (transfer.pricing === 'PER_PERSON') {
    const adultPrice = transfer.price.amount;
    const childPrice = transfer.child_price ? transfer.child_price.amount : adultPrice;
    return (adults * adultPrice) + (children * childPrice);
  } else {
    // PER_VEHICLE
    const maxPassengers = transfer.max_passengers || 4;
    const vehicles = Math.ceil(totalTravelers / maxPassengers);
    return transfer.price.amount * vehicles;
  }
}

function calcAttractionPrice(attraction, adults, children) {
  const adultPrice = attraction.price_per_person.amount;
  const childPrice = attraction.child_price ? attraction.child_price.amount : adultPrice;
  return (adults * adultPrice) + (children * childPrice);
}

module.exports = {
  calcFlightPrice,
  calcHotelPrice,
  calcTransferPrice,
  calcAttractionPrice,
};
