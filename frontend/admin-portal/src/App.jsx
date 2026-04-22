import React, { Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import RoleGuard from './components/RoleGuard'
import LoadingFallback from './components/LoadingFallback'

// Pages
const Login = React.lazy(() => import('./pages/Auth/Login'))
const ForgotPassword = React.lazy(() => import('./pages/Auth/ForgotPassword'))
const Dashboard = React.lazy(() => import('./pages/Dashboard'))

// Customers
const CustomerList = React.lazy(() => import('./pages/Customers/CustomerList'))
const CustomerDetail = React.lazy(() => import('./pages/Customers/CustomerDetail'))
const CustomerForm = React.lazy(() => import('./pages/Customers/CustomerForm'))

// Factories
const FactoryList = React.lazy(() => import('./pages/Factories/FactoryList'))
const FactoryDetail = React.lazy(() => import('./pages/Factories/FactoryDetail'))
const FactoryForm = React.lazy(() => import('./pages/Factories/FactoryForm'))

// Products
const ProductList = React.lazy(() => import('./pages/Products/ProductList'))
const ProductDetail = React.lazy(() => import('./pages/Products/ProductDetail'))
const ProductForm = React.lazy(() => import('./pages/Products/ProductForm'))
const ProductCategories = React.lazy(() => import('./pages/Products/ProductCategories'))

// Inquiries
const InquiryList = React.lazy(() => import('./pages/Inquiries/InquiryList'))
const InquiryDetail = React.lazy(() => import('./pages/Inquiries/InquiryDetail'))
const InquiryForm = React.lazy(() => import('./pages/Inquiries/InquiryForm'))

// Quotations
const QuotationList = React.lazy(() => import('./pages/Quotations/QuotationList'))
const QuotationDetail = React.lazy(() => import('./pages/Quotations/QuotationDetail'))
const QuotationForm = React.lazy(() => import('./pages/Quotations/QuotationForm'))

// Proforma Invoices
const ProformaList = React.lazy(() => import('./pages/ProformaInvoices/ProformaList'))
const ProformaDetail = React.lazy(() => import('./pages/ProformaInvoices/ProformaDetail'))
const ProformaForm = React.lazy(() => import('./pages/ProformaInvoices/ProformaForm'))

// Sales Orders
const OrderList = React.lazy(() => import('./pages/SalesOrders/OrderList'))
const OrderDetail = React.lazy(() => import('./pages/SalesOrders/OrderDetail'))
const OrderForm = React.lazy(() => import('./pages/SalesOrders/OrderForm'))

// Purchase Orders
const PurchaseOrderList = React.lazy(() => import('./pages/PurchaseOrders/PurchaseOrderList'))
const PurchaseOrderDetail = React.lazy(() => import('./pages/PurchaseOrders/PurchaseOrderDetail'))
const PurchaseOrderForm = React.lazy(() => import('./pages/PurchaseOrders/PurchaseOrderForm'))

// Packing Lists
const PackingListList = React.lazy(() => import('./pages/PackingLists/PackingListList'))
const PackingListDetail = React.lazy(() => import('./pages/PackingLists/PackingListDetail'))
const PackingListForm = React.lazy(() => import('./pages/PackingLists/PackingListForm'))

// Shipments
const ShipmentList = React.lazy(() => import('./pages/Shipments/ShipmentList'))
const ShipmentDetail = React.lazy(() => import('./pages/Shipments/ShipmentDetail'))
const ShipmentForm = React.lazy(() => import('./pages/Shipments/ShipmentForm'))

// Inspections
const InspectionList = React.lazy(() => import('./pages/Inspections/InspectionList'))
const InspectionDetail = React.lazy(() => import('./pages/Inspections/InspectionDetail'))
const InspectionForm = React.lazy(() => import('./pages/Inspections/InspectionForm'))

// Claims
const ClaimList = React.lazy(() => import('./pages/Claims/ClaimList'))
const ClaimDetail = React.lazy(() => import('./pages/Claims/ClaimDetail'))
const ClaimForm = React.lazy(() => import('./pages/Claims/ClaimForm'))

// Invoices
const InvoiceList = React.lazy(() => import('./pages/Invoices/InvoiceList'))
const InvoiceDetail = React.lazy(() => import('./pages/Invoices/InvoiceDetail'))
const InvoiceForm = React.lazy(() => import('./pages/Invoices/InvoiceForm'))

// Payments
const PaymentList = React.lazy(() => import('./pages/Payments/PaymentList'))
const PaymentDetail = React.lazy(() => import('./pages/Payments/PaymentDetail'))
const PaymentForm = React.lazy(() => import('./pages/Payments/PaymentForm'))

// Inventory
const InventoryList = React.lazy(() => import('./pages/Inventory/InventoryList'))
const InventoryAdjustment = React.lazy(() => import('./pages/Inventory/InventoryAdjustment'))

// Reports
const SalesReport = React.lazy(() => import('./pages/Reports/SalesReport'))
const PurchaseReport = React.lazy(() => import('./pages/Reports/PurchaseReport'))
const FinancialReport = React.lazy(() => import('./pages/Reports/FinancialReport'))
const InventoryReport = React.lazy(() => import('./pages/Reports/InventoryReport'))
const CustomerReport = React.lazy(() => import('./pages/Reports/CustomerReport'))
const FactoryReport = React.lazy(() => import('./pages/Reports/FactoryReport'))

// Documents
const TemplateManager = React.lazy(() => import('./pages/Documents/TemplateManager'))

// Personalization
const ProductAttributes = React.lazy(() => import('./pages/Settings/ProductAttributes'))
const PriceListManager = React.lazy(() => import('./pages/Settings/PriceListManager'))
const SpecTemplates = React.lazy(() => import('./pages/Products/SpecTemplates'))

// Settings
const GeneralSettings = React.lazy(() => import('./pages/Settings/GeneralSettings'))
const UserManagement = React.lazy(() => import('./pages/Settings/UserManagement'))
const UserForm = React.lazy(() => import('./pages/Settings/UserForm'))
const EmailTemplates = React.lazy(() => import('./pages/Settings/EmailTemplates'))
const EmailSignatures = React.lazy(() => import('./pages/Settings/EmailSignatures'))
const RolePermissions = React.lazy(() => import('./pages/Settings/RolePermissions'))
const ProductTaxonomy = React.lazy(() => import('./pages/Settings/ProductTaxonomy'))
const SystemLog = React.lazy(() => import('./pages/Settings/SystemLog'))

// Audit Trail
const AuditTrailPage = React.lazy(() => import('./pages/AuditTrail/AuditTrailPage'))

// Analytics
const AnalyticsDashboard = React.lazy(() => import('./pages/Analytics/AnalyticsDashboard'))

// BI Dashboard
const BIDashboard = React.lazy(() => import('./pages/BI/BIDashboard'))

// GRN
const GRNList = React.lazy(() => import('./pages/GRN/GRNList'))
const GRNDetail = React.lazy(() => import('./pages/GRN/GRNDetail'))

// CRM
const ClientContacts = React.lazy(() => import('./pages/CRM/ClientContacts'))

// Protected Route Wrapper with Role-Based Access Control
const ProtectedRoute = ({ children, allowedRoles = ['*'] }) => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-600">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <Layout>
      <ErrorBoundary>
        <RoleGuard allowedRoles={allowedRoles}>
          {children}
        </RoleGuard>
      </ErrorBoundary>
    </Layout>
  )
}

