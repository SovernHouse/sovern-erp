import React, { useState, useEffect, Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
const Login = React.lazy(() => import('./pages/Auth/Login'))
const ForgotPassword = React.lazy(() => import('./pages/Auth/ForgotPassword'))
const Dashboard = React.lazy(() => import('./pages/Dashboard'))
const ProductCatalog = React.lazy(() => import('./pages/Products/ProductCatalog'))
const ProductDetail = React.lazy(() => import('./pages/Products/ProductDetail'))
const QuotationRequest = React.lazy(() => import('./pages/Quotations/QuotationRequest'))
const QuotationList = React.lazy(() => import('./pages/Quotations/QuotationList'))
const QuotationDetail = React.lazy(() => import('./pages/Quotations/QuotationDetail'))
const QuoteComparison = React.lazy(() => import('./pages/Quotations/QuoteComparison'))
const OrderList = React.lazy(() => import('./pages/Orders/OrderList'))
const OrderDetail = React.lazy(() => import('./pages/Orders/OrderDetail'))
const ShipmentTracker = React.lazy(() => import('./pages/Shipments/ShipmentTracker'))
const ClaimList = React.lazy(() => import('./pages/Claims/ClaimList'))
const ClaimForm = React.lazy(() => import('./pages/Claims/ClaimForm'))
const ClaimDetail = React.lazy(() => import('./pages/Claims/ClaimDetail'))
const ProfilePage = React.lazy(() => import('./pages/Profile/ProfilePage'))
const OrderHistory = React.lazy(() => import('./pages/Profile/OrderHistory'))
const InvoiceList = React.lazy(() => import('./pages/Invoices/InvoiceList'))
const InvoiceDetail = React.lazy(() => import('./pages/Invoices/InvoiceDetail'))
const SampleRequestList = React.lazy(() => import('./pages/Samples/SampleRequestList'))
const SampleRequestForm = React.lazy(() => import('./pages/Samples/SampleRequestForm'))
const SampleRequestDetail = React.lazy(() => import('./pages/Samples/SampleRequestDetail'))
const RoomVisualizer = React.lazy(() => import('./pages/Visualizer/RoomVisualizer'))


const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-white">
    <div className="text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-blue-100 rounded-full">
        <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
      <p className="text-slate-600">Loading...</p>
    </div>
  </div>
)

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('authToken')
  })
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })

  useEffect(() => {
    const token = localStorage.getItem('authToken')
    const stored = localStorage.getItem('user')
    if (token && stored) {
      setIsAuthenticated(true)
      setUser(JSON.parse(stored))
    }
  }, [])

  const handleLogin = (userData, token) => {
    localStorage.setItem('authToken', token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
    setIsAuthenticated(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('authToken')
    localStorage.removeItem('user')
    setUser(null)
    setIsAuthenticated(false)
  }

  return (
    <Router>
      <Toaster position="top-right" />
      {isAuthenticated ? (
        <Layout user={user} onLogout={handleLogout}>
          <ErrorBoundary>
          <Routes>
            <Route path="/dashboard" element={<Suspense fallback={<LoadingFallback />}><Dashboard /></Suspense>} />
            <Route path="/products" element={<Suspense fallback={<LoadingFallback />}><ProductCatalog /></Suspense>} />
            <Route path="/products/:id" element={<Suspense fallback={<LoadingFallback />}><ProductDetail /></Suspense>} />
            <Route path="/quotations/request" element={<Suspense fallback={<LoadingFallback />}><QuotationRequest /></Suspense>} />
            <Route path="/quotations/compare" element={<Suspense fallback={<LoadingFallback />}><QuoteComparison /></Suspense>} />
            <Route path="/quotations" element={<Suspense fallback={<LoadingFallback />}><QuotationList /></Suspense>} />
            <Route path="/quotations/:id" element={<Suspense fallback={<LoadingFallback />}><QuotationDetail /></Suspense>} />
            <Route path="/orders" element={<Suspense fallback={<LoadingFallback />}><OrderList /></Suspense>} />
            <Route path="/orders/:id" element={<Suspense fallback={<LoadingFallback />}><OrderDetail /></Suspense>} />
            <Route path="/shipments" element={<Suspense fallback={<LoadingFallback />}><ShipmentTracker /></Suspense>} />
            <Route path="/claims" element={<Suspense fallback={<LoadingFallback />}><ClaimList /></Suspense>} />
            <Route path="/claims/new" element={<Suspense fallback={<LoadingFallback />}><ClaimForm /></Suspense>} />
            <Route path="/claims/:id" element={<Suspense fallback={<LoadingFallback />}><ClaimDetail /></Suspense>} />
            <Route path="/invoices" element={<Suspense fallback={<LoadingFallback />}><InvoiceList /></Suspense>} />
            <Route path="/invoices/:id" element={<Suspense fallback={<LoadingFallback />}><InvoiceDetail /></Suspense>} />
            <Route path="/samples" element={<Suspense fallback={<LoadingFallback />}><SampleRequestList /></Suspense>} />
            <Route path="/samples/new" element={<Suspense fallback={<LoadingFallback />}><SampleRequestForm /></Suspense>} />
            <Route path="/samples/:id" element={<Suspense fallback={<LoadingFallback />}><SampleRequestDetail /></Suspense>} />
            <Route path="/visualizer" element={<Suspense fallback={<LoadingFallback />}><RoomVisualizer /></Suspense>} />
            <Route path="/profile" element={<Suspense fallback={<LoadingFallback />}><ProfilePage /></Suspense>} />
            <Route path="/profile/history" element={<Suspense fallback={<LoadingFallback />}><OrderHistory /></Suspense>} />
            <Route path="*" element={<Suspense fallback={<LoadingFallback />}><Navigate to="/dashboard" replace /></Suspense>} />
          </Routes>
          </ErrorBoundary>
        </Layout>
      ) : (
        <Routes>
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
          <Route path="/forgot-password" element={<Suspense fallback={<LoadingFallback />}><ForgotPassword /></Suspense>} />
          <Route path="*" element={<Suspense fallback={<LoadingFallback />}><Navigate to="/login" replace /></Suspense>} />
        </Routes>
      )}
    </Router>
  )
}

export default App
