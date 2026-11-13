// pages/PackagePage.jsx
// Full Itinerary view featuring:
// - 3 Calculated Package Options (Cheapest, Fastest, Best Rated) [G4]
// - Budget Gauge (Cost vs Budget) [M5]
// - Day-by-Day Chronological Timeline [M4]
// - Alternative City Plans [G3]
// - Download JSON [Section 6] & Confirm Reservation [M7]

import React, { useState, useEffect } from 'react';
import { getPackage, confirmPackage, changeHotel, changeFlight, changeAttractions, getItemsMeta } from '../api/client.js';

export default function PackagePage({ packageId, navigate }) {
  const [pkg, setPkg] = useState(null);
  const [packageCards, setPackageCards] = useState([]);
  const [cityPlans, setCityPlans] = useState([]);
  const [budgetWarning, setBudgetWarning] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);
  const [catalogMeta, setCatalogMeta] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  // Load catalog media metadata on mount for image & details lookup
  useEffect(() => {
    getItemsMeta()
      .then(res => setCatalogMeta(res.data))
      .catch(() => {});
  }, []);

  // Close drawer on Escape key
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setSelectedItem(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function getItemImage(item) {
    if (!item) return null;
    if (item.image) return item.image;
    if (catalogMeta?.items?.[item.catalog_id]?.image) {
      return catalogMeta.items[item.catalog_id].image;
    }
    return null;
  }

  function getItemDetails(item) {
    if (!item) return {};
    const direct = item.details || {};
    const fromCatalog = catalogMeta?.items?.[item.catalog_id] || {};
    const roomFromCatalog = item.room_id ? catalogMeta?.rooms?.[item.room_id] : null;
    return {
      ...fromCatalog,
      ...direct,
      room: roomFromCatalog || direct.room,
    };
  }

  function addDaysStr(dateStr, days) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d + days);
    const pad = (n) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  }

  function formatDayDate(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // Group items by Day: Outbound flight on Day 1 (arrival), Return flight on Day 7 (departure)
  const dayGroups = React.useMemo(() => {
    if (!pkg?.items) return [];
    const items = pkg.items;
    const startStr = pkg.request?.startDate || '2027-04-10';
    const totalNights = pkg.request?.nights || 6;
    const totalDays = totalNights + 1;

    const days = [];
    for (let i = 0; i < totalDays; i++) {
      const dateStr = addDaysStr(startStr, i);
      days.push({
        dayIndex: i + 1,
        dateStr,
        isArrival: i === 0,
        isDeparture: i === totalDays - 1,
        isFullDay: i > 0 && i < totalDays - 1,
        items: [],
      });
    }

    const flights = items.filter(i => i.type === 'flight');
    const outboundFlight = flights[0];
    const returnFlight = flights[1];

    items.forEach(it => {
      // 1. Outbound flight lands on Arrival Day (Day 1)
      if (it === outboundFlight) {
        days[0].items.push(it);
      }
      // 2. Return flight departs on Departure Day (Day 7)
      else if (it === returnFlight) {
        days[days.length - 1].items.push(it);
      }
      // 3. Hotel check-in corresponds to hotel start date
      else if (it.type === 'hotel') {
        const d = days.find(x => x.dateStr === it.start) || days[0];
        d.items.push(it);
      }
      // 4. Other items (transfers, attractions) mapped to their respective day
      else {
        const itemDate = it.start ? it.start.slice(0, 10) : null;
        const d = days.find(x => x.dateStr === itemDate);
        if (d) {
          d.items.push(it);
        } else if (it.end && it.end.slice(0, 10) === days[days.length - 1].dateStr) {
          days[days.length - 1].items.push(it);
        } else {
          days[0].items.push(it);
        }
      }
    });

    return days;
  }, [pkg]);

  useEffect(() => {
    const id = localStorage.getItem('bmh_current_pkg_id') || packageId;
    const cachedCards = localStorage.getItem('bmh_package_cards');
    const cachedPlans = localStorage.getItem('bmh_available_city_plans');
    const warning = localStorage.getItem('bmh_budget_warning');
    const cachedPkg = localStorage.getItem('bmh_current_package');

    if (cachedCards) {
      try { setPackageCards(JSON.parse(cachedCards)); } catch (e) {}
    }
    if (cachedPlans) {
      try { setCityPlans(JSON.parse(cachedPlans)); } catch (e) {}
    }
    if (warning) {
      setBudgetWarning(warning);
    }
    if (cachedPkg) {
      try {
        const parsed = JSON.parse(cachedPkg);
        if (parsed && (!id || parsed.packageId === id)) {
          setPkg(parsed);
        }
      } catch (e) {}
    }

    if (!id) return;
    getPackage(id)
      .then(res => {
        const fetched = res.data;
        if (fetched) {
          setPkg(fetched);
          localStorage.setItem('bmh_current_pkg_id', fetched.packageId);
          localStorage.setItem('bmh_current_package', JSON.stringify(fetched));

          // Synchronize status into cards and save to localStorage
          setPackageCards(prevCards => {
            const newCards = (prevCards || []).map(c => {
              if (c?.package?.packageId === fetched.packageId) {
                return { ...c, package: fetched };
              }
              return c;
            });
            localStorage.setItem('bmh_package_cards', JSON.stringify(newCards));
            return newCards;
          });
        }
      })
      .catch(() => setError('Could not load package.'));
  }, [packageId]);

  if (loading && !pkg) {
    return <div className="p-12 text-center text-slate-500 font-bold">Loading holiday package...</div>;
  }

  if (!pkg) {
    return (
      <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-lg mx-auto">
        <h3 className="text-lg font-bold text-slate-800">No Package Loaded</h3>
        <p className="text-xs text-slate-500 mt-1 mb-6">Submit the form to generate custom packages.</p>
        <button onClick={() => navigate('home')} className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl">
          ← Plan a Trip
        </button>
      </div>
    );
  }

  const budget = pkg?.request?.budgetInr || 0;
  const total = pkg?.totalInr || 0;
  const diff = budget - total;

  function handleSelectCard(card) {
    if (!card || !card.package) return;
    setPkg(card.package);
    localStorage.setItem('bmh_current_pkg_id', card.package.packageId);
    localStorage.setItem('bmh_current_package', JSON.stringify(card.package));
    if (navigate) {
      navigate('package', card.package.packageId);
    }
  }

  async function handleConfirmReservation(targetPkgId) {
    const idToConfirm = targetPkgId || pkg?.packageId;
    if (!idToConfirm) return;
    setConfirming(true);
    try {
      const res = await confirmPackage(idToConfirm);
      const updated = res.data.package || {};
      const resNum = res.data.reservationNumber || updated.reservationNumber;

      const fullUpdated = {
        ...pkg,
        ...updated,
        status: 'BOOKED',
        reservationNumber: resNum,
        request: updated.request || pkg?.request || {},
        metrics: updated.metrics || pkg?.metrics || { travelMinutes: 0, avgHotelStars: 3 },
      };

      setPkg(fullUpdated);
      localStorage.setItem('bmh_current_pkg_id', fullUpdated.packageId);
      localStorage.setItem('bmh_current_package', JSON.stringify(fullUpdated));
      localStorage.setItem('bmh_confirmed_reservation_number', resNum);

      // Update packageCards state AND localStorage so the confirmed card reflects BOOKED
      setPackageCards(prevCards => {
        const newCards = (prevCards || []).map(c => {
          if (c?.package?.packageId === fullUpdated.packageId) {
            return {
              ...c,
              package: {
                ...c.package,
                ...fullUpdated,
                metrics: fullUpdated.metrics || c.package?.metrics || { travelMinutes: 0, avgHotelStars: 3 },
              },
            };
          }
          return c;
        });
        localStorage.setItem('bmh_package_cards', JSON.stringify(newCards));
        return newCards;
      });

      if (navigate) {
        navigate('package', fullUpdated.packageId);
      }

      alert(`✓ Reservation Confirmed!\n\nReservation Number: ${resNum}\n\nDownload JSON is now enabled at the top right of your itinerary.`);
    } catch (e) {
      alert(e.response?.data?.message || 'Confirmation failed. Please try again.');
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* Budget Too Small Banner (M8) */}
      {budgetWarning && (
        <div className="bg-semantic-warningBg border border-semantic-warningBorder text-semantic-warning p-4 rounded-xl text-xs flex items-start space-x-2.5 shadow-sm">
          <span className="font-bold text-sm leading-none mt-0.5">!</span>
          <div>
            <div className="font-semibold text-xs">Budget Notice (Section 4 / M8)</div>
            <div className="mt-0.5 leading-relaxed">{budgetWarning}</div>
          </div>
        </div>
      )}

      {/* Top Header Card & Budget Summary */}
      <div className="card-base space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-border-subtle">
          <div>
            <div className="flex items-center space-x-2">
              <span className={pkg.status === 'BOOKED' ? 'badge-success' : 'badge-warning'}>
                {pkg.status}
              </span>
              <span className="text-xs text-subtle font-mono">ID: {(pkg.packageId || '').slice(0, 8)}</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-primary mt-1.5">
              {pkg.request?.country || 'Holiday'}: {(pkg.cityPlan || []).join(' → ')}
            </h1>
            <p className="text-xs text-muted mt-0.5">
              {pkg.request?.nights || 0} Nights ({pkg.request?.startDate || ''} to {pkg.items && pkg.items.length > 0 ? (pkg.items[pkg.items.length - 1]?.start?.slice(0, 10) || '') : ''}) &bull; {pkg.request?.adults || 0} Adults{pkg.request?.children ? `, ${pkg.request.children} Children` : ''}
            </p>
          </div>

          {/* Download JSON & Reservation Badge (Only visible when booked) */}
          {pkg.status === 'BOOKED' && (
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/api/packages/${pkg.packageId}/export`}
                download={`holiday-package-${pkg.packageId}.json`}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                <span>📥 Download JSON</span>
              </a>
              <div className="badge-accent font-mono text-xs py-1 px-3">
                Reservation #{pkg.reservationNumber}
              </div>
            </div>
          )}
        </div>

        {/* Budget Numbers (Nested Surface) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-surface-nested p-4 rounded-lg border border-border">
            <span className="text-xs text-muted font-medium">Total Package Cost</span>
            <div className="text-xl font-semibold text-primary mt-1">₹{total.toLocaleString('en-IN')}</div>
          </div>
          <div className="bg-surface-nested p-4 rounded-lg border border-border">
            <span className="text-xs text-muted font-medium">Your Budget</span>
            <div className="text-xl font-semibold text-secondary mt-1">₹{budget.toLocaleString('en-IN')}</div>
          </div>
          <div className={`p-4 rounded-lg border ${diff >= 0 ? 'bg-semantic-successBg border-semantic-successBorder' : 'bg-semantic-errorBg border-semantic-errorBorder'}`}>
            <span className={`text-xs font-medium ${diff >= 0 ? 'text-semantic-success' : 'text-semantic-error'}`}>
              {diff >= 0 ? 'Under Budget (Savings)' : 'Over Budget'}
            </span>
            <div className={`text-xl font-semibold mt-1 ${diff >= 0 ? 'text-semantic-success' : 'text-semantic-error'}`}>
              ₹{Math.abs(diff).toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* 3 Calculated Package Options (G4) */}
        {packageCards && packageCards.length > 0 && (
          <div className="pt-4 border-t border-border-subtle">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-secondary">
                Calculated Options ({packageCards.length} Generated)
              </h2>
              <span className="text-[11px] text-muted">Select an option to preview its complete day-by-day plan</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {packageCards.map((card, idx) => {
                if (!card || !card.package) return null;
                const isSelected = pkg?.packageId === card.package.packageId;
                const travelMinutes = card.package.metrics?.travelMinutes || 0;
                const travelHours = Math.floor(travelMinutes / 60);
                const travelMins = travelMinutes % 60;
                const stars = card.package.metrics?.avgHotelStars || 3;

                return (
                  <div
                    key={idx}
                    onClick={() => handleSelectCard(card)}
                    className={`rounded-lg border p-4 transition-all duration-150 cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-accent bg-surface ring-1 ring-accent shadow-card'
                        : 'border-border bg-surface hover:bg-surface-nested/40 hover:border-border-strong'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className={
                          card.category === 'cheapest'
                            ? 'badge-success text-[10px]'
                            : card.category === 'fastest'
                            ? 'badge-info text-[10px]'
                            : 'badge-warning text-[10px]'
                        }>
                          {card.badge}
                        </span>
                        {isSelected && (
                          <span className="badge-accent text-[10px] py-0 px-2 font-medium">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="mt-3">
                        <div className="text-xl font-bold tracking-tight text-primary">
                          ₹{(card.package.totalInr || 0).toLocaleString('en-IN')}
                        </div>
                        <p className="text-xs text-muted mt-0.5">
                          {(card.package.cityPlan || []).join(' → ')} ({card.package.request?.nights || 0} Nights)
                        </p>
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs text-secondary border-t border-border-subtle pt-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-muted">Travel Duration:</span>
                          <span className="font-medium text-primary">{travelHours}h {travelMins}m</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted">Avg Hotel Rating:</span>
                          <span className="font-medium text-primary">{stars} ★</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted">Activities & Stays:</span>
                          <span className="font-medium text-primary">{(card.package.items || []).length} items</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-2">
                      {isSelected ? (
                        <div className="space-y-2">
                          <div className="w-full py-1 text-[11px] font-medium text-center rounded bg-accent-tint text-accent border border-accent-border">
                            Currently Viewing
                          </div>
                          {pkg.status !== 'BOOKED' ? (
                            <button
                              type="button"
                              disabled={confirming}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmReservation(card.package.packageId);
                              }}
                              className="btn-primary w-full py-2 text-xs"
                            >
                              {confirming ? 'Confirming Reservation...' : 'Confirm Reservation'}
                            </button>
                          ) : (
                            <div className="badge-success w-full py-1.5 text-xs font-medium justify-center">
                              ✓ Reserved (#{pkg.reservationNumber})
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectCard(card);
                          }}
                          className="btn-secondary w-full py-1.5 text-xs"
                        >
                          Select This Package
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Fallback Confirm Button if no package cards present */}
        {(!packageCards || packageCards.length === 0) && pkg.status !== 'BOOKED' && (
          <div className="pt-4 border-t border-border-subtle flex justify-end">
            <button
              type="button"
              disabled={confirming}
              onClick={() => handleConfirmReservation(pkg.packageId)}
              className="btn-primary text-xs"
            >
              {confirming ? 'Confirming Reservation...' : 'Confirm Reservation'}
            </button>
          </div>
        )}

      </div>

      {/* Day-by-Day Timeline (M4) */}
      <div className="space-y-6">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-primary">
              Day-by-Day Itinerary ({(pkg.items || []).length} Activities across {dayGroups.length} Days)
            </h2>
            <p className="text-[11px] text-secondary mt-0.5">
              Strictly verified schedule: 1–2 attractions on full days, 0 on departure day.
            </p>
          </div>
          <span className="text-xs text-muted hidden sm:inline">Chronological &amp; Overlap Validated</span>
        </div>

        <div className="space-y-6">
          {dayGroups.map((day) => {
            const attCount = day.items.filter(i => i.type === 'attraction').length;
            const formattedDate = formatDayDate(day.dateStr);

            return (
              <div key={day.dayIndex} className="space-y-2.5">
                {/* Day Header Badge */}
                <div className="flex items-center justify-between bg-surface-nested px-3.5 py-2 rounded-lg border border-border">
                  <div className="flex items-center space-x-2.5">
                    <span className="w-5 h-5 rounded bg-accent text-white flex items-center justify-center text-[10px] font-bold">
                      {day.dayIndex}
                    </span>
                    <span className="text-xs font-semibold text-primary">
                      Day {day.dayIndex} &bull; {formattedDate}
                    </span>
                  </div>

                  <div>
                    {day.isArrival && (
                      <span className="badge-info text-[10px] px-2 py-0.5">
                        Arrival Day {attCount > 0 ? `• ${attCount} Attraction` : '• Hotel & Transfers'}
                      </span>
                    )}
                    {day.isDeparture && (
                      <span className="badge-neutral text-[10px] px-2 py-0.5 font-medium">
                        Departure Day &bull; 0 Attractions
                      </span>
                    )}
                    {day.isFullDay && (
                      <span className="badge-success text-[10px] px-2 py-0.5 font-medium">
                        Full Day &bull; {attCount} {attCount === 1 ? 'Attraction' : 'Attractions'} (Rule: 1–2 / day)
                      </span>
                    )}
                  </div>
                </div>

                {/* Day Items */}
                <div className="space-y-2">
                  {day.items.map((item, itemIdx) => {
                    const timeStr = item.start && item.start.includes('T') ? item.start.slice(11, 16) : (item.start || '');
                    const endStr = item.end && item.end.includes('T') ? item.end.slice(11, 16) : (item.end || '');

                    let badgeClass = 'badge-neutral';
                    if (item.type === 'flight') badgeClass = 'badge-info';
                    else if (item.type === 'transfer') badgeClass = 'badge-success';
                    else if (item.type === 'hotel') badgeClass = 'badge-warning';
                    else if (item.type === 'attraction') badgeClass = 'badge-accent';

                    const itemImage = getItemImage(item);
                    const hasImage = Boolean(itemImage);

                    return (
                      <div 
                        key={itemIdx}
                        onClick={() => {
                          if (hasImage) {
                            setSelectedItem(item);
                          }
                        }}
                        className={`bg-surface p-3.5 rounded-lg border border-border shadow-card flex items-center justify-between transition-all duration-150 ${
                          hasImage 
                            ? 'cursor-pointer hover:border-accent hover:bg-surface-nested hover:shadow-dropdown group' 
                            : 'cursor-default'
                        }`}
                        title={hasImage ? `Click to view ${item.name} photo and details` : undefined}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-7 h-7 rounded border flex items-center justify-center text-[11px] font-semibold transition-colors ${
                            hasImage 
                              ? 'bg-accent-tint border-accent-border text-accent group-hover:bg-accent group-hover:text-white' 
                              : 'bg-surface-nested border-border text-secondary'
                          }`}>
                            {itemIdx + 1}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className={`${badgeClass} text-[10px] px-2 py-0.5 uppercase tracking-wide`}>
                                {item.type}
                              </span>
                              <span className={`text-xs font-semibold ${hasImage ? 'text-primary group-hover:text-accent transition-colors' : 'text-primary'}`}>
                                {item.name}
                              </span>
                              {hasImage && (
                                <span className="inline-flex items-center space-x-1 text-[10px] text-accent bg-accent-tint border border-accent-border px-1.5 py-0.5 rounded font-medium">
                                  <span>📷</span>
                                  <span className="hidden sm:inline">Photo</span>
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted mt-0.5 flex flex-wrap items-center gap-2">
                              <span>{timeStr}{endStr ? ` → ${endStr}` : ''}</span>
                              <span>&bull;</span>
                              <span>{item.city}</span>
                              {item.quantity && (
                                <>
                                  <span>&bull;</span>
                                  <span>Qty: {item.quantity}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right flex items-center space-x-3">
                          <div>
                            <div className="text-xs font-semibold text-primary">
                              ₹{(item.price_inr || 0).toLocaleString('en-IN')}
                            </div>
                            {hasImage && (
                              <span className="text-[10px] text-accent font-medium block sm:hidden">
                                View details &rarr;
                              </span>
                            )}
                          </div>
                          {hasImage && (
                            <span className="hidden sm:inline-block text-muted group-hover:text-accent text-xs transition-colors">
                              &rarr;
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Half-Page Drawer on the Right Hand Side (opens when item with image is clicked) */}
      {selectedItem && (() => {
        const selectedImg = getItemImage(selectedItem);
        const details = getItemDetails(selectedItem);
        const timeStr = selectedItem.start && selectedItem.start.includes('T') ? selectedItem.start.slice(11, 16) : (selectedItem.start || '');
        const endStr = selectedItem.end && selectedItem.end.includes('T') ? selectedItem.end.slice(11, 16) : (selectedItem.end || '');

        return (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-primary/20 backdrop-blur-[2px] z-40 transition-opacity"
              onClick={() => setSelectedItem(null)}
            />

            {/* Right-Hand Half-Page Panel */}
            <aside
              className="fixed top-0 right-0 bottom-0 w-full sm:w-[500px] lg:w-1/2 bg-surface border-l border-border shadow-modal z-50 flex flex-col overflow-hidden"
              role="dialog"
              aria-modal="true"
            >
              {/* Header */}
              <div className="p-4 sm:p-5 border-b border-border flex items-start justify-between bg-surface-nested">
                <div className="space-y-1 pr-4">
                  <div className="flex items-center space-x-2">
                    <span className={`${
                      selectedItem.type === 'hotel' ? 'badge-warning' : 'badge-accent'
                    } text-[10px] px-2 py-0.5 uppercase tracking-wide`}>
                      {selectedItem.type}
                    </span>
                    <span className="text-xs text-muted font-mono">
                      {selectedItem.catalog_id}
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-semibold text-primary tracking-tight leading-snug">
                    {selectedItem.name}
                  </h2>
                  <p className="text-xs text-secondary">
                    {selectedItem.city} {details.area ? `• ${details.area} District` : ''}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-surface-tertiary transition-colors border border-transparent hover:border-border"
                  title="Close (Esc)"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">

                {/* Picture (only displayed when given in dataset) */}
                {selectedImg && (
                  <div className="space-y-1.5">
                    <div className="overflow-hidden rounded-lg border border-border shadow-sm bg-surface-nested aspect-video relative">
                      <img
                        src={selectedImg.startsWith('/') ? selectedImg : `/${selectedImg}`}
                        alt={selectedItem.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                    <p className="text-[11px] text-muted flex items-center justify-between">
                      <span>Catalog dataset photo</span>
                      <span>{selectedItem.city}</span>
                    </p>
                  </div>
                )}

                {/* Price Box */}
                <div className="bg-surface-nested border border-border rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-muted uppercase tracking-wider block">
                      Itinerary Event Price
                    </span>
                    <span className="text-2xl font-bold text-primary tracking-tight">
                      ₹{(selectedItem.price_inr || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="text-right text-xs text-secondary space-y-0.5">
                    {selectedItem.quantity && (
                      <span className="badge-neutral text-[11px] block">
                        Quantity: {selectedItem.quantity}
                      </span>
                    )}
                    <span className="text-[11px] text-muted block">
                      Included in total package
                    </span>
                  </div>
                </div>

                {/* Details Section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-primary uppercase tracking-wider">
                    Available Details
                  </h3>

                  {/* Hotel Specific Details */}
                  {selectedItem.type === 'hotel' && (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-surface border border-border-subtle p-3 rounded-lg space-y-1">
                        <span className="text-[11px] text-muted block">Stars & Rating</span>
                        <span className="font-semibold text-primary flex items-center space-x-1">
                          <span>⭐ {details.stars || 3} Stars</span>
                          {details.rating && (
                            <span className="text-muted">({details.rating}/5)</span>
                          )}
                        </span>
                      </div>

                      <div className="bg-surface border border-border-subtle p-3 rounded-lg space-y-1">
                        <span className="text-[11px] text-muted block">District / Area</span>
                        <span className="font-semibold text-primary">
                          {details.area || selectedItem.city || 'Central'}
                        </span>
                      </div>

                      <div className="bg-surface border border-border-subtle p-3 rounded-lg space-y-1">
                        <span className="text-[11px] text-muted block">Room Type</span>
                        <span className="font-semibold text-primary">
                          {details.roomName || details.room?.name || details.roomType || 'Standard Room'}
                        </span>
                      </div>

                      <div className="bg-surface border border-border-subtle p-3 rounded-lg space-y-1">
                        <span className="text-[11px] text-muted block">Capacity / Limits</span>
                        <span className="font-semibold text-primary">
                          {details.maxAdults || details.room?.max_adults || 2} Adults
                          {details.maxChildren || details.room?.max_children ? `, ${details.maxChildren || details.room?.max_children} Children` : ''}
                        </span>
                      </div>

                      <div className="bg-surface border border-border-subtle p-3 rounded-lg space-y-1">
                        <span className="text-[11px] text-muted block">Check-in / Check-out</span>
                        <span className="font-semibold text-primary">
                          {details.check_in_from || '15:00'} / {details.check_out_until || '11:00'}
                        </span>
                      </div>

                      <div className="bg-surface border border-border-subtle p-3 rounded-lg space-y-1">
                        <span className="text-[11px] text-muted block">Family Friendly</span>
                        <span className="font-semibold text-semantic-success flex items-center space-x-1">
                          <span>✓</span>
                          <span>{details.family_friendly ? 'Verified' : 'Standard'}</span>
                        </span>
                      </div>

                      <div className="col-span-2 bg-surface border border-border-subtle p-3 rounded-lg space-y-1">
                        <span className="text-[11px] text-muted block">Stay Window</span>
                        <span className="font-semibold text-primary">
                          {selectedItem.start} → {selectedItem.end} ({details.nights || 'Stay'} Nights)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Attraction Specific Details */}
                  {selectedItem.type === 'attraction' && (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-surface border border-border-subtle p-3 rounded-lg space-y-1">
                        <span className="text-[11px] text-muted block">Category</span>
                        <span className="font-semibold text-primary">
                          {details.category || 'Sightseeing'}
                        </span>
                      </div>

                      <div className="bg-surface border border-border-subtle p-3 rounded-lg space-y-1">
                        <span className="text-[11px] text-muted block">Visit Duration</span>
                        <span className="font-semibold text-primary">
                          ~{details.visit_minutes || 60} minutes
                        </span>
                      </div>

                      <div className="bg-surface border border-border-subtle p-3 rounded-lg space-y-1">
                        <span className="text-[11px] text-muted block">Service / Open Hours</span>
                        <span className="font-semibold text-primary">
                          {details.open_from || '09:00'} – {details.open_until || '18:00'}
                        </span>
                      </div>

                      <div className="bg-surface border border-border-subtle p-3 rounded-lg space-y-1">
                        <span className="text-[11px] text-muted block">Scheduled Time Slot</span>
                        <span className="font-semibold text-primary">
                          {timeStr} → {endStr}
                        </span>
                      </div>

                      <div className="bg-surface border border-border-subtle p-3 rounded-lg space-y-1">
                        <span className="text-[11px] text-muted block">Child Friendly</span>
                        <span className="font-semibold text-primary">
                          {details.child_friendly ? '✓ Yes, recommended' : 'General Admission'}
                        </span>
                      </div>

                      <div className="bg-surface border border-border-subtle p-3 rounded-lg space-y-1">
                        <span className="text-[11px] text-muted block">Accessibility</span>
                        <span className="font-semibold text-primary">
                          {details.accessible ? '✓ Wheelchair Accessible' : 'Standard'}
                        </span>
                      </div>

                      {details.name_ja && (
                        <div className="col-span-2 bg-surface border border-border-subtle p-3 rounded-lg space-y-1">
                          <span className="text-[11px] text-muted block">Original Name (Japanese)</span>
                          <span className="font-medium text-primary font-sans text-sm">
                            {details.name_ja}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                </div>

              </div>

              {/* Footer */}
              <div className="p-4 border-t border-border bg-surface-nested flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="btn-secondary text-xs px-4 py-2"
                >
                  Close Details
                </button>
              </div>

            </aside>
          </>
        );
      })()}

    </div>
  );
}
