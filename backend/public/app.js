// app.js — Frontend client logic for Build My Holiday
// Connects UI directly to the Express backend APIs

let currentPackage = null;
let currentAlternatives = null;
let currentPackageCards = [];
let catalogFormData = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  renderChildAgeInputs();
  await loadCatalogFormData();

  // If a package ID is stored in localStorage or URL, restore it!
  const savedPkgId = localStorage.getItem('bmh_current_pkg_id');
  if (savedPkgId) {
    try {
      const res = await fetch(`/api/packages/${savedPkgId}`);
      if (res.ok) {
        const pkg = await res.json();
        renderPackage(pkg);
      }
    } catch (e) {
      console.warn('Could not restore saved package:', e);
    }
  }
});

// Tab Navigation
function showTab(tabId) {
  document.querySelectorAll('main > section').forEach(sec => sec.classList.add('hidden'));
  document.getElementById(tabId).classList.remove('hidden');

  // Update nav buttons styling
  const navMap = {
    'tab-plan': 'nav-plan',
    'tab-package': 'nav-package',
    'tab-lookup': 'nav-lookup'
  };

  ['nav-plan', 'nav-package', 'nav-lookup'].forEach(id => {
    const btn = document.getElementById(id);
    if (id === navMap[tabId]) {
      btn.className = 'px-3 py-1.5 rounded-lg font-medium bg-indigo-700 text-white';
    } else {
      btn.className = 'px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-700 text-indigo-100';
    }
  });
}

// Alerts / Notifications
function showAlert(type, title, desc) {
  const box = document.getElementById('alert-box');
  const icon = document.getElementById('alert-icon');
  const tEl = document.getElementById('alert-title');
  const dEl = document.getElementById('alert-desc');

  box.classList.remove('hidden', 'bg-red-50', 'border-red-200', 'text-red-900', 'bg-emerald-50', 'border-emerald-200', 'text-emerald-900', 'bg-amber-50', 'border-amber-200', 'text-amber-900');

  if (type === 'error') {
    box.classList.add('bg-red-50', 'border-red-200', 'text-red-900');
    icon.innerHTML = '⚠️';
  } else if (type === 'success') {
    box.classList.add('bg-emerald-50', 'border-emerald-200', 'text-emerald-900');
    icon.innerHTML = '✅';
  } else if (type === 'warning') {
    box.classList.add('bg-amber-50', 'border-amber-200', 'text-amber-900');
    icon.innerHTML = '💡';
  }

  tEl.textContent = title;
  dEl.textContent = desc;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function dismissAlert() {
  document.getElementById('alert-box').classList.add('hidden');
}

// Load Form Data (M1)
async function loadCatalogFormData() {
  try {
    const res = await fetch('/api/catalog/form-data');
    catalogFormData = await res.json();

    const depList = document.getElementById('departure-cities-list');
    if (depList) {
      depList.innerHTML = catalogFormData.departureCities
        .map(c => `<option value="${c.airport}">${c.city} (${c.airport})</option>`)
        .join('');
    }

    const countryList = document.getElementById('destination-countries-list');
    if (countryList) {
      countryList.innerHTML = catalogFormData.countries
        .map(c => `<option value="${c.name}">${c.name}</option>`)
        .join('');
    }

    // Set defaults if empty
    if (!document.getElementById('form-departure').value) {
      document.getElementById('form-departure').value = catalogFormData.departureCities[0]?.airport || 'BLR';
    }
    if (!document.getElementById('form-country').value) {
      document.getElementById('form-country').value = catalogFormData.countries[0]?.name || 'Japan';
    }
  } catch (err) {
    showAlert('error', 'Server Error', 'Failed to connect to backend API. Please make sure backend is running.');
  }
}

// Dynamic Child Ages (M1)
function renderChildAgeInputs() {
  const count = parseInt(document.getElementById('form-children').value) || 0;
  const container = document.getElementById('child-ages-container');
  container.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const div = document.createElement('div');
    div.className = 'flex items-center space-x-1 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs';
    div.innerHTML = `
      <span class="text-slate-600 font-medium">Child ${i + 1} Age:</span>
      <input type="number" min="0" max="17" value="6" class="child-age-input w-12 border rounded px-1.5 py-0.5 text-center font-bold">
    `;
    container.appendChild(div);
  }
}

// Quick Demo Presets
function loadMenonPreset() {
  document.getElementById('form-departure').value = 'BLR';
  document.getElementById('form-country').value = 'Japan';
  document.getElementById('form-start-date').value = '2027-04-10';
  document.getElementById('form-nights').value = '6';
  document.getElementById('form-adults').value = '2';
  document.getElementById('form-children').value = '1';
  renderChildAgeInputs();
  const ageInputs = document.querySelectorAll('.child-age-input');
  if (ageInputs[0]) ageInputs[0].value = '6';
  document.getElementById('form-budget').value = '350000';
  showAlert('success', 'Preset Loaded', 'Menon family parameters filled (BLR → Japan, 6 nights, 2 adults + 1 child age 6, ₹3,50,000).');
}