function AppRoutes() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      {/* Auth Routes */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Suspense fallback={<LoadingFallback />}><Login /></Suspense>}
      />
      <Route path="/forgot-password" element={<Suspense fallback={<LoadingFallback />}><ForgotPassword /></Suspense>} />

      {/* Dashboard */}
      <Route
        path="/"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <Dashboard />

            </Suspense>



          </ProtectedRoute>
        }
      />

      {/* Customers */}
      <Route
        path="/customers"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <CustomerList />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/customers/new"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <CustomerForm />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/customers/:id"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <CustomerDetail />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/customers/:id/edit"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <CustomerForm />

            </Suspense>



          </ProtectedRoute>
        }
      />

      {/* Factories */}
      <Route
        path="/factories"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <FactoryList />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/factories/new"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <FactoryForm />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/factories/:id"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <FactoryDetail />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/factories/:id/edit"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <FactoryForm />

            </Suspense>



          </ProtectedRoute>
        }
      />

      {/* Products */}
      <Route
        path="/products"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <ProductList />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/products/new"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <ProductForm />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/products/:id"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <ProductDetail />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/products/:id/edit"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <ProductForm />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/products/categories"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <ProductCategories />

            </Suspense>



          </ProtectedRoute>
        }
      />

      {/* Inquiries */}
      <Route
        path="/inquiries"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <InquiryList />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/inquiries/new"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <InquiryForm />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/inquiries/:id"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <InquiryDetail />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/inquiries/:id/edit"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <InquiryForm />

            </Suspense>



          </ProtectedRoute>
        }
      />

      {/* Quotations */}
      <Route
        path="/quotations"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <QuotationList />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/quotations/new"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <QuotationForm />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/quotations/:id"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <QuotationDetail />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/quotations/:id/edit"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <QuotationForm />

            </Suspense>



          </ProtectedRoute>
        }
      />

      {/* Proforma Invoices */}
      <Route
        path="/proforma-invoices"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <ProformaList />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/proforma-invoices/new"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <ProformaForm />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/proforma-invoices/:id"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <ProformaDetail />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/proforma-invoices/:id/edit"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <ProformaForm />

            </Suspense>



          </ProtectedRoute>
        }
      />

      {/* Sales Orders */}
      <Route
        path="/orders"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <OrderList />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/orders/new"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <OrderForm />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/orders/:id"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <OrderDetail />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/orders/:id/edit"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <OrderForm />

            </Suspense>



          </ProtectedRoute>
        }
      />

      {/* Purchase Orders */}
      <Route
        path="/purchase-orders"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <PurchaseOrderList />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/purchase-orders/new"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <PurchaseOrderForm />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/purchase-orders/:id"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <PurchaseOrderDetail />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/purchase-orders/:id/edit"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <PurchaseOrderForm />

            </Suspense>



          </ProtectedRoute>
        }
      />

      {/* Packing Lists */}
      <Route
        path="/packing-lists"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <PackingListList />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/packing-lists/new"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <PackingListForm />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/packing-lists/:id"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <PackingListDetail />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/packing-lists/:id/edit"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <PackingListForm />

            </Suspense>



          </ProtectedRoute>
        }
      />

      {/* Shipments */}
      <Route
        path="/shipments"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <ShipmentList />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/shipments/new"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <ShipmentForm />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/shipments/:id"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <ShipmentDetail />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/shipments/:id/edit"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <ShipmentForm />

            </Suspense>



          </ProtectedRoute>
        }
      />

      {/* Inspections */}
      <Route
        path="/inspections"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <InspectionList />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/inspections/new"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <InspectionForm />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/inspections/:id"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <InspectionDetail />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/inspections/:id/edit"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <InspectionForm />

            </Suspense>



          </ProtectedRoute>
        }
      />

      {/* Claims */}
      <Route
        path="/claims"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <ClaimList />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/claims/new"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <ClaimForm />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/claims/:id"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <ClaimDetail />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/claims/:id/edit"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <ClaimForm />

            </Suspense>



          </ProtectedRoute>
        }
      />

      {/* Invoices */}
      <Route
        path="/invoices"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <InvoiceList />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/invoices/new"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <InvoiceForm />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/invoices/:id"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <InvoiceDetail />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/invoices/:id/edit"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <InvoiceForm />

            </Suspense>



          </ProtectedRoute>
        }
      />

      {/* Payments */}
      <Route
        path="/payments"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <PaymentList />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/payments/new"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <PaymentForm />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/payments/:id"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <PaymentDetail />

            </Suspense>



          </ProtectedRoute>
        }
      />

      {/* Inventory */}
      <Route
        path="/inventory"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <InventoryList />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory/adjustment"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <InventoryAdjustment />

            </Suspense>



          </ProtectedRoute>
        }
      />

      {/* Reports */}
      <Route
        path="/reports"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <SalesReport />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/purchase"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <PurchaseReport />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/financial"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <FinancialReport />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/inventory"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <InventoryReport />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/customer"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <CustomerReport />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/factory"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <FactoryReport />

            </Suspense>



          </ProtectedRoute>
        }
      />

      {/* Settings */}
      <Route
        path="/settings"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <GeneralSettings />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/users"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <UserManagement />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/users/new"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <UserForm />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/users/:id/edit"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <UserForm />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/email-templates"
        element={
          <ProtectedRoute>
            <Suspense fallback={<LoadingFallback />}>
              <EmailTemplates />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/email-signatures"
        element={
          <ProtectedRoute>
            <Suspense fallback={<LoadingFallback />}>
              <EmailSignatures />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/role-permissions"
        element={
          <ProtectedRoute>
            <Suspense fallback={<LoadingFallback />}>
              <RolePermissions />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/product-taxonomy"
        element={
          <ProtectedRoute>
            <Suspense fallback={<LoadingFallback />}>
              <ProductTaxonomy />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/logs"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <SystemLog />

            </Suspense>



          </ProtectedRoute>
        }
      />

      {/* Audit Trail */}
      <Route
        path="/audit-trail"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <AuditTrailPage />

            </Suspense>



          </ProtectedRoute>
        }
      />

      {/* Analytics */}
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <AnalyticsDashboard />

            </Suspense>



          </ProtectedRoute>
        }
      />

      {/* BI Dashboard */}
      <Route
        path="/bi-dashboard"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <BIDashboard />

            </Suspense>



          </ProtectedRoute>
        }
      />

      {/* GRN (Goods Received Notes) */}
      <Route
        path="/grns"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <GRNList />

            </Suspense>



          </ProtectedRoute>
        }
      />
      <Route
        path="/grns/:id"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <GRNDetail />

            </Suspense>



          </ProtectedRoute>
        }
      />

      {/* Documents */}
      <Route
        path="/documents/templates"
        element={
          <ProtectedRoute>

            <Suspense fallback={<LoadingFallback />}>

              <TemplateManager />

            </Suspense>



          </ProtectedRoute>
        }
      />

      {/* Spec Templates */}
      <Route
        path="/products/spec-templates"
        element={
          <ProtectedRoute>
            <Suspense fallback={<LoadingFallback />}>
              <SpecTemplates />
            </Suspense>
          </ProtectedRoute>
        }
      />

      {/* Personalization */}
      <Route
        path="/settings/product-attributes"
        element={
          <ProtectedRoute>
            <Suspense fallback={<LoadingFallback />}>
              <ProductAttributes />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/price-lists"
        element={
          <ProtectedRoute>
            <Suspense fallback={<LoadingFallback />}>
              <PriceListManager />
            </Suspense>
          </ProtectedRoute>
        }
      />

      {/* CRM — Outreach */}
      <Route
        path="/client-contacts"
        element={
          <ProtectedRoute allowedRoles={['admin', 'sales', 'manager']}>
            <Suspense fallback={<LoadingFallback />}>
              <ClientContacts />
            </Suspense>
          </ProtectedRoute>
        }
      />

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" />
      </AuthProvider>
    </Router>
  )
}
