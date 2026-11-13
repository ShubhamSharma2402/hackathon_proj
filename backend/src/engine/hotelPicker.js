// src/engine/hotelPicker.js
// Handles hotel and room selection according to Section 4 rules:
// - One hotel and one room type for all nights in a given city
// - k rooms fit travelers:
//     adults <= k * room.max_adults
//     adults + children <= k * (room.max_adults + room.max_children)
//     adults >= k
// - rooms_left >= k on every night of the stay
// Availability is NOT decreased on booking — multiple travelers can book packages freely.

function calculateRoomsNeeded(room, adults, children) {
  const maxA = room.max_adults;
  const maxC = room.max_children;
  const total = adults + children;

  for (let k = 1; k <= 10; k++) {
    const fitsAdults = adults <= k * maxA;
    const fitsTotal = total <= k * (maxA + maxC);
    const adultsGteK = adults >= k;
    if (fitsAdults && fitsTotal && adultsGteK) {
      return k;
    }
  }
  return null;
}

function findValidHotelsForCity(catalog, city, checkInDate, checkOutDate, adults, children) {
  const dates = [];
  let curr = new Date(checkInDate);
  const end = new Date(checkOutDate);
  while (curr < end) {
    dates.push(curr.toISOString().slice(0, 10));
    curr.setDate(curr.getDate() + 1);
  }

  const cityHotels = catalog.hotelsByCity.get(city) || [];
  const validOptions = [];

  for (const hotel of cityHotels) {
    const rooms = catalog.roomsByHotel.get(hotel.hotel_id) || [];
    for (const room of rooms) {
      const k = calculateRoomsNeeded(room, adults, children);
      if (!k) continue;

      // Check availability on EVERY night against catalog
      const isAvailableAllNights = dates.every(date => {
        const key = `${room.room_id}|${date}`;
        const catalogLeft = catalog.availability.get(key) ?? 0;
        return catalogLeft >= k;
      });

      if (isAvailableAllNights) {
        const totalPrice = room.price_per_night.amount * k * dates.length;
        validOptions.push({
          hotel,
          room,
          roomsCount: k,
          nightsCount: dates.length,
          dates,
          totalPrice,
          stars: hotel.stars || 3,
        });
      }
    }
  }

  validOptions.sort((a, b) => a.totalPrice - b.totalPrice);
  return validOptions;
}

module.exports = {
  calculateRoomsNeeded,
  findValidHotelsForCity,
};
