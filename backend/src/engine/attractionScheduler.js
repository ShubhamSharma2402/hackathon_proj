// src/engine/attractionScheduler.js
// Schedules attractions according to Section 4 rules:
// - Must be in the city of that night's hotel
// - Open on that day (matches open_days, not in closed_dates)
// - Entire visit (visit_minutes) fits inside [open_from, open_until]
// - Visits on the same day do not overlap
// - Each attraction appears in the package at most once
// - Full days: 1-2 attractions
// - Arrival / city-change days: optional, must start AFTER reaching the hotel/city
// - Last day: NO attractions

function getDayOfWeek(dateStr) {
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return days[new Date(dateStr).getDay()];
}

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(totalMins) {
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function scheduleAttractionsForDay(catalog, city, dateStr, earliestStartTimeHHMM, maxCount, usedAttractionIds) {
  const dayOfWeek = getDayOfWeek(dateStr);
  const cityAttractions = catalog.attractionsByCity.get(city) || [];

  const candidates = [];
  for (const att of cityAttractions) {
    if (usedAttractionIds.has(att.attraction_id)) continue;
    if (!att.open_days || !att.open_days.includes(dayOfWeek)) continue;
    if (att.closed_dates && att.closed_dates.includes(dateStr)) continue;

    candidates.push(att);
  }

  const scheduled = [];
  let currentAvailableTimeMins = timeToMinutes(earliestStartTimeHHMM);

  for (const att of candidates) {
    if (scheduled.length >= maxCount) break;

    const openFromMins = timeToMinutes(att.open_from);
    const openUntilMins = timeToMinutes(att.open_until);
    const duration = att.visit_minutes || 60;

    // The visit must start at or after currentAvailableTimeMins and at or after openFromMins
    const visitStartMins = Math.max(currentAvailableTimeMins, openFromMins);
    const visitEndMins = visitStartMins + duration;

    // Must fit inside open hours
    if (visitEndMins <= openUntilMins) {
      const startTime = minutesToTime(visitStartMins);
      const endTime = minutesToTime(visitEndMins);

      scheduled.push({
        attraction: att,
        date: dateStr,
        startDateTime: `${dateStr}T${startTime}`,
        endDateTime: `${dateStr}T${endTime}`,
        durationMinutes: duration,
      });

      usedAttractionIds.add(att.attraction_id);
      // Add a 30-minute buffer between attractions on the same day to avoid rush
      currentAvailableTimeMins = visitEndMins + 30;
    }
  }

  return scheduled;
}

module.exports = {
  scheduleAttractionsForDay,
};
