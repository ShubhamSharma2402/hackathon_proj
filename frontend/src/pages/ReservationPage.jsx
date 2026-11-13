// pages/ReservationPage.jsx
import React, { useState } from 'react';
import { getReservation } from '../api/client.js';

export default function ReservationPage({ reservationNumber, navigate }) {
  const [num, setNum] = useState(() => reservationNumber || localStorage.getItem('bmh_confirmed_reservation_number') || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSearch(e) {
    e.preventDefault();
    if (!num.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await getReservation(num.trim());
      setData(res.data);
    } catch (err) {
      setError('Reservation not found. Please verify your 10-digit number.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
        <h2 className="text-xl font-bold text-slate-800">Lookup Confirmed Reservation</h2>
        <p className="text-xs text-slate-500 mt-1 mb-6">Enter your 10-digit reservation number to view booking details.</p>

        <form onSubmit={handleSearch} className="flex gap-2 max-w-md mx-auto">
          <input
            type="text"
            value={num}
            onChange={e => setNum(e.target.value)}
            placeholder="e.g. 3935936909"
            className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-center font-mono font-bold text-lg"
          />
          <button type="submit" disabled={loading} className="bg-indigo-600 text-white font-bold px-6 py-2.5 rounded-xl">
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {error && (
          <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
            {error}
          </div>
        )}

        {data && (
          <div className="mt-6 p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-left space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-extrabold text-emerald-900 text-lg">Reservation #{data.reservationNumber}</span>
              <span className="text-xs bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded">CONFIRMED</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-emerald-900">
              <div>Destination: {data.package.request.country}</div>
              <div>Start Date: {data.package.request.startDate}</div>
              <div>Travelers: {data.package.request.adults} Adults, {data.package.request.children || 0} Children</div>
              <div>Total: ₹{data.package.totalInr.toLocaleString('en-IN')}</div>
            </div>
            <div className="flex flex-wrap items-center gap-3 pt-3">
              <a
                href={`/api/reservations/${data.reservationNumber}/export`}
                download={`reservation-${data.reservationNumber}.json`}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition inline-flex items-center space-x-1.5"
              >
                <span>📥 Download JSON</span>
              </a>
              <button
                onClick={() => {
                  localStorage.setItem('bmh_current_pkg_id', data.package.packageId);
                  navigate('package', data.package.packageId);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition inline-flex items-center space-x-1"
              >
                <span>Open Full Itinerary →</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
