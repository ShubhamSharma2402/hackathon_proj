// pages/Home.jsx
// Form with editable dropdowns (datalist) allowing dropdown selection OR manual typing.
// Presets for hackathon demo.

import { useState, useEffect } from 'react'
import { getFormData, buildPackage } from '../api/client.js'

export default function Home({ navigate }) {
  // --- Catalog data for dropdowns ---
  const [departureCities, setDepartureCities] = useState([])
  const [countries, setCountries] = useState([])
  const [rules, setRules] = useState(null)

  // --- Form state ---
  const [form, setForm] = useState({
    departureAirport: 'BLR',
    country: 'Japan',
    startDate: '2027-04-10',
    nights: 6,
    adults: 2,
    children: 1,
    childAges: [6],
    budgetInr: 350000,
  })

  // --- UI state ---
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [formErrs, setFormErrs] = useState({})

  // Load departure cities and countries from backend on mount
  useEffect(() => {
    getFormData()
      .then(res => {
        setDepartureCities(res.data.departureCities || [])
        setCountries(res.data.countries || [])
        setRules(res.data.rules || null)
      })
      .catch(() => setError('Could not connect to backend API. Please make sure backend is running.'))
  }, [])

  // Presets
  function loadMenonPreset() {
    setForm({
      departureAirport: 'BLR',
      country: 'Japan',
      startDate: '2027-04-10',
      nights: 6,
      adults: 2,
      children: 1,
      childAges: [6],
      budgetInr: 350000,
    })
    setError(null)
  }

  function loadUaePreset() {
    setForm({
      departureAirport: 'DEL',
      country: 'United Arab Emirates',
      startDate: '2027-04-05',
      nights: 5,
      adults: 2,
      children: 0,
      childAges: [],
      budgetInr: 250000,
    })
    setError(null)
  }

  function handleChildrenChange(count) {
    const n = Math.max(0, parseInt(count) || 0)
    setForm(f => ({
      ...f,
      children: n,
      childAges: Array.from({ length: n }, (_, i) => f.childAges[i] ?? 6),
    }))
  }

  function updateChildAge(index, age) {
    setForm(f => {
      const ages = [...f.childAges]
      ages[index] = parseInt(age) || 0
      return { ...f, childAges: ages }
    })
  }

  function validate() {
    const errs = {}
    if (!form.departureAirport.trim()) errs.departureAirport = 'Enter or select a departure city'
    if (!form.country.trim()) errs.country = 'Enter or select a destination country'
    if (!form.startDate) errs.startDate = 'Enter a start date'
    if (form.nights < 3 || form.nights > 10) errs.nights = 'Nights must be between 3 and 10'
    if (form.adults < 1) errs.adults = 'At least 1 adult required'
    if (form.budgetInr <= 0) errs.budgetInr = 'Budget must be greater than 0'
    form.childAges.forEach((age, i) => {
      if (age < 0 || age > 17) errs[`age_${i}`] = `Child ${i + 1} age must be 0–17`
    })
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setFormErrs(errs)
      return
    }

    setFormErrs({})
    setLoading(true)
    setError(null)

    try {
      const res = await buildPackage(form)
      const data = res.data

      if (data.status === 'ERROR') {
        setError(data.message || 'No package possible for these inputs.')
        return
      }

      if (data.status === 'BUDGET_TOO_SMALL') {
        localStorage.setItem('bmh_current_pkg_id', data.package.packageId)
        localStorage.setItem('bmh_current_package', JSON.stringify(data.package))
        localStorage.setItem('bmh_package_cards', JSON.stringify([]))
        localStorage.setItem('bmh_budget_warning', data.suggestion)
        navigate('package', data.package.packageId)
        return
      }

      // Save package and the 3 options (packageCards)
      localStorage.setItem('bmh_current_pkg_id', data.package.packageId)
      localStorage.setItem('bmh_current_package', JSON.stringify(data.package))
      localStorage.setItem('bmh_package_cards', JSON.stringify(data.packageCards || []))
      localStorage.setItem('bmh_available_city_plans', JSON.stringify(data.availableCityPlans || []))
      localStorage.removeItem('bmh_budget_warning')

      navigate('package', data.package.packageId)
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Unable to build package. Check source and destination.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Header Intro */}
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-primary">Plan Your Holiday</h1>
        <p className="text-sm text-secondary">
          Configure your travel requirements. The engine calculates all valid flights, hotels, and transfers according to Section 4 rules.
        </p>
      </div>

      {/* Demo Presets Card */}
      <div className="bg-surface-nested border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <div className="text-xs font-semibold text-primary flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-accent"></span>
            <span>Quick Test Presets</span>
          </div>
          <p className="text-xs text-muted mt-0.5">
            1-click configurations for evaluation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={loadMenonPreset}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            Menon Family (BLR → Japan, 6N)
          </button>
          <button
            type="button"
            onClick={loadUaePreset}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            UAE Trip (DEL → UAE, 5N)
          </button>
        </div>
      </div>

      {/* Main Configuration Card */}
      <div className="card-base">
        {error && (
          <div className="bg-semantic-errorBg border border-semantic-errorBorder text-semantic-error px-4 py-3 rounded-lg mb-6 text-xs flex items-start space-x-2.5">
            <span className="font-semibold text-sm leading-none mt-0.5">!</span>
            <div className="flex-1 font-medium leading-relaxed">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Departure City */}
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">
                Departure City / Airport
                <span className="text-muted block font-normal text-[11px]">Select from dataset or type custom city</span>
              </label>
              <input
                type="text"
                list="departure-cities-list"
                value={form.departureAirport}
                onChange={set('departureAirport')}
                placeholder="e.g. BLR, DEL, BOM, MAA"
                className="input-base"
              />
              <datalist id="departure-cities-list">
                {departureCities.map(c => (
                  <option key={c.airport} value={c.airport}>{c.city} ({c.airport})</option>
                ))}
              </datalist>
              {formErrs.departureAirport && <p className="text-semantic-error text-xs mt-1">{formErrs.departureAirport}</p>}
            </div>

            {/* Destination Country */}
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">
                Destination Country
                <span className="text-muted block font-normal text-[11px]">Select from dataset or type custom country</span>
              </label>
              <input
                type="text"
                list="destination-countries-list"
                value={form.country}
                onChange={set('country')}
                placeholder="e.g. Japan, United Arab Emirates"
                className="input-base"
              />
              <datalist id="destination-countries-list">
                {countries.map(c => (
                  <option key={c.code} value={c.name}>{c.name} ({c.code})</option>
                ))}
              </datalist>
              {formErrs.country && <p className="text-semantic-error text-xs mt-1">{formErrs.country}</p>}
            </div>

            {/* Holiday Start Date */}
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">
                Holiday Start Date
                <span className="text-muted block font-normal text-[11px]">Arrival day in destination</span>
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={set('startDate')}
                min="2027-04-01"
                max="2027-04-20"
                className="input-base"
              />
              <p className="text-[11px] text-muted mt-1">Available data window: 1 to 20 April 2027.</p>
              {formErrs.startDate && <p className="text-semantic-error text-xs mt-1">{formErrs.startDate}</p>}
            </div>

            {/* Nights */}
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">
                Trip Duration (Nights)
                <span className="text-muted block font-normal text-[11px]">Must be between 3 and 10 nights</span>
              </label>
              <input
                type="number"
                value={form.nights}
                onChange={e => setForm(f => ({ ...f, nights: parseInt(e.target.value) || 3 }))}
                min="3" max="10"
                className="input-base font-semibold"
              />
              {formErrs.nights && <p className="text-semantic-error text-xs mt-1">{formErrs.nights}</p>}
            </div>

            {/* Adults */}
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">
                Adults (18+)
                <span className="text-muted block font-normal text-[11px]">At least 1 adult traveler</span>
              </label>
              <input
                type="number"
                value={form.adults}
                onChange={e => setForm(f => ({ ...f, adults: parseInt(e.target.value) || 1 }))}
                min="1" max="10"
                className="input-base font-semibold"
              />
              {formErrs.adults && <p className="text-semantic-error text-xs mt-1">{formErrs.adults}</p>}
            </div>

            {/* Children & Ages */}
            <div>
              <label className="block text-xs font-medium text-secondary mb-1.5">
                Children (0–17)
                <span className="text-muted block font-normal text-[11px]">Ages required for hotel bed rules</span>
              </label>
              <input
                type="number"
                value={form.children}
                onChange={e => handleChildrenChange(e.target.value)}
                min="0" max="8"
                className="input-base font-semibold"
              />
              {form.childAges.map((age, i) => (
                <div key={i} className="mt-2 flex items-center space-x-2 text-xs">
                  <span className="text-muted">Child {i + 1} age:</span>
                  <input
                    type="number"
                    value={age}
                    onChange={e => updateChildAge(i, e.target.value)}
                    min="0" max="17"
                    className="w-14 input-base py-1 px-2 text-center font-semibold text-xs"
                  />
                  {formErrs[`age_${i}`] && <p className="text-semantic-error text-xs">{formErrs[`age_${i}`]}</p>}
                </div>
              ))}
            </div>

            {/* Budget */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-secondary mb-1.5">
                Total Budget (₹ INR)
                <span className="text-muted block font-normal text-[11px]">Maximum budget in Indian Rupees</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-muted font-medium text-sm">₹</span>
                <input
                  type="number"
                  value={form.budgetInr}
                  onChange={e => setForm(f => ({ ...f, budgetInr: parseInt(e.target.value) || 0 }))}
                  min="0"
                  step="1000"
                  className="input-base pl-8 font-semibold"
                />
              </div>
              {formErrs.budgetInr && <p className="text-semantic-error text-xs mt-1">{formErrs.budgetInr}</p>}
            </div>

          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 text-sm"
            >
              {loading ? 'Calculating Packages Across Catalog...' : 'Build Complete Holiday Package'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
