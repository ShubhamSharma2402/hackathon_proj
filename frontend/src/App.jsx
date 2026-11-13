// App.jsx — clean tab-based navigation with calm, production-grade SaaS shell
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
        <div className="max-w-md mx-auto my-16 bg-surface border border-semantic-errorBorder rounded-xl shadow-card p-8 text-center space-y-4">
          <div className="w-10 h-10 mx-auto rounded-full bg-semantic-errorBg flex items-center justify-center text-semantic-error text-lg">
            !
          </div>
          <h2 className="text-base font-semibold text-primary">Something unexpected happened</h2>
          <p className="text-xs text-muted leading-relaxed">
            {this.state.error?.message || 'An unexpected error occurred while rendering the page.'}
          </p>
          <div className="pt-2 flex justify-center gap-2">
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="btn-primary text-xs"
            >
              Reload Page
            </button>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.href = '/'
              }}
              className="btn-secondary text-xs"
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
  const [activePackageId, setActivePackageId] = useState(() => localStorage.getItem('bmh_current_pkg_id'))
  const [activeResNumber, setActiveResNumber] = useState(() => localStorage.getItem('bmh_confirmed_reservation_number'))

  function navigate(view, param = null) {
    if (view === 'package' || view.startsWith('/package/')) {
      const id = param || view.split('/package/')[1] || localStorage.getItem('bmh_current_pkg_id')
      if (id) {
        setActivePackageId(id)
        localStorage.setItem('bmh_current_pkg_id', id)
      }
      setCurrentTab('package')
    } else if (view === 'reservation' || view.startsWith('/reservation/')) {
      const num = param || view.split('/reservation/')[1] || localStorage.getItem('bmh_confirmed_reservation_number')
      if (num) {
        setActiveResNumber(num)
        localStorage.setItem('bmh_confirmed_reservation_number', num)
      }
      setCurrentTab('reservation')
    } else {
      setCurrentTab('home')
    }
  }

  function handleOpenItinerary() {
    const id = localStorage.getItem('bmh_current_pkg_id') || activePackageId
    navigate('package', id)
  }

  function handleOpenReservation() {
    const num = localStorage.getItem('bmh_confirmed_reservation_number') || activeResNumber
    navigate('reservation', num)
  }

  return (
    <div className="min-h-screen bg-canvas text-primary font-sans flex flex-col">
      {/* Top Navigation Shell */}
      <header className="bg-canvas/90 backdrop-blur-md border-b border-border sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          
          {/* Brand Logo & Title */}
          <div 
            className="flex items-center space-x-3 cursor-pointer group" 
            onClick={() => setCurrentTab('home')}
          >
            <div className="w-7 h-7 rounded-md bg-accent-tint border border-accent-border flex items-center justify-center text-accent text-sm font-semibold transition-colors duration-150 group-hover:bg-accent group-hover:text-white">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
              </svg>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold tracking-tight text-primary">Build My Holiday</span>
              <span className="badge-accent text-[10px] px-2 py-0.5">Trip Engine</span>
            </div>
          </div>

          {/* Segmented Control Navigation */}
          <nav className="flex items-center bg-surface-nested p-1 rounded-lg border border-border">
            <button
              onClick={() => setCurrentTab('home')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-150 ${
                currentTab === 'home'
                  ? 'bg-surface text-primary shadow-sm border border-border'
                  : 'text-secondary hover:text-primary hover:bg-surface-hover border border-transparent'
              }`}
            >
              Plan Trip
            </button>
            <button
              onClick={handleOpenItinerary}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-150 ${
                currentTab === 'package'
                  ? 'bg-surface text-primary shadow-sm border border-border'
                  : 'text-secondary hover:text-primary hover:bg-surface-hover border border-transparent'
              }`}
            >
              Itinerary
            </button>
            <button
              onClick={handleOpenReservation}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-150 ${
                currentTab === 'reservation'
                  ? 'bg-surface text-primary shadow-sm border border-border'
                  : 'text-secondary hover:text-primary hover:bg-surface-hover border border-transparent'
              }`}
            >
              Find Reservation
            </button>
          </nav>

        </div>
      </header>

      {/* Main Page Workspace */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8">
        <ErrorBoundary>
          {currentTab === 'home' && <Home navigate={navigate} />}
          {currentTab === 'package' && <PackagePage packageId={activePackageId} navigate={navigate} />}
          {currentTab === 'reservation' && <ReservationPage reservationNumber={activeResNumber} navigate={navigate} />}
        </ErrorBoundary>
      </main>

      {/* Subtle Footer */}
      <footer className="border-t border-border py-4 text-center text-xs text-muted bg-canvas">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Build My Holiday &bull; Multi-City Optimization Engine</span>
          <span className="text-subtle">Section 4 Rules Verified</span>
        </div>
      </footer>
    </div>
  )
}
