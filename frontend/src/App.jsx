// App.jsx — clean tab-based navigation with error boundary
import React, { useState, Component } from 'react'
import Home from './pages/Home.jsx'
import PackagePage from './pages/PackagePage.jsx'
import ReservationPage from './pages/ReservationPage.jsx'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-xl mx-auto my-12 bg-white rounded-2xl shadow-sm border border-red-100 p-8 text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-bold text-slate-800">Something went wrong</h2>
          <p className="text-xs text-slate-500">
            {this.state.error?.message || 'An unexpected error occurred while rendering the page.'}
          </p>
          <div className="pt-2 flex justify-center gap-2">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition"
            >
              Reload Page
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.href = '/'
              }}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2.5 rounded-xl border transition"
            >
              Go to Home
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  const [currentTab, setCurrentTab] = useState('home')
  const [activePackageId, setActivePackageId] = useState(null)
  const [activeResNumber, setActiveResNumber] = useState(null)

  function navigate(view, param = null) {
    if (view === 'package' || view.startsWith('/package/')) {
      const id = param || view.split('/package/')[1]
      setActivePackageId(id)
      setCurrentTab('package')
    } else if (view === 'reservation' || view.startsWith('/reservation/')) {
      const num = param || view.split('/reservation/')[1]
      setActiveResNumber(num)
      setCurrentTab('reservation')
    } else {
      setCurrentTab('home')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top Header */}
      <header className="bg-indigo-600 text-white shadow sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentTab('home')}>
            <span class="text-2xl">✈️</span>
            <div>
              <h1 className="text-xl font-bold tracking-tight leading-none">Build My Holiday</h1>
              <p className="text-xs text-indigo-200 mt-0.5">Automated Multi-City Travel Packages</p>
            </div>
          </div>
          <nav className="flex items-center space-x-2 text-sm">
            <button
              onClick={() => setCurrentTab('home')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${currentTab === 'home' ? 'bg-indigo-700 text-white font-bold' : 'hover:bg-indigo-700 text-indigo-100'}`}
            >
              Plan Trip
            </button>
            <button
              onClick={() => setCurrentTab('package')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${currentTab === 'package' ? 'bg-indigo-700 text-white font-bold' : 'hover:bg-indigo-700 text-indigo-100'}`}
            >
              Itinerary
            </button>
            <button
              onClick={() => setCurrentTab('reservation')}
              className={`px-3 py-1.5 rounded-lg font-medium transition ${currentTab === 'reservation' ? 'bg-indigo-700 text-white font-bold' : 'hover:bg-indigo-700 text-indigo-100'}`}
            >
              Find Reservation
            </button>
          </nav>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <ErrorBoundary>
          {currentTab === 'home' && <Home navigate={navigate} />}
          {currentTab === 'package' && <PackagePage packageId={activePackageId} navigate={navigate} />}
          {currentTab === 'reservation' && <ReservationPage reservationNumber={activeResNumber} navigate={navigate} />}
        </ErrorBoundary>
      </main>
    </div>
  )
}