function loadUaePreset() {
  document.getElementById('form-departure').value = 'DEL';
  document.getElementById('form-country').value = 'United Arab Emirates';
  document.getElementById('form-start-date').value = '2027-04-05';
  document.getElementById('form-nights').value = '5';
  document.getElementById('form-adults').value = '2';
  document.getElementById('form-children').value = '0';
  renderChildAgeInputs();
  document.getElementById('form-budget').value = '250000';
  showAlert('success', 'Preset Loaded', 'UAE holiday parameters filled (DEL → UAE, 5 nights, 2 adults, ₹2,50,000).');
}

// Plain Language Parser (Stretch S1: No AI rule-based extractor)
function parseQuickInput() {
  const text = document.getElementById('quick-input-text').value.toLowerCase();
  if (!text.trim()) return;

  // City match
  if (text.includes('bengaluru') || text.includes('blr') || text.includes('bangalore')) document.getElementById('form-departure').value = 'BLR';
  if (text.includes('delhi') || text.includes('del')) document.getElementById('form-departure').value = 'DEL';
  if (text.includes('mumbai') || text.includes('bom')) document.getElementById('form-departure').value = 'BOM';
  if (text.includes('chennai') || text.includes('maa')) document.getElementById('form-departure').value = 'MAA';

  // Country match
  if (text.includes('japan') || text.includes('tokyo') || text.includes('kyoto') || text.includes('osaka')) document.getElementById('form-country').value = 'Japan';
  if (text.includes('uae') || text.includes('dubai') || text.includes('abu dhabi')) document.getElementById('form-country').value = 'United Arab Emirates';

  // Nights match
  const nightsMatch = text.match(/(\d+)\s*night/);
  if (nightsMatch) document.getElementById('form-nights').value = nightsMatch[1];

  // Adults match
  const adultsMatch = text.match(/(\d+)\s*adult/);
  if (adultsMatch) document.getElementById('form-adults').value = adultsMatch[1];

  // Children match
  const childrenMatch = text.match(/(\d+)\s*child/);
  if (childrenMatch) {
    document.getElementById('form-children').value = childrenMatch[1];
    renderChildAgeInputs();
  }

  // Budget match
  const budgetMatch = text.match(/budget\s*(?:of|is|:)?\s*(?:₹|inr|rs\.?)?\s*([\d,]+)/) || text.match(/([\d,]+)\s*(?:budget|inr|rupees)/);
  if (budgetMatch) {
    const rawNum = budgetMatch[1].replace(/,/g, '');
    document.getElementById('form-budget').value = rawNum;
  }

  showAlert('success', 'Quick Request Extracted', 'Extracted form parameters using rule-based parsing (no AI).');
}

