// pages/ReservationPage.jsx — calm, high-contrast SaaS reservation lookup
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
      setError('Reservation not found. Please verify your 10-digit reservation number.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      
      {/* Intro */}
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-primary">Find Your Reservation</h1>
        <p className="text-sm text-secondary">
          Enter your 10-digit booking reference to retrieve your itinerary snapshot from MongoDB.
        </p>
      </div>

      {/* Search Card */}
      <div className="card-base space-y-6">
        <form onSubmit={handleSearch} className="space-y-3">
          <label className="block text-xs font-medium text-secondary">
            10-Digit Reservation Number
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={num}
              onChange={e => setNum(e.target.value)}
              placeholder="e.g. 7520260845"
              maxLength={10}
              className="input-base font-mono text-base tracking-wider text-center"
            />
            <button 
              type="submit" 
              disabled={loading} 
              className="btn-primary text-xs whitespace-nowrap px-5"
            >
              {loading ? 'Searching...' : 'Lookup Booking'}
            </button>
          </div>
          <p className="text-[11px] text-muted">
            Reference is generated upon package confirmation and stored permanently.
          </p>
        </form>

        {error && (
          <div className="bg-semantic-errorBg border border-semantic-errorBorder text-semantic-error p-3.5 rounded-lg text-xs flex items-start space-x-2.5">
            <span className="font-semibold text-sm leading-none mt-0.5">!</span>
            <div className="flex-1 font-medium leading-relaxed">{error}</div>
          </div>
        )}

        {data && (
          <div className="bg-surface-nested border border-border rounded-xl p-5 text-left space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <span className="text-[10px] text-muted font-mono uppercase tracking-wider block">Booking Reference</span>
                <span className="font-mono font-bold text-primary text-base">#{data.reservationNumber}</span>
              </div>
              <span className="badge-success text-xs font-medium">Confirmed</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-secondary">
              <div>
                <span className="text-muted block text-[11px]">Destination</span>
                <span className="font-medium text-primary">{data.package.request.country}</span>
              </div>
              <div>
                <span className="text-muted block text-[11px]">Arrival Date</span>
                <span className="font-medium text-primary">{data.package.request.startDate}</span>
              </div>
              <div>
                <span className="text-muted block text-[11px]">Travelers</span>
                <span className="font-medium text-primary">{data.package.request.adults} Adults{data.package.request.children ? `, ${data.package.request.children} Children` : ''}</span>
              </div>
              <div>
                <span className="text-muted block text-[11px]">Total Package Price</span>
                <span className="font-semibold text-primary">₹{data.package.totalInr.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              <a
                href={`/api/reservations/${data.reservationNumber}/export`}
                download={`reservation-${data.reservationNumber}.json`}
                className="btn-secondary text-xs py-1.5 px-3"
              >
                <span>📥 Download JSON</span>
              </a>
              <button
                onClick={() => {
                  localStorage.setItem('bmh_current_pkg_id', data.package.packageId);
                  navigate('package', data.package.packageId);
                }}
                className="btn-primary text-xs py-1.5 px-3"
              >
                <span>Open Full Itinerary &rarr;</span>
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
