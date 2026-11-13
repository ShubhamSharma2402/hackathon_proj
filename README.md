# Problem 1: Holiday Package → Build My Holiday ✈️

A full-stack web application that automatically builds, customizes, confirms, and exports complete holiday travel packages adhering strictly to all travel rules in Section 4.

---

## 🚀 How to Start the App (1 Command)

### Prerequisites
- Node.js (v18+)
- MongoDB (running locally on port 27017, or auto-falls back to persistent local storage)

### Start Command
```bash
cd backend
npm install
npm start
```

The application will start on **http://localhost:3001**.
Open your browser and navigate to:
👉 **http://localhost:3001**

*(Alternatively, to run the automated end-to-end verification test suite: `node test-flow.js`)*

---

## 🏛️ System Architecture

```
flight-project/
├── backend/
│   ├── public/                      # Responsive frontend web application (Single Page App)
│   │   ├── index.html               # Main user interface (Form, Timeline, Modals)
│   │   └── app.js                   # Client state management, API calls, event handlers
│   ├── src/
│   │   ├── catalog/
│   │   │   └── loader.js            # O(1) in-memory maps loaded once from JSON catalog files
│   │   ├── db/
│   │   │   ├── connection.js        # Mongoose / MongoDB connection
│   │   │   ├── models/              # Package & Reservation Mongoose schemas
│   │   │   └── storage.js           # Dual-layer persistent storage (MongoDB + local JSON fallback)
│   │   ├── engine/                  # Core Business Logic & Rule Enforcement
│   │   │   ├── cityPlanner.js       # City permutation & night partition solver
│   │   │   ├── flightPicker.js      # Outbound & return flight matcher (airports, dates, seats)
│   │   │   ├── hotelPicker.js       # Hotel & room type solver (k rooms capacity & nightly availability)
│   │   │   ├── transferPicker.js    # Airport & intercity transfers with service window checks
│   │   │   ├── attractionScheduler.js# Non-overlapping attraction scheduler matching open hours
│   │   │   ├── pricer.js            # Strict pricing engine using Section 4 mathematical formulas
│   │   │   ├── packageValidator.js  # Independent 24-rule verification engine
│   │   │   └── packageBuilder.js    # Master orchestrator (cheapest, fastest, best-rated variants)
│   │   ├── routes/
│   │   │   ├── catalog.js           # Form data & filtering endpoints
│   │   │   ├── packages.js          # POST build, GET by id, PATCH hotel/flight/attractions, confirm, export
│   │   │   └── reservations.js      # Lookup confirmed bookings by 10-digit number
│   │   └── server.js                # Express server entry point
│   ├── test-flow.js                 # Complete automated test suite covering M1-M8
│   └── package.json
└── README.md
```

---

## 🗺️ City Rule Implementation
- **Rule Constraints:**
  - Trip length: 3 to 10 nights.
  - All cities must belong to the chosen destination country.
  - Each city in the itinerary has **at least 2 consecutive nights**.
  - Each city appears **at most once** in the plan.
  - Consecutive cities must have a valid transfer link between them (from `destinations.json`).
- **Algorithm:**
  - Backtracking search finds all Hamiltonian paths of length $1 \le k \le \lfloor \text{nights}/2 \rfloor$.
  - Generates integer partitions of total nights into $k$ parts where each part $\ge 2$.
  - Multi-city itineraries are prioritized for longer trips, and users can switch between valid city permutations.

---

## 📋 Features Completed

### Must-Have Features (M1 to M8) — 100% Complete
- **M1: Request Form** — All 7 request fields, dropdowns dynamically populated from `destinations.json`, live validation.
- **M2: Build One Package** — Multi-step constraint solver builds complete package (flights, airport transfers, hotels, intercity transfers, attractions). Clear error reason when impossible.
- **M3: Rules are Respected** — Every single rule in Section 4 is verified on build and after every modification.
- **M4: Day-by-Day Plan** — Clean chronological timeline: outbound flights, airport pickups, hotels, scheduled attractions, intercity transfers, return airport transfers, return flights.
- **M5: Total & Budget** — Live total in INR, remaining budget savings or overage badge. One-click JSON export in Section 6 format.
- **M6: Change the Package** — Interactive modal dialogs to:
  - Change hotel in a city (filtered by capacity and availability).
  - Change arrival or return flight (auto-adjusts airport transfer pickup times).
  - Add or remove attractions (schedules within open hours without overlap).
