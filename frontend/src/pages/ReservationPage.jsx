// pages/ReservationPage.jsx — calm, high-contrast SaaS reservation lookup
import React, { useState } from 'react';
import { getReservation } from '../api/client.js';
import PackageEditor from '../components/PackageEditor.jsx';

export default function ReservationPage({ reservationNumber, navigate }) {
  const [num, setNum] = useState(() => reservationNumber || localStorage.getItem('bmh_confirmed_reservation_number') || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [initialPrice, setInitialPrice] = useState(null);

  async function handleSearch(e) {
    e.preventDefault();
    if (!num.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await getReservation(num.trim());
      setData(res.data);
      setInitialPrice(res.data?.package?.totalInr || null);
    } catch (err) {
      setError('Reservation not found. Please verify your 10-digit reservation number.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`${isEditing ? 'max-w-4xl' : 'max-w-xl'} mx-auto space-y-6 transition-all duration-200`}>
      
      {/* Intro */}
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-primary">Find Your Reservation</h1>
        <p className="text-sm text-secondary">
          Enter your 10-digit booking reference to retrieve or customize your confirmed holiday itinerary snapshot.
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
            Reference is generated upon package confirmation and stored permanently in MongoDB.
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
                <span className="font-semibold text-primary font-mono">₹{data.package.totalInr.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Price & Budget Comparison Block */}
            {initialPrice !== null && (
              <div className="bg-surface border border-accent/25 rounded-xl p-3.5 space-y-2">
                <div className="text-[11px] font-semibold text-primary uppercase tracking-wider flex items-center justify-between">
                  <span>Package Cost &amp; Budget Comparison</span>
                  {data.package.totalInr !== initialPrice && (
                    <span className={`text-xs font-bold font-mono ${data.package.totalInr > initialPrice ? 'text-semantic-error' : 'text-semantic-success'}`}>
                      {data.package.totalInr > initialPrice ? `+₹${(data.package.totalInr - initialPrice).toLocaleString('en-IN')}` : `-₹${Math.abs(data.package.totalInr - initialPrice).toLocaleString('en-IN')}`}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-muted block text-[11px]">Previous Cost</span>
                    <span className="font-semibold text-secondary font-mono">₹{initialPrice.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Current Cost</span>
                    <span className="font-bold text-primary font-mono">₹{data.package.totalInr.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-muted block text-[11px]">Cost Difference</span>
                    <span className={`font-bold font-mono ${data.package.totalInr > initialPrice ? 'text-semantic-error' : data.package.totalInr < initialPrice ? 'text-semantic-success' : 'text-muted'}`}>
                      {data.package.totalInr > initialPrice ? `+₹${(data.package.totalInr - initialPrice).toLocaleString('en-IN')}` : data.package.totalInr < initialPrice ? `-₹${Math.abs(data.package.totalInr - initialPrice).toLocaleString('en-IN')}` : '₹0 (Unchanged)'}
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between text-[11px] gap-2">
                  <span className="text-muted">User Budget: <strong className="text-primary font-mono">₹{data.package.request.budgetInr.toLocaleString('en-IN')}</strong></span>
                  <span className="text-semantic-success font-semibold font-mono">
                    ₹{(data.package.request.budgetInr - data.package.totalInr).toLocaleString('en-IN')} Remaining Savings
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setIsEditing(v => !v)}
                className={`text-xs py-1.5 px-3 rounded-lg font-medium transition duration-150 ease-out border ${
                  isEditing
                    ? 'bg-accent text-white border-accent'
                    : 'bg-surface text-accent hover:bg-surface-nested border-accent'
                }`}
              >
                <span>{isEditing ? '✕ Close Customizer' : '✏️ Edit / Customize Package'}</span>
              </button>
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
                className="btn-secondary text-xs py-1.5 px-3"
              >
                <span>Open Full Itinerary &rarr;</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Package Customizer View (Phase B) */}
      {data && isEditing && (
        <PackageEditor
          packageId={data.package.packageId}
          reservationNumber={data.reservationNumber}
          onUpdate={(updatedPkg) => {
            setData(d => ({ ...d, package: updatedPkg }));
          }}
          onClose={() => setIsEditing(false)}
        />
      )}

    </div>
  );
}
