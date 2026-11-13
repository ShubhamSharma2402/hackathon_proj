// pages/PackagePage.jsx
// Full Itinerary view featuring:
// - 3 Calculated Package Options (Cheapest, Fastest, Best Rated) [G4]
// - Budget Gauge (Cost vs Budget) [M5]
// - Day-by-Day Chronological Timeline [M4]
// - Alternative City Plans [G3]
// - Download JSON [Section 6] & Confirm Reservation [M7]

import React, { useState, useEffect } from 'react';
import { getPackage, confirmPackage, changeHotel, changeFlight, changeAttractions } from '../api/client.js';

export default function PackagePage({ packageId, navigate }) {
  const [pkg, setPkg] = useState(null);
  const [packageCards, setPackageCards] = useState([]);
  const [cityPlans, setCityPlans] = useState([]);
  const [budgetWarning, setBudgetWarning] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);

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
        <div className="bg-amber-50 border border-amber-300 text-amber-900 p-4 rounded-2xl text-xs flex items-start space-x-2">
          <span className="text-base">💡</span>
          <div>
            <div className="font-bold text-sm">Budget Too Small (M8 Suggestion)</div>
            <div className="mt-0.5">{budgetWarning}</div>
          </div>
        </div>
      )}

      {/* Top Header Card & Budget Bar (M5) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${pkg.status === 'BOOKED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {pkg.status}
              </span>
              <span className="text-xs text-slate-400 font-mono">ID: {(pkg.packageId || '').slice(0, 8)}...</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 mt-1">{pkg.request?.country || 'Trip'}: {(pkg.cityPlan || []).join(' → ')}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {pkg.request?.nights || 0} Nights ({pkg.request?.startDate || ''} to {pkg.items && pkg.items.length > 0 ? (pkg.items[pkg.items.length - 1]?.start?.slice(0, 10) || '') : ''}) • {pkg.request?.adults || 0} Adults{pkg.request?.children ? `, ${pkg.request.children} Children` : ''}
            </p>
          </div>

          {/* Download JSON & Reservation Number: Only rendered in top header AFTER booking (M7 requirement) */}
          {pkg.status === 'BOOKED' && (
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`/api/packages/${pkg.packageId}/export`}
                download={`holiday-package-${pkg.packageId}.json`}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 transition flex items-center space-x-1.5"
              >
                <span>📥 Download JSON</span>
              </a>
              <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs px-3 py-2 rounded-xl flex items-center space-x-1">
                <span>Reservation #{pkg.reservationNumber}</span>
              </div>
            </div>
          )}
        </div>

        {/* Budget Numbers */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <div className="text-xs text-slate-500 font-semibold">Total Cost</div>
            <div className="text-2xl font-black text-slate-900">₹{total.toLocaleString('en-IN')}</div>
          </div>
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
            <div className="text-xs text-slate-500 font-semibold">Your Budget</div>
            <div className="text-2xl font-black text-slate-700">₹{budget.toLocaleString('en-IN')}</div>
          </div>
          <div className={`p-3.5 rounded-xl border ${diff >= 0 ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
            <div className="text-xs font-semibold">{diff >= 0 ? 'Under Budget (Savings)' : 'Over Budget'}</div>
            <div className="text-2xl font-black">₹{Math.abs(diff).toLocaleString('en-IN')}</div>
          </div>
        </div>

        {/* 3 Calculated Package Options (G4) */}
        {packageCards && packageCards.length > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-700 flex items-center">
                ✨ Calculated Package Options ({packageCards.length} Options Generated)
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">Click any card to view its day-by-day plan</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    className={`rounded-xl border p-4 transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-indigo-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          card.category === 'cheapest'
                            ? 'bg-emerald-100 text-emerald-800'
                            : card.category === 'fastest'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {card.badge}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="mt-3">
                        <div className="text-2xl font-black text-slate-900">
                          ₹{(card.package.totalInr || 0).toLocaleString('en-IN')}
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          {(card.package.cityPlan || []).join(' → ')} ({card.package.request?.nights || 0} Nights)
                        </p>
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Total Travel Duration:</span>
                          <span className="font-bold text-slate-800">{travelHours}h {travelMins}m</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Avg Hotel Rating:</span>
                          <span className="font-bold text-amber-600">{stars} ★</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Total Items:</span>
                          <span className="font-bold text-slate-800">{(card.package.items || []).length} items</span>
                        </div>
                      </div>
                    </div>

                    {isSelected ? (
                      <div className="mt-4 space-y-2">
                        <div className="w-full py-2 rounded-lg text-xs font-bold text-center bg-indigo-600 text-white shadow-sm flex items-center justify-center space-x-1">
                          <span>Currently Viewing</span>
                        </div>
                        {pkg.status !== 'BOOKED' ? (
                          <button
                            type="button"
                            disabled={confirming}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfirmReservation(card.package.packageId);
                            }}
                            className="w-full py-2.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md transition flex items-center justify-center space-x-1.5 cursor-pointer"
                          >
                            <span>✓</span>
                            <span>{confirming ? 'Confirming Reservation...' : 'Confirm Reservation'}</span>
                          </button>
                        ) : (
                          <div className="w-full py-2 rounded-xl text-xs font-bold text-center bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center justify-center space-x-1">
                            <span>✓ Reserved (#{pkg.reservationNumber})</span>
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
                        className="mt-4 w-full py-2.5 rounded-xl text-xs font-bold transition bg-slate-100 text-slate-700 hover:bg-slate-200"
                      >
                        Select This Package
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Fallback Confirm Button if no package cards present */}
        {(!packageCards || packageCards.length === 0) && pkg.status !== 'BOOKED' && (
          <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              disabled={confirming}
              onClick={() => handleConfirmReservation(pkg.packageId)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md transition flex items-center space-x-1.5"
            >
              <span>✓</span>
              <span>{confirming ? 'Confirming Reservation...' : 'Confirm Reservation'}</span>
            </button>
          </div>
        )}

      </div>

      {/* Day-by-Day Timeline (M4) */}
      <div className="space-y-4">
        <h3 className="font-bold text-slate-800 text-lg flex items-center">
          📅 Day-by-Day Itinerary ({(pkg.items || []).length} Activities)
        </h3>

        <div className="space-y-3">
          {(pkg.items || []).map((item, idx) => {
            if (!item) return null;
            const timeStr = item.start && item.start.includes('T') ? item.start.slice(11, 16) : (item.start || '');
            const endStr = item.end && item.end.includes('T') ? item.end.slice(11, 16) : (item.end || '');

            let badgeColor = 'bg-slate-100 text-slate-700';
            let icon = '🏷️';
            if (item.type === 'flight') { badgeColor = 'bg-blue-100 text-blue-800'; icon = '✈️'; }
            else if (item.type === 'transfer') { badgeColor = 'bg-emerald-100 text-emerald-800'; icon = '🚕'; }
            else if (item.type === 'hotel') { badgeColor = 'bg-amber-100 text-amber-800'; icon = '🏨'; }
            else if (item.type === 'attraction') { badgeColor = 'bg-purple-100 text-purple-800'; icon = '🏛️'; }

            return (
              <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border flex items-center justify-center text-lg">
                    {icon}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${badgeColor}`}>
                        {item.type}
                      </span>
                      <span className="font-bold text-sm text-slate-800">{item.name}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                      <span>🕒 {timeStr}{endStr ? ` → ${endStr}` : ''}</span>
                      <span>•</span>
                      <span>📍 {item.city}</span>
                      {item.quantity && (
                        <>
                          <span>•</span>
                          <span>Qty: {item.quantity}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-black text-sm text-slate-900">
                    ₹{item.price_inr.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
