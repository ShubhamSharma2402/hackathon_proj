# Build My Holiday ✈️

> Autonomous, rule-based holiday itinerary and package generation engine adhering strictly to all Section 4 constraints.

---

## 🚀 Quick Start (Commands to Run)

### Prerequisites
- **Node.js**: v18 or higher
- **MongoDB**: (Optional) MongoDB Atlas or local MongoDB instance on port 27017 (auto-falls back to persistent local storage in `backend/data/store.json`).

### 1. Start the Backend
```bash
cd backend
npm install
npm start
```
*Backend runs on **http://localhost:3001** (or port configured in `.env`).*

### 2. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on **http://localhost:5173** (automatically proxies API requests to backend).*

*(Alternatively, the compiled production build is served directly by the backend at `http://localhost:3001`)*.

---

## 🏛️ Code Architecture

```
flight-project/
├── backend/
│   ├── data/catalog/            # Catalog datasets (destinations, flights, hotels, rooms, transfers, attractions)
│   ├── data/store.json          # Persisted state fallback (packages & confirmed reservations)
│   ├── src/
│   │   ├── catalog/loader.js    # In-memory O(1) Map lookups loaded once at startup
│   │   ├── db/                  # MongoDB Mongoose connection & models (Package & Reservation)
│   │   ├── engine/              # Core rule-based calculation & constraint algorithms
│   │   │   ├── cityPlanner.js       # Hamiltonian path search & integer night partition solver
│   │   │   ├── flightPicker.js      # Outbound & return flight matcher (airports, dates, seats)
│   │   │   ├── hotelPicker.js       # Capacity solver (k rooms formula) & nightly availability check
│   │   │   ├── transferPicker.js    # Airport & intercity transfers with operating window validation
│   │   │   ├── attractionScheduler.js # Daily attraction scheduler (1–2 on full days, 0 on departure)
│   │   │   ├── pricer.js            # Pricing formulas per catalog pricing rules
│   │   │   ├── packageValidator.js  # 24-rule independent validation engine
│   │   │   └── packageBuilder.js    # Master orchestrator generating Cheapest, Fastest, Best Rated
│   │   ├── routes/              # Express API endpoints (/api/catalog, /api/packages, /api/reservations)
│   │   └── server.js            # Express server entry point
├── frontend/
│   ├── src/
│   │   ├── api/client.js        # Axios API client wrapper
│   │   ├── components/
│   │   │   └── PackageEditor.jsx# Interactive Phase B package customizer with live cascading warnings
│   │   ├── pages/
│   │   │   ├── Home.jsx             # Trip request form with live validation & 1-click test presets
│   │   │   ├── PackagePage.jsx      # 3 package profile cards, G3 city switcher, & day-by-day timeline
│   │   │   └── ReservationPage.jsx  # 10-digit booking lookup, cost tracking, & package customizer
│   │   └── App.jsx
├── README.md
```

---

## ✨ Features Implemented

### 1. Must-Have Requirements (M1 – M8)
- **M1: Request Form**: Input departure city, destination country, start date, nights (2–10), adults, children + ages, and budget. Features 1-click quick presets (`Menon Family` & `UAE Trip`).
- **M2: Complete Package Generation**: Deterministic constraint solver builds a complete package (flights, airport transfers, hotels, intercity transfers, attractions).
- **M3: Strict Section 4 Rule Compliance**: All 24 rules (dates, flights, hotel room capacities, transfer pickup buffers, attraction limits) verified on initial build and after every modification.
- **M4: Day-by-Day Timeline**: Chronological itinerary view displaying flights, hotel check-ins, transfers, and attractions with duration and image previews.
- **M5: Total Cost & Budget Gauge**: Live cost in INR, remaining budget savings or overage badge, and Section 6 trip JSON export.
- **M6: In-Depth Package Customization**: Travelers can swap hotels, change flights, and add or remove attractions with real-time recalculation.
- **M7: Confirmed Reservation & Lookup**: Generates a 10-digit reservation reference. Permanently persisted in MongoDB and searchable anytime in **Find Reservation** (even across server restarts).
- **M8: Budget Too Small Handler**: When no package fits the budget, calculates the cheapest possible package, cost deficit, and actionable suggestions.

### 2. Good-to-Have Requirements (G1 – G4)
- **G1: Cascading Change Warnings**:
  - **Hotel Area Mismatch**: Warns if a new hotel's area (e.g. Shinjuku) conflicts with scheduled airport transfers (e.g. Ueno).
  - **Flight Timing Conflicts**: Alerts if flight times fall outside transfer operating hours or conflict with hotel check-in/out windows.
- **G2: Real-Time Price Differences ($\Delta$ ₹)**: Every swap option explicitly shows the cost delta (`+₹...` or `-₹...`) against the current selection.
- **G3: Alternative City Plan Switcher**: Displays all valid multi-city distributions for the destination country and duration. Provides 1-click recalculation and instant timeline re-rendering.
- **G4: Three Distinct Package Profiles**:
  - 💰 **Cheapest**: Lowest total package price in INR.
  - ⚡ **Fastest**: Shortest total travel time across all transportation methods:
    $$\text{Travel Time} = \text{Flight 1} + \text{Arrival Transfer} + \sum \text{Intercity Transfers} + \text{Departure Transfer} + \text{Flight 2}$$
  - ⭐ **Best Rated**: Highest average hotel star rating per night within budget.

### 3. Plan Flexibility & Cost Tracking (Phase B)
- **Post-Confirmation Customization**: Bookings retrieved via 10-digit reference in **Find Reservation** can be customized directly.
- **Budget Tracking**: Displays previous cost, updated cost, and exact difference (`+₹...` / `-₹...`) alongside the traveler's budget limit.
- **Attraction Day Limits**: Strictly enforces 1–2 attractions on full days (disables removing the last attraction) and 0 attractions on departure day.

---

## 📋 Section 4 Rule Summary

| Category | Rule Specification |
| :--- | :--- |
| **Window** | Available travel dates strictly between **April 1 and April 20, 2027**. |
| **Duration** | Trip duration between **2 and 10 nights**. |
| **Cities** | All cities belong to destination country; each city has **at least 2 consecutive nights**. |
| **Flights** | Non-stop flights only; arrival lands on start date; return departs on final day; seats $\ge$ travelers. |
| **Hotels** | Exactly 1 hotel per city; $k$ rooms rule: $\text{adults} \le k \cdot \text{max\_adults}$, $\text{travelers} \le k \cdot (\text{max\_adults} + \text{max\_children})$, $\text{adults} \ge k$. |
| **Transfers** | Airport pickup $\ge 60$ min after landing; departure pickup $\ge 180$ min before flight departure; operating hours respected. |
| **Attractions** | 1–2 per full day; 0–1 on arrival/city-change days; strictly **0 on departure day**; non-overlapping. |

---

## 🛡️ Persistence & Reliability
- **Dual-Layer Persistence**: Packages and reservations are stored in MongoDB Atlas and mirrored to `backend/data/store.json`.
- **Zero AI in Runtime Engine**: All pricing, scheduling, and validation are 100% deterministic and rule-based.