// Form Submission -> Build Package (M1, M2, M8)
async function handleFormSubmit(e) {
  e.preventDefault();
  dismissAlert();

  const childAges = Array.from(document.querySelectorAll('.child-age-input')).map(el => parseInt(el.value) || 0);

  const payload = {
    departureAirport: document.getElementById('form-departure').value,
    departureCity: document.getElementById('form-departure').selectedOptions[0]?.text.split(' (')[0] || '',
    country: document.getElementById('form-country').value,
    startDate: document.getElementById('form-start-date').value,
    nights: parseInt(document.getElementById('form-nights').value),
    adults: parseInt(document.getElementById('form-adults').value),
    children: parseInt(document.getElementById('form-children').value) || 0,
    childAges,
    budgetInr: parseInt(document.getElementById('form-budget').value),
  };

  const btn = document.getElementById('btn-build');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> Building Package...';

  try {
    const res = await fetch('/api/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (data.status === 'BUDGET_TOO_SMALL') {
      // M8: Budget Too Small
      currentPackage = data.package;
      localStorage.setItem('bmh_current_pkg_id', data.package.packageId);
      renderPackage(data.package);
      showTab('tab-package');
      showAlert('warning', 'Budget Too Small (M8)', `${data.suggestion}`);
      return;
    }

    if (data.status === 'ERROR' || !res.ok) {
      // Requirement 1: If there are no available packages (e.g. source/destination different than dataset), return clear text
      showAlert('error', 'No Package Available', data.message || 'There are no available packages for this request.');
      return;
    }

    currentPackage = data.package;
    currentAlternatives = data.alternatives;
    currentPackageCards = data.packageCards || [];
    localStorage.setItem('bmh_current_pkg_id', data.package.packageId);

    renderPackage(data.package, data.availableCityPlans);
    showTab('tab-package');
    showAlert('success', 'Holiday Packages Calculated!', `Calculated all valid packages and selected the top options below.`);
  } catch (err) {
    showAlert('error', 'Network Error', 'Failed to communicate with backend.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

// Render Package View (M4, M5)
function renderPackage(pkg, availableCityPlans = null) {
  currentPackage = pkg;

  // Header and Status
  const statusBadge = document.getElementById('pkg-status-badge');
  statusBadge.textContent = pkg.status;
  if (pkg.status === 'BOOKED') {
    statusBadge.className = 'badge bg-emerald-100 text-emerald-800 font-bold';
    document.getElementById('confirmed-card').classList.remove('hidden');
    document.getElementById('confirmed-res-number').textContent = `Reservation #${pkg.reservationNumber}`;
    document.getElementById('btn-confirm-booking').disabled = true;
    document.getElementById('btn-confirm-booking').classList.add('opacity-50', 'cursor-not-allowed');
  } else {
    statusBadge.className = 'badge bg-amber-100 text-amber-800 font-bold';
    document.getElementById('confirmed-card').classList.add('hidden');
    document.getElementById('btn-confirm-booking').disabled = false;
    document.getElementById('btn-confirm-booking').classList.remove('opacity-50', 'cursor-not-allowed');
  }

  document.getElementById('pkg-id-text').textContent = `ID: ${pkg.packageId.slice(0, 8)}...`;
  document.getElementById('pkg-title').textContent = `${pkg.request.country}: ${pkg.cityPlan.join(' → ')}`;
  document.getElementById('pkg-subtitle').textContent = 
    `${pkg.request.nights} Nights (${pkg.request.startDate} to ${addDays(pkg.request.startDate, pkg.request.nights)}) • ${pkg.request.adults} Adults${pkg.request.children ? `, ${pkg.request.children} Children` : ''}`;

  // Budget Gauge
  const budget = pkg.request.budgetInr;
  const total = pkg.totalInr;
  const diff = budget - total;

  document.getElementById('pkg-total-cost').textContent = `₹${total.toLocaleString('en-IN')}`;
  document.getElementById('pkg-budget').textContent = `₹${budget.toLocaleString('en-IN')}`;

  const diffCard = document.getElementById('pkg-budget-status-card');
  const diffLabel = document.getElementById('pkg-budget-status-label');
  const diffVal = document.getElementById('pkg-budget-diff');

  if (diff >= 0) {
    diffCard.className = 'bg-emerald-50 p-3.5 rounded-xl border border-emerald-100';
    diffLabel.className = 'text-xs text-emerald-700 uppercase tracking-wider font-semibold';
    diffLabel.textContent = 'Under Budget (Savings)';
    diffVal.className = 'text-2xl font-extrabold text-emerald-700 mt-0.5';
    diffVal.textContent = `₹${diff.toLocaleString('en-IN')}`;
  } else {
    diffCard.className = 'bg-red-50 p-3.5 rounded-xl border border-red-100';
    diffLabel.className = 'text-xs text-red-700 uppercase tracking-wider font-semibold';
    diffLabel.textContent = 'Over Budget';
    diffVal.className = 'text-2xl font-extrabold text-red-700 mt-0.5';
    diffVal.textContent = `-₹${Math.abs(diff).toLocaleString('en-IN')}`;
  }

  // Render 3 Packages Cards (G4)
  renderThreePackagesCards(pkg);

  // Render City Plans (G3)
  renderCityPlanPills(pkg, availableCityPlans);

  // Day-by-Day Timeline (M4)
  renderTimeline(pkg);
}

// Render the 3 (or available) calculated package cards
function renderThreePackagesCards(activePkg) {
  const container = document.getElementById('three-packages-grid');
  const countSpan = document.getElementById('three-pkg-count');
  if (!container) return;

  const cards = currentPackageCards && currentPackageCards.length > 0
    ? currentPackageCards
    : [
        {
          category: 'cheapest',
          title: 'Cheapest',
          badge: '💰 Lowest Total Price',
          description: 'Best overall value for your budget.',
          package: activePkg,
        }
      ];

  if (countSpan) countSpan.textContent = cards.length;

  container.innerHTML = cards.map(c => {
    const isSelected = activePkg && activePkg.packageId === c.package.packageId;
    const travelHours = Math.floor(c.package.metrics.travelMinutes / 60);
    const travelMins = c.package.metrics.travelMinutes % 60;
    const stars = c.package.metrics.avgHotelStars || 3;

    return `
      <div class="rounded-xl border p-4 transition cursor-pointer flex flex-col justify-between ${isSelected ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-500 shadow-sm' : 'border-slate-200 bg-white hover:border-indigo-300'}"
           onclick="selectPackageCard('${c.package.packageId}')">
        <div>
          <div class="flex items-center justify-between">
            <span class="badge ${c.category === 'cheapest' ? 'bg-emerald-100 text-emerald-800' : c.category === 'fastest' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'} text-[11px]">
              ${c.badge}
            </span>
            ${isSelected ? '<span class="text-xs font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">Selected</span>' : ''}
          </div>

          <div class="mt-3">
            <div class="text-2xl font-black text-slate-900">₹${c.package.totalInr.toLocaleString('en-IN')}</div>
            <p class="text-xs text-slate-500 font-medium mt-0.5">${c.package.cityPlan.join(' → ')} (${c.package.request.nights} Nights)</p>
          </div>

          <div class="mt-3 space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-2.5">
            <div class="flex items-center justify-between">
              <span class="text-slate-400">Total Travel Duration:</span>
              <span class="font-bold text-slate-800">${travelHours}h ${travelMins}m</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400">Avg Hotel Rating:</span>
              <span class="font-bold text-amber-600">${stars} ★</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-400">Flight + Hotel items:</span>
              <span class="font-bold text-slate-800">${c.package.items.length} items</span>
            </div>
          </div>
        </div>

        <button class="mt-4 w-full py-1.5 rounded-lg text-xs font-bold transition ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
          ${isSelected ? 'Currently Viewing' : 'Select This Package'}
        </button>
      </div>
    `;
  }).join('');
}

// Handle clicking a package card
function selectPackageCard(packageId) {
  const cardObj = currentPackageCards.find(c => c.package.packageId === packageId);
  if (cardObj) {
    currentPackage = cardObj.package;
    localStorage.setItem('bmh_current_pkg_id', cardObj.package.packageId);
    renderPackage(cardObj.package);
    showAlert('success', `${cardObj.title} Package Selected`, `Loaded ${cardObj.title} itinerary (₹${cardObj.package.totalInr.toLocaleString('en-IN')}).`);
  }
}

// Render Alternative City Plans (G3)
function renderCityPlanPills(pkg, availableCityPlans) {
  const container = document.getElementById('city-plans-container');
  if (!container) return;

  // If plans not passed, generate quick variations
  const currentPlanStr = pkg.cityPlan.join(' → ');

  const plans = availableCityPlans || [
    { cities: ['Tokyo'], nights: [pkg.request.nights] },
    { cities: ['Tokyo', 'Kyoto'], nights: [Math.floor(pkg.request.nights / 2), Math.ceil(pkg.request.nights / 2)] },
    { cities: ['Tokyo', 'Osaka'], nights: [Math.floor(pkg.request.nights / 2), Math.ceil(pkg.request.nights / 2)] },
  ];

  container.innerHTML = plans.slice(0, 6).map(p => {
    const label = p.cities.map((c, i) => `${c} (${p.nights[i]}N)`).join(' + ');
    const isCurrent = p.cities.length === pkg.cityPlan.length && p.cities.every((c, i) => c === pkg.cityPlan[i]);

    return `
      <button onclick="switchCityPlan(${JSON.stringify(p.cities).replace(/"/g, '&quot;')}, ${JSON.stringify(p.nights).replace(/"/g, '&quot;')})" 
        class="px-2.5 py-1 rounded-lg border text-xs font-medium transition ${isCurrent ? 'bg-indigo-600 text-white border-indigo-600 font-bold' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'}">
        ${label}
      </button>
    `;
  }).join('');
}

// Switch City Plan (G3)
async function switchCityPlan(cities, nights) {
  try {
    const res = await fetch(`/api/packages/${currentPackage.packageId}/change-cities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cities, nights }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(`Could not switch to this city plan: ${data.message || data.error}`);
      return;
    }

    currentPackage = data.package;
    currentAlternatives = data.alternatives;
    renderPackage(data.package);
    showAlert('success', 'City Plan Updated (G3)', `Switched route to ${cities.join(' → ')}. All flights, hotels, and intercity transfers recomputed.`);
  } catch (err) {
    alert('Failed to switch city plan.');
  }
}

// Helper to group items into days
function renderTimeline(pkg) {
  const container = document.getElementById('timeline-container');
  container.innerHTML = '';

  const nights = pkg.request.nights;
  const startDate = pkg.request.startDate;

  // Total days = nights + 1 (day 1 to day nights+1)
  for (let dayIdx = 0; dayIdx <= nights; dayIdx++) {
    const dateStr = addDays(startDate, dayIdx);
    const dayNum = dayIdx + 1;

    // Filter items relevant to this day
    const dayItems = pkg.items.filter(it => {
      if (it.type === 'flight') {
        return it.start.startsWith(dateStr) || it.end.startsWith(dateStr);
      }
      if (it.type === 'hotel') {
        // Hotel active if checkIn <= dateStr < checkOut
        return dateStr >= it.start && dateStr < it.end;
      }
      return it.start && it.start.startsWith(dateStr);
    });

    const isFirstDay = dayIdx === 0;
    const isLastDay = dayIdx === nights;

    let dayTitleBadge = `Day ${dayNum}`;
    if (isFirstDay) dayTitleBadge += ' • Arrival Day';
    else if (isLastDay) dayTitleBadge += ' • Departure Day';
    else dayTitleBadge += ' • Full Day';

    const dayCard = document.createElement('div');
    dayCard.className = 'bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden';

    dayCard.innerHTML = `
      <div class="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <span class="font-extrabold text-indigo-900 text-sm">${dayTitleBadge}</span>
          <span class="text-xs text-slate-500 font-medium">(${dateStr})</span>
        </div>
        ${!isLastDay ? `
          <button onclick="openAddAttractionModal('${dateStr}')" class="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center">
            <i class="fa-solid fa-plus-circle mr-1"></i> Add Attraction
          </button>
        ` : ''}
      </div>
      <div class="p-5 space-y-3">
        ${dayItems.length === 0 ? '<p class="text-xs text-slate-400 italic">No scheduled activities for this day.</p>' : ''}
        ${dayItems.map(it => renderItemCard(it, dateStr)).join('')}
      </div>
    `;

    container.appendChild(dayCard);
  }
}

// Render individual item row
function renderItemCard(item, currentDateStr) {
  let icon = 'fa-tag';
  let badgeClass = 'bg-slate-100 text-slate-700';
  let actionButtons = '';

  if (item.type === 'flight') {
    icon = 'fa-plane-departure text-blue-600';
    badgeClass = 'bg-blue-50 text-blue-700';
    const flightType = item.start.startsWith(currentDateStr) && item.city === currentPackage.cityPlan[0] ? 'arrival' : 'return';
    actionButtons = `
      <button onclick="openChangeFlightModal('${flightType}')" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg border font-medium">
        Change Flight
      </button>
    `;
  } else if (item.type === 'hotel') {
    icon = 'fa-hotel text-amber-600';
    badgeClass = 'bg-amber-50 text-amber-700';
    actionButtons = `
      <button onclick="openChangeHotelModal('${item.city}')" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg border font-medium">
        Change Hotel
      </button>
    `;
  } else if (item.type === 'transfer') {
    icon = 'fa-taxi text-emerald-600';
    badgeClass = 'bg-emerald-50 text-emerald-700';
  } else if (item.type === 'attraction') {
    icon = 'fa-landmark text-purple-600';
    badgeClass = 'bg-purple-50 text-purple-700';
    actionButtons = `
      <button onclick="removeAttraction('${item.catalog_id}')" class="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1">
        <i class="fa-solid fa-trash mr-1"></i> Remove
      </button>
    `;
  }

  let detailText = '';
  if (item.type === 'flight') {
    const depTime = item.start.includes('T') ? item.start.slice(11, 16) : item.start;
    const arrTime = item.end && item.end.includes('T') ? item.end.slice(11, 16) : item.end;
    detailText = `<span><i class="fa-regular fa-clock mr-1"></i> Dep: ${depTime} → Arr: ${arrTime}</span><span>•</span><span><i class="fa-solid fa-chair mr-1"></i> ${item.quantity} Seat(s)</span>`;
  } else if (item.type === 'transfer') {
    const pickupTime = item.start.includes('T') ? item.start.slice(11, 16) : item.start;
    const dropTime = item.end && item.end.includes('T') ? item.end.slice(11, 16) : 'Direct';
    detailText = `<span><i class="fa-regular fa-clock mr-1"></i> Pickup: ${pickupTime} (Arr: ${dropTime})</span><span>•</span><span>${item.quantity} Unit(s)</span>`;
  } else if (item.type === 'hotel') {
    detailText = `<span><i class="fa-regular fa-calendar-check mr-1"></i> ${item.start} to ${item.end}</span><span>•</span><span><i class="fa-solid fa-bed mr-1"></i> ${item.quantity} Room(s)</span>`;
  } else if (item.type === 'attraction') {
    const sTime = item.start.includes('T') ? item.start.slice(11, 16) : item.start;
    const eTime = item.end && item.end.includes('T') ? item.end.slice(11, 16) : '';
    detailText = `<span><i class="fa-regular fa-clock mr-1"></i> ${sTime} - ${eTime}</span><span>•</span><span><i class="fa-solid fa-ticket mr-1"></i> ${item.quantity} Ticket(s)</span>`;
  } else {
    detailText = `<span>${item.quantity ? `Qty: ${item.quantity}` : ''}</span>`;
  }

  return `
    <div class="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 transition">
      <div class="flex items-center space-x-3">
        <div class="w-9 h-9 rounded-xl flex items-center justify-center bg-white border border-slate-200 text-sm shadow-sm">
          <i class="fa-solid ${icon}"></i>
        </div>
        <div>
          <div class="flex items-center space-x-2">
            <span class="badge ${badgeClass} uppercase tracking-wider text-[10px]">${item.type}</span>
            <span class="font-bold text-xs text-slate-800">${item.name}</span>
          </div>
          <div class="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-2">
            ${detailText}
            <span>•</span>
            <span><i class="fa-solid fa-location-dot mr-1"></i> ${item.city}</span>
          </div>
        </div>
      </div>
      <div class="flex items-center space-x-3">
        <div class="text-right">
          <span class="font-extrabold text-sm text-slate-900">₹${item.price_inr.toLocaleString('en-IN')}</span>
        </div>
        ${actionButtons}
      </div>
    </div>
  `;
}

// Modal: Change Hotel (M6, G2)
async function openChangeHotelModal(city) {
  const modal = document.getElementById('modal-hotel');
  const title = document.getElementById('modal-hotel-title');
  const list = document.getElementById('modal-hotel-list');

  title.textContent = `Change Hotel in ${city}`;
  list.innerHTML = '<div class="text-center py-4 text-xs text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading available hotels...</div>';
  modal.classList.remove('hidden');

  const currentHotelItem = currentPackage.items.find(it => it.type === 'hotel' && it.city === city);
  const currentPrice = currentHotelItem ? currentHotelItem.price_inr : 0;

  try {
    const res = await fetch(`/api/catalog/hotels?city=${city}&checkIn=${currentHotelItem.start}&checkOut=${currentHotelItem.end}&adults=${currentPackage.request.adults}&children=${currentPackage.request.children}`);
    const hotels = await res.json();

    if (hotels.length === 0) {
      list.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">No alternative hotels available with sufficient capacity.</p>';
      return;
    }

    list.innerHTML = hotels.map(opt => {
      const isSelected = currentHotelItem && currentHotelItem.catalog_id === opt.hotel.hotel_id;
      const diff = opt.totalPrice - currentPrice;
      const diffBadge = diff === 0 ? '<span class="text-slate-400 font-bold">Current</span>' : 
        diff > 0 ? `<span class="text-red-600 font-bold">+₹${diff.toLocaleString('en-IN')}</span>` :
                   `<span class="text-emerald-600 font-bold">-₹${Math.abs(diff).toLocaleString('en-IN')}</span>`;

      return `
        <div class="p-3 border rounded-xl flex items-center justify-between ${isSelected ? 'border-indigo-500 bg-indigo-50/30' : 'hover:border-slate-300'}">
          <div>
            <div class="flex items-center space-x-1.5">
              <span class="font-bold text-xs text-slate-900">${opt.hotel.name}</span>
              <span class="text-[11px] text-amber-500">${'★'.repeat(opt.hotel.stars || 3)}</span>
            </div>
            <div class="text-[11px] text-slate-500 mt-0.5">
              ${opt.room.name} (${opt.roomsNeeded} room${opt.roomsNeeded > 1 ? 's' : ''}) • ${opt.hotel.area || city}
            </div>
          </div>
          <div class="text-right flex items-center space-x-3">
            <div>
              <div class="font-extrabold text-xs text-slate-900">₹${opt.totalPrice.toLocaleString('en-IN')}</div>
              <div class="text-[10px]">${diffBadge}</div>
            </div>
            ${!isSelected ? `
              <button onclick="submitHotelChange('${city}', '${opt.hotel.hotel_id}', '${opt.room.room_id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition">
                Select
              </button>
            ` : '<span class="text-xs text-indigo-700 font-bold px-2">Active</span>'}
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    list.innerHTML = '<p class="text-xs text-red-500 text-center py-4">Failed to load hotels.</p>';
  }
}

async function submitHotelChange(city, hotelId, roomId) {
  try {
    const res = await fetch(`/api/packages/${currentPackage.packageId}/hotel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city, hotelId, roomId }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(`Could not change hotel: ${data.errors ? data.errors.join(', ') : data.error}`);
      return;
    }

    closeModal('modal-hotel');
    renderPackage(data.package);
    showAlert('success', 'Hotel Updated', data.message);
  } catch (e) {
    alert('Failed to update hotel.');
  }
}

// Modal: Change Flight (M6, G2)
async function openChangeFlightModal(type) {
  const modal = document.getElementById('modal-flight');
  const title = document.getElementById('modal-flight-title');
  const list = document.getElementById('modal-flight-list');

  title.textContent = `Change ${type === 'arrival' ? 'Arrival' : 'Return'} Flight`;
  list.innerHTML = '<div class="text-center py-4 text-xs text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Loading available flights...</div>';
  modal.classList.remove('hidden');

  const currentFlight = currentPackage.items.find(it => it.type === 'flight' && (type === 'arrival' ? it.start.startsWith(currentPackage.request.startDate) : !it.start.startsWith(currentPackage.request.startDate)));
  const currentPrice = currentFlight ? currentFlight.price_inr : 0;

  const depAirport = currentPackage.request.departureAirport;
  const firstCity = currentPackage.cityPlan[0];
  const lastCity = currentPackage.cityPlan[currentPackage.cityPlan.length - 1];

  let url = '';
  if (type === 'arrival') {
    url = `/api/catalog/flights?from=${depAirport}&to=NRT&date=${currentPackage.request.startDate}&type=arrival`;
  } else {
    const returnDate = addDays(currentPackage.request.startDate, currentPackage.request.nights);
    url = `/api/catalog/flights?from=KIX&to=${depAirport}&date=${returnDate}&type=return`;
  }

  try {
    const res = await fetch(url);
    const flights = await res.json();

    if (flights.length === 0) {
      list.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">No alternative flights found for this date.</p>';
      return;
    }

    const totalTravelers = currentPackage.request.adults + (currentPackage.request.children || 0);

    list.innerHTML = flights.map(f => {
      const isSelected = currentFlight && currentFlight.catalog_id === f.flight_id;
      const flightTotal = f.price_per_seat.amount * totalTravelers;
      const diff = flightTotal - currentPrice;
      const diffBadge = diff === 0 ? '<span class="text-slate-400 font-bold">Current</span>' : 
        diff > 0 ? `<span class="text-red-600 font-bold">+₹${diff.toLocaleString('en-IN')}</span>` :
                   `<span class="text-emerald-600 font-bold">-₹${Math.abs(diff).toLocaleString('en-IN')}</span>`;

      return `
        <div class="p-3 border rounded-xl flex items-center justify-between ${isSelected ? 'border-indigo-500 bg-indigo-50/30' : 'hover:border-slate-300'}">
          <div>
            <div class="font-bold text-xs text-slate-900">${f.airline} ${f.flight_number} (${f.from} → ${f.to})</div>
            <div class="text-[11px] text-slate-500 mt-0.5">
              Dep: ${f.departure_local.slice(11, 16)} • Arr: ${f.arrival_local.slice(11, 16)} • ${f.duration_minutes}m • ${f.seats_left} seats left
            </div>
          </div>
          <div class="text-right flex items-center space-x-3">
            <div>
              <div class="font-extrabold text-xs text-slate-900">₹${flightTotal.toLocaleString('en-IN')}</div>
              <div class="text-[10px]">${diffBadge}</div>
            </div>
            ${!isSelected ? `
              <button onclick="submitFlightChange('${type}', '${f.flight_id}')" class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition">
                Select
              </button>
            ` : '<span class="text-xs text-indigo-700 font-bold px-2">Active</span>'}
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    list.innerHTML = '<p class="text-xs text-red-500 text-center py-4">Failed to load flights.</p>';
  }
}

async function submitFlightChange(type, flightId) {
  try {
    const res = await fetch(`/api/packages/${currentPackage.packageId}/flight`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, flightId }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(`Could not change flight: ${data.errors ? data.errors.join(', ') : data.error}`);
      return;
    }

    closeModal('modal-flight');
    renderPackage(data.package);
    showAlert('success', 'Flight Updated', 'Flight and transfer pickup times recalculated.');
  } catch (e) {
    alert('Failed to update flight.');
  }
}

// Modal: Add Attraction (M6)
async function openAddAttractionModal(dateStr) {
  const modal = document.getElementById('modal-attraction');
  const title = document.getElementById('modal-attraction-title');
  const list = document.getElementById('modal-attraction-list');

  // Identify city for this date
  let activeCity = currentPackage.cityPlan[0];
  let checkIn = currentPackage.request.startDate;
  for (const city of currentPackage.cityPlan) {
    const nightsInCity = currentPackage.nightsPerCity[city];
    const checkOut = addDays(checkIn, nightsInCity);
    if (dateStr >= checkIn && dateStr < checkOut) {
      activeCity = city;
      break;
    }
    checkIn = checkOut;
  }

  title.textContent = `Add Attraction in ${activeCity} (${dateStr})`;
  list.innerHTML = '<div class="text-center py-4 text-xs text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Checking open attractions...</div>';
  modal.classList.remove('hidden');

  try {
    const res = await fetch(`/api/catalog/attractions?city=${activeCity}&date=${dateStr}`);
    const attractions = await res.json();

    // Exclude attractions already in package
    const existingIds = new Set(currentPackage.items.filter(it => it.type === 'attraction').map(it => it.catalog_id));
    const available = attractions.filter(a => !existingIds.has(a.attraction_id));

    if (available.length === 0) {
      list.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">No additional attractions available on this date.</p>';
      return;
    }

    list.innerHTML = available.map(att => `
      <div class="p-3 border rounded-xl flex items-center justify-between hover:border-slate-300">
        <div>
          <div class="font-bold text-xs text-slate-900">${att.name}</div>
          <div class="text-[11px] text-slate-500 mt-0.5">
            Hours: ${att.open_from} - ${att.open_until} • Duration: ${att.visit_minutes || 60}m • ${att.category || 'Sight'}
          </div>
        </div>
        <div class="text-right flex items-center space-x-3">
          <div class="font-extrabold text-xs text-slate-900">
            ₹${((att.price_per_person.amount * currentPackage.request.adults) + ((att.child_price ? att.child_price.amount : att.price_per_person.amount) * (currentPackage.request.children || 0))).toLocaleString('en-IN')}
          </div>
          <button onclick="submitAddAttraction('${att.attraction_id}', '${dateStr}')" class="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition">
            Add
          </button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    list.innerHTML = '<p class="text-xs text-red-500 text-center py-4">Failed to load attractions.</p>';
  }
}

async function submitAddAttraction(attractionId, date) {
  try {
    const res = await fetch(`/api/packages/${currentPackage.packageId}/attractions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', attractionId, date }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(`Could not add attraction: ${data.errors ? data.errors.join(', ') : data.error}`);
      return;
    }

    closeModal('modal-attraction');
    renderPackage(data.package);
    showAlert('success', 'Attraction Added', 'Added attraction to itinerary without conflicting schedule.');
  } catch (e) {
    alert('Failed to add attraction.');
  }
}

async function removeAttraction(attractionId) {
  if (!confirm('Remove this attraction from the package?')) return;
  try {
    const res = await fetch(`/api/packages/${currentPackage.packageId}/attractions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'remove', attractionId }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(`Could not remove attraction: ${data.errors ? data.errors.join(', ') : data.error}`);
      return;
    }

    renderPackage(data.package);
    showAlert('success', 'Attraction Removed', 'Attraction removed and total cost updated.');
  } catch (e) {
    alert('Failed to remove attraction.');
  }
}

// Confirm Booking (M7)
async function confirmCurrentPackage() {
  if (!confirm('Confirm this holiday package? A 10-digit reservation number will be generated and saved to MongoDB.')) return;

  try {
    const res = await fetch(`/api/packages/${currentPackage.packageId}/confirm`, {
      method: 'POST',
    });
    const data = await res.json();

    if (!res.ok) {
      alert(`Confirmation failed: ${data.message || data.error}`);
      return;
    }

    renderPackage(data.package);
    showAlert('success', 'Booking Confirmed!', `Your 10-digit reservation number is ${data.reservationNumber}.`);
  } catch (e) {
    alert('Confirmation request failed.');
  }
}

// Download JSON Export (Section 6)
function downloadJsonExport() {
  if (!currentPackage) return;
  window.location.href = `/api/packages/${currentPackage.packageId}/export`;
}

// Select Variant (G4: Cheapest / Fastest / Best Rated)
function selectVariant(key) {
  if (!currentAlternatives || !currentAlternatives[key]) return;

  ['cheapest', 'fastest', 'bestRated'].forEach(k => {
    const btn = document.getElementById(`btn-variant-${k === 'bestRated' ? 'best' : k}`);
    if (k === key) {
      btn.className = 'px-3 py-1.5 rounded-lg border font-semibold bg-indigo-50 text-indigo-700 border-indigo-200';
    } else {
      btn.className = 'px-3 py-1.5 rounded-lg border font-semibold bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100';
    }
  });

  const selectedPkg = currentAlternatives[key];
  renderPackage(selectedPkg);
  showAlert('success', 'Package Variant Selected (G4)', `Loaded the ${key} option. Total: ₹${selectedPkg.totalInr.toLocaleString('en-IN')}`);
}

// Lookup Reservation by 10-digit number (M7)
async function handleLookupReservation() {
  const number = document.getElementById('input-lookup-number').value.trim();
  const resultContainer = document.getElementById('lookup-result-container');

  if (!number || number.length !== 10) {
    alert('Please enter a valid 10-digit reservation number.');
    return;
  }

  resultContainer.innerHTML = '<div class="text-center py-6 text-xs text-slate-500"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Searching MongoDB database...</div>';
  resultContainer.classList.remove('hidden');

  try {
    const res = await fetch(`/api/reservations/${number}`);
    const data = await res.json();

    if (!res.ok || data.error === 'not found') {
      resultContainer.innerHTML = `
        <div class="p-6 rounded-2xl bg-red-50 border border-red-200 text-center">
          <div class="text-2xl text-red-500 mb-2"><i class="fa-solid fa-circle-xmark"></i></div>
          <h4 class="font-bold text-red-900 text-sm">not found</h4>
          <p class="text-xs text-red-700 mt-1">No reservation found matching number <span class="font-mono font-bold">${number}</span>. Please verify and try again.</p>
        </div>
      `;
      return;
    }

    const pkg = data.package;
    resultContainer.innerHTML = `
      <div class="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-emerald-200">
          <div>
            <span class="badge bg-emerald-800 text-emerald-100 mb-1">BOOKED & CONFIRMED</span>
            <h4 class="font-black text-xl text-emerald-900">Reservation #${data.reservationNumber}</h4>
          </div>
          <button onclick="loadLookedUpPackage('${pkg.packageId}')" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition">
            Open in Itinerary View →
          </button>
        </div>
        <div class="grid grid-cols-2 gap-3 text-xs text-emerald-900">
          <div><span class="font-semibold text-emerald-700">Destination:</span> ${pkg.request.country} (${pkg.cityPlan.join(', ')})</div>
          <div><span class="font-semibold text-emerald-700">Dates:</span> ${pkg.request.startDate} (${pkg.request.nights} Nights)</div>
          <div><span class="font-semibold text-emerald-700">Travelers:</span> ${pkg.request.adults} Adults, ${pkg.request.children || 0} Children</div>
          <div><span class="font-semibold text-emerald-700">Total Paid:</span> ₹${pkg.totalInr.toLocaleString('en-IN')}</div>
        </div>
        <div class="text-[11px] text-emerald-700 pt-2 border-t border-emerald-200 flex items-center justify-between">
          <span>Booking Reference: <code class="font-bold">${data.reservationNumber}</code></span>
          <span>Items: ${pkg.items.length} confirmed</span>
        </div>
      </div>
    `;
  } catch (err) {
    resultContainer.innerHTML = '<p class="text-xs text-red-500 text-center py-4">Error querying reservation database.</p>';
  }
}

function loadLookedUpPackage(packageId) {
  fetch(`/api/packages/${packageId}`)
    .then(r => r.json())
    .then(pkg => {
      renderPackage(pkg);
      showTab('tab-package');
    });
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
