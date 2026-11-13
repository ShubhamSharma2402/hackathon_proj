// src/engine/cityPlanner.js
// Generates valid city itineraries based on Section 4 rules:
// - All cities in chosen country
// - Each city has at least 2 nights in a row, appears once in the plan
// - Consecutive cities must have a valid transfer link connecting them
// - Sum of nights in all cities equals total trip nights

function getValidCityPlans(countryObj, totalNights) {
  const cities = countryObj.cities.map(c => c.name);
  const links = countryObj.links || [];
  
  // Set of valid transitions "fromCity->toCity"
  const validTransitions = new Set();
  for (const link of links) {
    validTransitions.add(`${link.from_city}->${link.to_city}`);
  }

  const validPlans = [];

  // Determine possible number of cities:
  // Since each city needs at least 2 nights, max cities = Math.floor(totalNights / 2)
  const maxCities = Math.min(cities.length, Math.floor(totalNights / 2));

  // Find all partitions of totalNights into `k` parts where each part >= 2
  function getPartitions(n, k, minVal = 2) {
    if (k === 1) {
      return n >= minVal ? [[n]] : [];
    }
    const result = [];
    for (let first = minVal; first <= n - (k - 1) * minVal; first++) {
      const subPartitions = getPartitions(n - first, k - 1, minVal);
      for (const sub of subPartitions) {
        result.push([first, ...sub]);
      }
    }
    return result;
  }

  // Backtracking to find city permutations of length k
  function searchCitySequences(currentPath, visited) {
    const k = currentPath.length;
    if (k >= 1 && k <= maxCities) {
      // For this sequence of cities, find all valid night allocations
      const partitions = getPartitions(totalNights, k, 2);
      for (const part of partitions) {
        validPlans.push({
          cities: [...currentPath],
          nights: [...part],
        });
      }
    }

    if (k === maxCities) return;

    for (const city of cities) {
      if (!visited.has(city)) {
        if (currentPath.length === 0 || validTransitions.has(`${currentPath[currentPath.length - 1]}->${city}`)) {
          visited.add(city);
          currentPath.push(city);
          searchCitySequences(currentPath, visited);
          currentPath.pop();
          visited.delete(city);
        }
      }
    }
  }

  searchCitySequences([], new Set());

  // Heuristic sort: prefer multi-city plans (2 or 3 cities) for trips >= 5 nights,
  // and balanced nights (e.g. 3+3 or 2+4)
  validPlans.sort((a, b) => {
    // Prefer more cities if totalNights >= 5
    if (totalNights >= 5) {
      if (b.cities.length !== a.cities.length) {
        return b.cities.length - a.cities.length;
      }
    }
    return 0;
  });

  return validPlans;
}

module.exports = {
  getValidCityPlans,
};
