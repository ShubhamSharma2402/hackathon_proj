// components/PackageEditor.jsx
// Phase B: Plan Flexibility & Cascading Validation (G3, G1, G2, M6)
// Provides:
// - Alternative City Plan Switcher (G3) with 1-click recalculation
// - Hotel Selection per city with Price Differences (G2) & Area Mismatch Warnings (G1)
// - Flight Selection (Arrival & Return) with Price Differences (G2) & Transfer/Check-in Warnings (G1)
// - Attractions Manager enforcing 1-2 attractions on full days, 0 on departure day, with Price Diffs (G2)

import React, { useState, useEffect } from 'react';
import { getChangeOptions, changeCities, changeHotel, changeFlight, changeAttractions } from '../api/client.js';

export default function PackageEditor({ packageId, reservationNumber, onUpdate, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('cities');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [previousCost, setPreviousCost] = useState(null);

  // Fetch change options on mount and whenever refreshed
  const loadOptions = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getChangeOptions(packageId);
      setData(res.data);
      setPreviousCost(prev => (prev === null ? res.data.totalInr : prev));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load customization options.');
    } finally {
      setLoading(false);
    }
  }, [packageId]);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  function notifyUpdate(updatedPkg, msg) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
    if (onUpdate) onUpdate(updatedPkg);
    loadOptions();
  }

  // Handle City Plan Switch (G3)
  async function handleSwitchCityPlan(plan) {
    if (plan.isCurrent) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await changeCities(packageId, { cities: plan.cities, nights: plan.nights });
      notifyUpdate(res.data.package, `Successfully switched itinerary to ${plan.label}!`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to switch city plan.');
    } finally {
      setActionLoading(false);
    }
  }

  // Handle Hotel Swap (M6, G1, G2)
  async function handleSwitchHotel(city, hotelId, roomId, hotelName) {
    setActionLoading(true);
    setError(null);
    try {
      const res = await changeHotel(packageId, { city, hotelId, roomId });
      notifyUpdate(res.data.package, res.data.message || `Hotel updated to ${hotelName}!`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update hotel. Section rules or budget may be violated.');
    } finally {
      setActionLoading(false);
    }
  }

  // Handle Flight Swap (M6, G1, G2)
  async function handleSwitchFlight(type, flightId, flightDesc) {
    setActionLoading(true);
    setError(null);
    try {
      const res = await changeFlight(packageId, { type, flightId });
      notifyUpdate(res.data.package, res.data.message || `Flight updated to ${flightDesc}!`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update flight. Check schedule constraints or budget.');
    } finally {
      setActionLoading(false);
    }
  }

  // Handle Attraction Add/Remove (M6, G2, 1-2 constraint)
  async function handleAttractionAction(action, attractionId, date, attName) {
    setActionLoading(true);
    setError(null);
    try {
      const res = await changeAttractions(packageId, { action, attractionId, date });
      notifyUpdate(
        res.data.package,
        action === 'add' ? `Added "${attName}" to day plan!` : `Removed "${attName}" from day plan!`
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Cannot perform attraction action. Rule limit (1-2 per day) or budget exceeded.');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center space-y-3">
        <div className="inline-block animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" />
        <p className="text-xs text-secondary font-medium">Loading package customization options...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-surface border border-border rounded-xl p-6 text-center space-y-3">
        <p className="text-sm text-semantic-error">{error || 'Could not load package details.'}</p>
        <button onClick={onClose} className="btn-secondary text-xs">Close</button>
      </div>
    );
  }

  const { totalInr, budgetInr, remainingBudget, availableCityPlans, hotelOptions, flightOptions, attractionOptions } = data;

  return (
    <div className="bg-surface border border-border rounded-2xl shadow-card overflow-hidden text-left transition-all">
      
      {/* Top Header Bar */}
      <div className="bg-surface-nested border-b border-border p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="badge-accent text-[11px] font-semibold uppercase tracking-wider">
              Package Customizer (Phase B)
            </span>
            {reservationNumber && (
              <span className="badge-neutral text-[11px] font-mono font-medium">
                Ref: #{reservationNumber}
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold text-primary tracking-tight">
            Modify & Customize Confirmed Package
          </h2>
          <p className="text-xs text-muted">
            All changes trigger instant Section 4 validation, cascading warnings, and MongoDB snapshot updates.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] text-muted uppercase tracking-wider block">Total Cost / Budget</span>
            <div className="flex items-baseline gap-1.5 justify-end">
              <span className="text-base font-bold text-primary font-mono">
                ₹{totalInr.toLocaleString('en-IN')}
              </span>
              <span className="text-xs text-muted">/ ₹{budgetInr.toLocaleString('en-IN')}</span>
            </div>
            <span className={`text-[11px] font-semibold block ${remainingBudget >= 0 ? 'text-semantic-success' : 'text-semantic-error'}`}>
              {remainingBudget >= 0 ? `₹${remainingBudget.toLocaleString('en-IN')} under budget` : `₹${Math.abs(remainingBudget).toLocaleString('en-IN')} over budget`}
            </span>
            {previousCost !== null && (
              <div className="mt-1.5 pt-1.5 border-t border-border/70 text-[11px] flex flex-col items-end">
                <div className="flex items-center gap-1.5 text-secondary">
                  <span className="text-muted">Previous:</span>
                  <span className="font-mono font-medium">₹{previousCost.toLocaleString('en-IN')}</span>
                  <span className="text-muted">|</span>
                  <span className="text-muted">Current:</span>
                  <span className="font-mono font-bold text-primary">₹{totalInr.toLocaleString('en-IN')}</span>
                </div>
                <div className="text-[11px] font-medium mt-0.5">
                  <span className="text-muted">Difference: </span>
                  {totalInr === previousCost ? (
                    <span className="text-muted font-mono font-semibold">₹0 (Unchanged)</span>
                  ) : totalInr > previousCost ? (
                    <span className="text-semantic-error font-bold font-mono">
                      +₹{(totalInr - previousCost).toLocaleString('en-IN')}
                    </span>
                  ) : (
                    <span className="text-semantic-success font-bold font-mono">
                      -₹{Math.abs(totalInr - previousCost).toLocaleString('en-IN')} (Saved)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {onClose && (
            <button
              onClick={() => onClose(previousCost, totalInr)}
              disabled={actionLoading}
              className="btn-secondary text-xs py-1.5 px-3 whitespace-nowrap"
            >
              Done / Close
            </button>
          )}
        </div>
      </div>

      {/* Feedback Alerts */}
      {error && (
        <div className="bg-semantic-errorBg border-b border-semantic-errorBorder text-semantic-error px-5 py-3 text-xs flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <span className="font-bold text-sm leading-none mt-0.5">!</span>
            <span className="font-medium leading-relaxed">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-semantic-error hover:opacity-70 font-bold">&times;</button>
        </div>
      )}

      {successMsg && (
        <div className="bg-semantic-successBg border-b border-semantic-successBorder text-semantic-success px-5 py-3 text-xs flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <span className="font-bold text-sm leading-none mt-0.5">✓</span>
            <span className="font-medium leading-relaxed">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-semantic-success hover:opacity-70 font-bold">&times;</button>
        </div>
      )}

      {/* Customization Navigation Tabs */}
      <div className="border-b border-border px-5 flex overflow-x-auto gap-2 text-xs font-medium">
        <button
          onClick={() => setActiveTab('cities')}
          className={`py-3 px-3 border-b-2 font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
            activeTab === 'cities'
              ? 'border-accent text-accent font-semibold'
              : 'border-transparent text-secondary hover:text-primary'
          }`}
        >
          <span>🏙️</span>
          <span>City Plan Switcher (G3)</span>
          <span className="badge-neutral text-[10px] px-1.5 py-0">{availableCityPlans.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('hotels')}
          className={`py-3 px-3 border-b-2 font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
            activeTab === 'hotels'
              ? 'border-accent text-accent font-semibold'
              : 'border-transparent text-secondary hover:text-primary'
          }`}
        >
          <span>🏨</span>
          <span>Hotels & Rooms (G1)</span>
          <span className="badge-neutral text-[10px] px-1.5 py-0">{hotelOptions.length}</span>
        </button>

        <button
          onClick={() => setActiveTab('flights')}
          className={`py-3 px-3 border-b-2 font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
            activeTab === 'flights'
              ? 'border-accent text-accent font-semibold'
              : 'border-transparent text-secondary hover:text-primary'
          }`}
        >
          <span>✈️</span>
          <span>Flights & Transfers (G1)</span>
          <span className="badge-neutral text-[10px] px-1.5 py-0">2 legs</span>
        </button>

        <button
          onClick={() => setActiveTab('attractions')}
          className={`py-3 px-3 border-b-2 font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap ${
            activeTab === 'attractions'
              ? 'border-accent text-accent font-semibold'
              : 'border-transparent text-secondary hover:text-primary'
          }`}
        >
          <span>🎟️</span>
          <span>Attractions (1–2 / Day)</span>
          <span className="badge-neutral text-[10px] px-1.5 py-0">{attractionOptions.length} days</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-6">

        {/* ----------------- TAB 1: CITY PLAN SWITCHER (G3) ----------------- */}
        {activeTab === 'cities' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2">
              <div>
                <h3 className="text-sm font-semibold text-primary">Alternative City Itineraries (G3)</h3>
                <p className="text-xs text-muted">
                  Switch between valid multi-city distributions for this destination and duration with 1 click.
                </p>
              </div>
              <span className="badge-neutral text-[11px]">
                Rule: Each city &ge; 2 nights
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availableCityPlans.map((plan, idx) => (
                <div
                  key={idx}
                  className={`border rounded-xl p-4 flex flex-col justify-between transition-all ${
                    plan.isCurrent
                      ? 'border-accent bg-accent-tint/40 shadow-sm ring-1 ring-accent'
                      : 'border-border bg-surface hover:border-accent/40 hover:bg-surface-nested'
                  }`}
                >
                  <div className="space-y-1 mb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-primary">
                        {plan.label}
                      </span>
                      {plan.isCurrent && (
                        <span className="badge-accent text-[10px] font-bold">
                          ✓ Current Route
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-secondary">
                      {plan.cities.length === 1 ? 'Single-city destination stay' : `${plan.cities.length} cities connected via scheduled transfers`}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                    <span className="text-[11px] text-muted font-mono">
                      {plan.nights.reduce((a, b) => a + b, 0)} Total Nights
                    </span>
                    <button
                      onClick={() => handleSwitchCityPlan(plan)}
                      disabled={plan.isCurrent || actionLoading}
                      className={plan.isCurrent ? 'btn-secondary text-xs py-1 px-3 opacity-60' : 'btn-primary text-xs py-1 px-3'}
                    >
                      {actionLoading ? 'Switching...' : plan.isCurrent ? 'Currently Active' : 'Switch to this Plan &rarr;'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ----------------- TAB 2: HOTELS & ROOMS (M6, G1, G2) ----------------- */}
        {activeTab === 'hotels' && (
          <div className="space-y-8">
            {hotelOptions.map((opt, cIdx) => (
              <div key={cIdx} className="space-y-3">
                <div className="flex items-center justify-between pb-1.5 border-b border-border">
                  <div>
                    <h3 className="text-sm font-semibold text-primary">
                      Hotels in {opt.city} ({opt.nights} Nights)
                    </h3>
                    <p className="text-[11px] text-muted">
                      Select an alternative hotel or room. Warnings will alert if the neighborhood mismatches airport transfers.
                    </p>
                  </div>
                  <span className="badge-neutral text-xs">
                    Current: {opt.currentHotel?.name || 'None'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {opt.candidates.map((cand, hIdx) => {
                    const priceDiff = cand.priceDifference;
                    const hasAreaMismatch = cand.warnings?.some(w => w.includes('Area mismatch'));

                    return (
                      <div
                        key={hIdx}
                        className={`border rounded-xl p-4 flex flex-col justify-between space-y-3 transition-all ${
                          cand.isCurrent
                            ? 'border-accent bg-accent-tint/30 ring-1 ring-accent'
                            : 'border-border bg-surface hover:border-accent/40'
                        }`}
                      >
                        <div className="flex gap-3">
                          {cand.image ? (
                            <img
                              src={`/${cand.image}`}
                              alt={cand.hotelName}
                              className="w-16 h-16 rounded-lg object-cover border border-border flex-shrink-0"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-surface-nested border border-border flex items-center justify-center text-muted text-xs flex-shrink-0 font-medium">
                              🏨
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <h4 className="text-xs font-bold text-primary truncate" title={cand.hotelName}>
                                {cand.hotelName}
                              </h4>
                              <span className="text-[11px] font-semibold text-primary font-mono whitespace-nowrap">
                                {'★'.repeat(cand.stars)}
                              </span>
                            </div>
                            <div className="text-[11px] text-secondary mt-0.5">
                              <span>Area: <strong className="text-primary">{cand.area}</strong></span>
                              <span className="mx-1">•</span>
                              <span>Rating: {cand.rating}/10</span>
                            </div>
                            <div className="text-[11px] text-muted mt-0.5">
                              Room: <strong className="text-primary font-medium">{cand.roomName}</strong> ({cand.roomsNeeded} room{cand.roomsNeeded > 1 ? 's' : ''})
                            </div>
                          </div>
                        </div>

                        {/* Cascading Warnings (G1) */}
                        {cand.warnings && cand.warnings.length > 0 && (
                          <div className="space-y-1">
                            {cand.warnings.map((w, wIdx) => {
                              const isMismatch = w.includes('Area mismatch');
                              return (
                                <div
                                  key={wIdx}
                                  className={`text-[11px] px-2.5 py-1.5 rounded-lg flex items-start gap-1.5 leading-snug ${
                                    isMismatch
                                      ? 'bg-semantic-warningBg border border-semantic-warningBorder text-semantic-warning font-medium'
                                      : 'bg-surface-nested text-muted'
                                  }`}
                                >
                                  <span>{isMismatch ? '⚠️' : 'ℹ️'}</span>
                                  <span>{w}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Price Difference & Action */}
                        <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-muted block uppercase font-mono">Total Stay</span>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-xs font-bold font-mono text-primary">
                                ₹{cand.totalPrice.toLocaleString('en-IN')}
                              </span>
                              {!cand.isCurrent && (
                                <span className={`text-[11px] font-semibold ${priceDiff > 0 ? 'text-semantic-error' : priceDiff < 0 ? 'text-semantic-success' : 'text-muted'}`}>
                                  {priceDiff > 0 ? `+₹${priceDiff.toLocaleString('en-IN')}` : priceDiff < 0 ? `-₹${Math.abs(priceDiff).toLocaleString('en-IN')}` : 'Same'}
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => handleSwitchHotel(opt.city, cand.hotelId, cand.roomId, cand.hotelName)}
                            disabled={cand.isCurrent || actionLoading}
                            className={cand.isCurrent ? 'btn-secondary text-xs py-1 px-3 opacity-60' : 'btn-primary text-xs py-1 px-3'}
                          >
                            {actionLoading ? 'Updating...' : cand.isCurrent ? 'Selected Hotel' : 'Select Hotel &rarr;'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ----------------- TAB 3: FLIGHTS & TRANSFERS (M6, G1, G2) ----------------- */}
        {activeTab === 'flights' && (
          <div className="space-y-8">
            {/* Arrival Flight */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-border">
                <div>
                  <h3 className="text-sm font-semibold text-primary">Arrival Flight Options</h3>
                  <p className="text-[11px] text-muted">
                    Must land on your holiday start date. Transfer pickup and hotel check-in times adjust automatically.
                  </p>
                </div>
                <span className="badge-neutral text-xs">
                  Current: {flightOptions.arrival?.current?.name}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {flightOptions.arrival?.candidates.map((flight, idx) => {
                  const priceDiff = flight.priceDifference;

                  return (
                    <div
                      key={idx}
                      className={`border rounded-xl p-4 flex flex-col justify-between space-y-3 ${
                        flight.isCurrent
                          ? 'border-accent bg-accent-tint/30 ring-1 ring-accent'
                          : 'border-border bg-surface hover:border-accent/40'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-primary">
                            {flight.airline} {flight.flightNumber}
                          </span>
                          <span className="badge-neutral text-[10px] font-mono">
                            {flight.durationMinutes} mins ({Math.floor(flight.durationMinutes / 60)}h {flight.durationMinutes % 60}m)
                          </span>
                        </div>
                        <div className="text-xs text-secondary font-mono">
                          <span>{flight.from} ({flight.departureLocal.slice(11, 16)})</span>
                          <span className="mx-1.5">&rarr;</span>
                          <span>{flight.to} ({flight.arrivalLocal.slice(11, 16)})</span>
                        </div>
                        <div className="text-[11px] text-muted">
                          Seats Remaining: <strong className="text-primary">{flight.seatsLeft}</strong>
                        </div>
                      </div>

                      {/* Cascading Warnings (G1) */}
                      {flight.warnings && flight.warnings.length > 0 && (
                        <div className="space-y-1">
                          {flight.warnings.map((w, wIdx) => (
                            <div
                              key={wIdx}
                              className="bg-semantic-warningBg border border-semantic-warningBorder text-semantic-warning text-[11px] px-2.5 py-1.5 rounded-lg flex items-start gap-1.5 leading-snug"
                            >
                              <span>⚠️</span>
                              <span>{w}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Price Difference & Action */}
                      <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-muted block uppercase font-mono">Total Fare</span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs font-bold font-mono text-primary">
                              ₹{flight.totalPrice.toLocaleString('en-IN')}
                            </span>
                            {!flight.isCurrent && (
                              <span className={`text-[11px] font-semibold ${priceDiff > 0 ? 'text-semantic-error' : priceDiff < 0 ? 'text-semantic-success' : 'text-muted'}`}>
                                {priceDiff > 0 ? `+₹${priceDiff.toLocaleString('en-IN')}` : priceDiff < 0 ? `-₹${Math.abs(priceDiff).toLocaleString('en-IN')}` : 'Same'}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleSwitchFlight('arrival', flight.flightId, `${flight.airline} ${flight.flightNumber}`)}
                          disabled={flight.isCurrent || actionLoading}
                          className={flight.isCurrent ? 'btn-secondary text-xs py-1 px-3 opacity-60' : 'btn-primary text-xs py-1 px-3'}
                        >
                          {actionLoading ? 'Updating...' : flight.isCurrent ? 'Selected Flight' : 'Select Flight &rarr;'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Return Flight */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-border">
                <div>
                  <h3 className="text-sm font-semibold text-primary">Return Flight Options</h3>
                  <p className="text-[11px] text-muted">
                    Must depart on your final day. Departure transfer pickup is scheduled 3 hours prior.
                  </p>
                </div>
                <span className="badge-neutral text-xs">
                  Current: {flightOptions.return?.current?.name}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {flightOptions.return?.candidates.map((flight, idx) => {
                  const priceDiff = flight.priceDifference;

                  return (
                    <div
                      key={idx}
                      className={`border rounded-xl p-4 flex flex-col justify-between space-y-3 ${
                        flight.isCurrent
                          ? 'border-accent bg-accent-tint/30 ring-1 ring-accent'
                          : 'border-border bg-surface hover:border-accent/40'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-primary">
                            {flight.airline} {flight.flightNumber}
                          </span>
                          <span className="badge-neutral text-[10px] font-mono">
                            {flight.durationMinutes} mins ({Math.floor(flight.durationMinutes / 60)}h {flight.durationMinutes % 60}m)
                          </span>
                        </div>
                        <div className="text-xs text-secondary font-mono">
                          <span>{flight.from} ({flight.departureLocal.slice(11, 16)})</span>
                          <span className="mx-1.5">&rarr;</span>
                          <span>{flight.to} ({flight.arrivalLocal.slice(11, 16)})</span>
                        </div>
                        <div className="text-[11px] text-muted">
                          Seats Remaining: <strong className="text-primary">{flight.seatsLeft}</strong>
                        </div>
                      </div>

                      {/* Cascading Warnings (G1) */}
                      {flight.warnings && flight.warnings.length > 0 && (
                        <div className="space-y-1">
                          {flight.warnings.map((w, wIdx) => (
                            <div
                              key={wIdx}
                              className="bg-semantic-warningBg border border-semantic-warningBorder text-semantic-warning text-[11px] px-2.5 py-1.5 rounded-lg flex items-start gap-1.5 leading-snug"
                            >
                              <span>⚠️</span>
                              <span>{w}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Price Difference & Action */}
                      <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-muted block uppercase font-mono">Total Fare</span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs font-bold font-mono text-primary">
                              ₹{flight.totalPrice.toLocaleString('en-IN')}
                            </span>
                            {!flight.isCurrent && (
                              <span className={`text-[11px] font-semibold ${priceDiff > 0 ? 'text-semantic-error' : priceDiff < 0 ? 'text-semantic-success' : 'text-muted'}`}>
                                {priceDiff > 0 ? `+₹${priceDiff.toLocaleString('en-IN')}` : priceDiff < 0 ? `-₹${Math.abs(priceDiff).toLocaleString('en-IN')}` : 'Same'}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleSwitchFlight('return', flight.flightId, `${flight.airline} ${flight.flightNumber}`)}
                          disabled={flight.isCurrent || actionLoading}
                          className={flight.isCurrent ? 'btn-secondary text-xs py-1 px-3 opacity-60' : 'btn-primary text-xs py-1 px-3'}
                        >
                          {actionLoading ? 'Updating...' : flight.isCurrent ? 'Selected Flight' : 'Select Flight &rarr;'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ----------------- TAB 4: ATTRACTIONS (M6, 1-2 LIMIT, G2) ----------------- */}
        {activeTab === 'attractions' && (
          <div className="space-y-6">
            <div className="pb-2 border-b border-border">
              <h3 className="text-sm font-semibold text-primary">Attraction Itinerary Customization</h3>
              <p className="text-xs text-muted">
                Strict Section 4 rules: Full days require 1–2 attractions. Departure day allows 0 attractions.
              </p>
            </div>

            <div className="space-y-6">
              {attractionOptions.map((day, dIdx) => (
                <div key={dIdx} className="border border-border rounded-xl p-4 bg-surface-nested/40 space-y-3">
                  
                  {/* Day Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-accent text-white text-[11px] font-bold flex items-center justify-center">
                        {day.dayNumber}
                      </span>
                      <div>
                        <span className="text-xs font-bold text-primary">
                          Day {day.dayNumber} • {day.date}
                        </span>
                        <span className="text-[11px] text-muted ml-2">({day.city})</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        day.dayType === 'full'
                          ? 'bg-accent-tint text-accent border border-accent-border'
                          : day.dayType === 'departure'
                          ? 'bg-semantic-warningBg text-semantic-warning border border-semantic-warningBorder'
                          : 'bg-surface-nested text-secondary border border-border'
                      }`}>
                        {day.dayType === 'full' ? 'Full Day (Rule: 1–2 / day)' : day.dayType === 'departure' ? 'Departure Day (0 Attractions)' : 'Arrival Day (0–1 Attraction)'}
                      </span>
                      <span className="text-[11px] font-medium text-muted">
                        Booked: {day.currentAttractions.length} / 2
                      </span>
                    </div>
                  </div>

                  {/* Currently Booked Attractions on this day */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
                      Scheduled Sights
                    </span>

                    {day.currentAttractions.length === 0 ? (
                      <p className="text-xs text-muted italic">No attractions scheduled for this day.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {day.currentAttractions.map((att, aIdx) => (
                          <div
                            key={aIdx}
                            className="bg-surface border border-border rounded-lg p-3 flex items-center justify-between gap-2 shadow-sm"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {att.image ? (
                                <img
                                  src={`/${att.image}`}
                                  alt={att.name}
                                  className="w-10 h-10 rounded-md object-cover border border-border flex-shrink-0"
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-md bg-surface-nested flex items-center justify-center text-xs flex-shrink-0">
                                  🎟️
                                </div>
                              )}
                              <div className="min-w-0">
                                <h5 className="text-xs font-semibold text-primary truncate" title={att.name}>
                                  {att.name}
                                </h5>
                                <p className="text-[10px] text-muted font-mono">
                                  {att.start?.slice(11, 16)} &rarr; {att.end?.slice(11, 16)} • ₹{att.price_inr.toLocaleString('en-IN')}
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={() => handleAttractionAction('remove', att.catalog_id, day.date, att.name)}
                              disabled={!day.canRemove || actionLoading}
                              title={day.removeReason || 'Remove attraction'}
                              className="text-[11px] font-medium px-2 py-1 rounded bg-semantic-errorBg border border-semantic-errorBorder text-semantic-error hover:bg-semantic-error hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                            >
                              Remove (-₹{att.price_inr.toLocaleString('en-IN')})
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add New Attraction Section */}
                  <div className="pt-2 border-t border-border/60">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                        Available Open Sights in {day.city}
                      </span>
                      {!day.canAdd && (
                        <span className="text-[11px] text-semantic-warning font-medium">
                          {day.addReason || 'Day limit reached'}
                        </span>
                      )}
                    </div>

                    {day.canAdd ? (
                      day.availableToAdd.length === 0 ? (
                        <p className="text-xs text-muted italic">No further open sights available on this date.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {day.availableToAdd.slice(0, 6).map((item, addIdx) => (
                            <div
                              key={addIdx}
                              className="bg-surface border border-border rounded-lg p-2.5 flex flex-col justify-between space-y-2 hover:border-accent/50"
                            >
                              <div className="flex items-start gap-2">
                                {item.image ? (
                                  <img
                                    src={`/${item.image}`}
                                    alt={item.name}
                                    className="w-10 h-10 rounded-md object-cover border border-border flex-shrink-0"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-md bg-surface-nested flex items-center justify-center text-xs flex-shrink-0">
                                    🏛️
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <h6 className="text-xs font-semibold text-primary truncate" title={item.name}>
                                    {item.name}
                                  </h6>
                                  <p className="text-[10px] text-muted">
                                    {item.category} • {item.openFrom}–{item.openUntil}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-border/40">
                                <span className="text-[11px] font-bold text-primary font-mono">
                                  +₹{item.totalPrice.toLocaleString('en-IN')}
                                </span>
                                <button
                                  onClick={() => handleAttractionAction('add', item.attractionId, day.date, item.name)}
                                  disabled={actionLoading}
                                  className="btn-primary text-[11px] py-0.5 px-2 font-medium"
                                >
                                  + Add to Day
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    ) : null}
                  </div>

                </div>
              ))}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}