// src/engine/transferPicker.js
// Handles selection of:
// 1. Arrival airport transfer (airport -> first hotel)
// 2. Return airport transfer (last hotel -> airport)
// 3. City-to-city transfers between consecutive cities

function isTimeWithinWindow(timeHHMM, serviceFrom, serviceUntil) {
  if (!serviceFrom || !serviceUntil) return true;
  if (serviceFrom <= serviceUntil) {
    return timeHHMM >= serviceFrom && timeHHMM <= serviceUntil;
  } else {
    // Window spans midnight (e.g. 06:00 to 01:00)
    return timeHHMM >= serviceFrom || timeHHMM <= serviceUntil;
  }
}

function addMinutesToTime(timeStr, minutes) {
  // timeStr can be "YYYY-MM-DDTHH:MM:SS" or "YYYY-MM-DDTHH:MM"
  const date = new Date(timeStr.length === 16 ? timeStr + ':00' : timeStr);
  date.setMinutes(date.getMinutes() + minutes);
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

function findArrivalAirportTransfer(catalog, airportCode, hotel) {
  // Transfer must serve the hotel's city and either hotel's area or area: null (all areas)
  const candidates = [];
  for (const transfer of catalog.allTransfers) {
    if (transfer.airport === airportCode && transfer.city === hotel.city) {
      if (transfer.area === null || transfer.area === hotel.area) {
        candidates.push(transfer);
      }
    }
  }
  return candidates;
}

function findReturnAirportTransfer(catalog, hotel, airportCode) {
  const candidates = [];
  for (const transfer of catalog.allTransfers) {
    if (transfer.airport === airportCode && transfer.city === hotel.city) {
      if (transfer.area === null || transfer.area === hotel.area) {
        candidates.push(transfer);
      }
    }
  }
  return candidates;
}

function findIntercityTransfers(catalog, fromCity, toCity) {
  const candidates = [];
  for (const transfer of catalog.allTransfers) {
    if (transfer.from_city === fromCity && transfer.to_city === toCity) {
      candidates.push(transfer);
    }
  }
  return candidates;
}

module.exports = {
  isTimeWithinWindow,
  addMinutesToTime,
  findArrivalAirportTransfer,
  findReturnAirportTransfer,
  findIntercityTransfers,
};
