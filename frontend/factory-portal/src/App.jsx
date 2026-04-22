import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
const Login = React.lazy(() => import('./pages/Auth/Login'));
const ForgotPassword = React.lazy(() => import('./pages/Auth/ForgotPassword'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const ProductList = React.lazy(() => import('./pages/Products/ProductList'));
const ProductForm = React.lazy(() => import('./pages/Products/ProductForm'));
const BulkPriceUpdate = React.lazy(() => import('./pages/Products/BulkPriceUpdate'));
const PriceList = React.lazy(() => import('./pages/PriceManagement/PriceList'));
const PriceUpdateForm = React.lazy(() => import('./pages/PriceManagement/PriceUpdateForm'));
const PriceHistory = React.lazy(() => import('./pages/PriceManagement/PriceHistory'));
const POList = React.lazy(() => import('./pages/PurchaseOrders/POList'));
const PODetail = React.lazy(() => import('./pages/PurchaseOrders/PODetail'));
const POConfirmation = React.lazy(() => import('./pages/PurchaseOrders/POConfirmation'));
const ProductionTracker = React.lazy(() => import('./pages/Production/ProductionTracker'));
const ProductionCalendar = React.lazy(() => import('./pages/Production/ProductionCalendar'));
const ProductionGantt = React.lazy(() => import('./pages/Production/ProductionGantt'));
const ShipmentList = React.lazy(() => import('./pages/Shipping/ShipmentList'));
const ShipmentForm = React.lazy(() => import('./pages/Shipping/ShipmentForm'));
const DocumentUpload = React.lazy(() => import('./pages/Shipping/DocumentUpload'));
const PackingListEntry = React.lazy(() => import('./pages/Shipping/PackingListEntry'));
const InspectionSchedule = React.lazy(() => import('./pages/Inspections/InspectionSchedule'));
const InspectionResults = React.lazy(() => import('./pages/Inspections/InspectionResults'));
const InspectionPrep = React.lazy(() => import('./pages/Inspections/InspectionPrep'));
const DocumentCenter = React.lazy(() => import('./pages/Documents/DocumentCenter'));
const FactoryProfile = React.lazy(() => import('./pages/Profile/FactoryProfile'));
const Settings = React.lazy(() => import('./pages/Profile/Settings'));
const ScanReceive = React.lazy(() => import('./pages/Warehouse/ScanReceive'));
const ScanInventory = React.lazy(() => import('./pages/Warehouse/ScanInventory'));
import { AuthProvider, useAuth } from './hooks/useAuth';
import LoadingSpinner from './components/LoadingSpinner';


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

function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={
        user ? <Navigate to="/" replace /> : <Suspense fallback={<LoadingFallback />}><Login /></Suspense>
      } />
      <Route path="/forgot-password" element={
        user ? <Navigate to="/" replace /> : <Suspense fallback={<LoadingFallback />}><ForgotPassword /></Suspense>
      } />

      {/* Protected routes */}
      <Route element={
        <ProtectedRoute>
          <ErrorBoundary><Layout /></ErrorBoundary>
        </ProtectedRoute>
      }>
        <Route path="/" element={<Suspense fallback={<LoadingFallback />}><Dashboard /></Suspense>} />
        <Route path="/products" element={<Suspense fallback={<LoadingFallback />}><ProductList /></Suspense>} />
        <Route path="/products/new" element={<Suspense fallback={<LoadingFallback />}><ProductForm /></Suspense>} />
        <Route path="/products/:id/edit" element={<Suspense fallback={<LoadingFallback />}><ProductForm /></Suspense>} />
        <Route path="/products/bulk-price-update" element={<Suspense fallback={<LoadingFallback />}><BulkPriceUpdate /></Suspense>} />
        <Route path="/prices" element={<Suspense fallback={<LoadingFallback />}><PriceList /></Suspense>} />
        <Route path="/prices/update" element={<Suspense fallback={<LoadingFallback />}><PriceUpdateForm /></Suspense>} />
        <Route path="/prices/history" element={<Suspense fallback={<LoadingFallback />}><PriceHistory /></Suspense>} />
        <Route path="/purchase-orders" element={<Suspense fallback={<LoadingFallback />}><POList /></Suspense>} />
        <Route path="/purchase-orders/:id" element={<Suspense fallback={<LoadingFallback />}><PODetail /></Suspense>} />
        <Route path="/purchase-orders/:id/confirm" element={<Suspense fallback={<LoadingFallback />}><POConfirmation /></Suspense>} />
        <Route path="/production" element={<Suspense fallback={<LoadingFallback />}><ProductionTracker /></Suspense>} />
        <Route path="/production/calendar" element={<Suspense fallback={<LoadingFallback />}><ProductionCalendar /></Suspense>} />
        <Route path="/production/gantt" element={<Suspense fallback={<LoadingFallback />}><ProductionGantt /></Suspense>} />
        <Route path="/shipping" element={<Suspense fallback={<LoadingFallback />}><ShipmentList /></Suspense>} />
        <Route path="/shipping/new" element={<Suspense fallback={<LoadingFallback />}><ShipmentForm /></Suspense>} />
        <Route path="/shipping/:id/edit" element={<Suspense fallback={<LoadingFallback />}><ShipmentForm /></Suspense>} />
        <Route path="/shipping/:id/documents" element={<Suspense fallback={<LoadingFallback />}><DocumentUpload /></Suspense>} />
        <Route path="/shipping/:id/packing-list" element={<Suspense fallback={<LoadingFallback />}><PackingListEntry /></Suspense>} />
        <Route path="/inspections/schedule" element={<Suspense fallback={<LoadingFallback />}><InspectionSchedule /></Suspense>} />
        <Route path="/inspections/results" element={<Suspense fallback={<LoadingFallback />}><InspectionResults /></Suspense>} />
        <Route path="/inspections/prep" element={<Suspense fallback={<LoadingFallback />}><InspectionPrep /></Suspense>} />
        <Route path="/documents" element={<Suspense fallback={<LoadingFallback />}><DocumentCenter /></Suspense>} />
        <Route path="/warehouse/scan-receive" element={<Suspense fallback={<LoadingFallback />}><ScanReceive /></Suspense>} />
        <Route path="/warehouse/scan-inventory" element={<Suspense fallback={<LoadingFallback />}><ScanInventory /></Suspense>} />
        <Route path="/profile" element={<Suspense fallback={<LoadingFallback />}><FactoryProfile /></Suspense>} />
        <Route path="/settings" element={<Suspense fallback={<LoadingFallback />}><Settings /></Suspense>} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" />
      </AuthProvider>
    </Router>
  );
}

export default App;