- **M7: Confirm & Reservation Summary** — Generates unique 10-digit reservation number. Persists to MongoDB. Look up anytime on the "Find Reservation" tab, even after server restart. Invalid numbers display `"not found"`.
- **M8: Budget Too Small** — When no package fits the budget, app displays the cheapest possible package, difference amount, and actionable suggestions.

### Good-to-Have Features Reached
- **G1: Cascading Changes** — Flight updates automatically recompute airport transfer pickup and drop-off times.
- **G2: Price Difference** — Change modals display real-time price delta ($\Delta$ ₹) against current selection.
- **G3: Change Cities** — Interactive route selector allows travelers to switch city combinations (e.g. Tokyo 6N vs Tokyo 2N + Kyoto 4N) and rebuilds the package on the fly.
- **G4: Three Packages Selection** — The app calculates all possible valid packages across all flight, hotel, and transfer combinations and returns:
  1. 💰 **The Cheapest** (lowest total price in INR).
  2. ⚡ **The Fastest** (least total travel duration: sum of flight durations + all intercity transfer durations).
  3. ⭐ **The Best Rated** (highest average hotel stars per night within budget; guest rating ignored per spec).
  - On a tie, selects either one. If fewer than 3 packages fit within budget, shows available packages under applicable categories. The traveler selects one with a single click.

### Source & Destination Validation (Edge Cases)
- If a source or destination is entered that does not exist in the catalog (e.g., departure city outside BLR/DEL/BOM/MAA, or destination country outside Japan/UAE), the system returns a clear error message stating that there are no available packages for that route.

### Stretch Features Reached
- **S1: Quick Request** — Rule-based natural language parser extracts departure, country, dates, nights, travelers, and budget from plain text without external AI.

---

## 🛡️ Persistence & Fault Tolerance
- Packages and reservations are stored in **MongoDB** (`packages` and `reservations` collections).
- When confirmed, an immutable snapshot is preserved in `reservations` under the unique 10-digit reservation number.
- Even if MongoDB is temporarily unavailable or running in a sandboxed offline environment, a synchronized JSON fallback ensures 100% operational uptime without crashes.

---

## 📝 Demo Walkthrough Script (12 Minutes)
1. **00:00 - 01:00:** Open `http://localhost:3001`. Show the clean UI and empty form.
2. **01:00 - 02:30:** Click `"Load Menon Family Preset"`. Review all 7 populated fields (BLR → Japan, 10 Apr 2027, 6N, 2 Adults + 1 Child age 6, ₹3,50,000 budget). Click **"Build Complete Holiday Package"**.
3. **02:30 - 04:00:** Review day-by-day timeline:
   - Flights with correct seats and local arrival date.
   - Airport transfers booked 60m after arrival / 180m before departure.
   - Hotel room fit with valid capacity for 3 travelers.
   - 1-2 attractions per full day without schedule conflicts.
   - Budget bar showing total under budget.
4. **04:00 - 05:30:** Demonstrate customizations:
   - Click **"Change Hotel"** → view price difference ($\pm$ ₹) → select alternate hotel.
   - Click **"Add Attraction"** → pick sight → observe price and schedule update.
5. **05:30 - 07:00:** Click **"Confirm Reservation"** → note the 10-digit number (e.g. `3935936909`).
6. **07:00 - 08:30:** Click **"Download JSON"** → open downloaded file to show judges the exact Section 6 schema.
7. **08:30 - 09:30:** Switch to **"Find Reservation"** tab → enter the 10-digit number → show instant retrieval from MongoDB. Enter an invalid number to show `"not found"`.
8. **09:30 - 12:00:** Enter any custom judge requests (e.g., UAE destination, different nights, or small budget to trigger M8).
