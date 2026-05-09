import React, { Suspense } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import RoleGuard from './components/RoleGuard'
import LoadingFallback from './components/LoadingFallback'

// ─── Lazy page imports ────────────────────────────────────────────────────────

const Login          = React.lazy(() => import('./pages/Auth/Login'))
const ForgotPassword = React.lazy(() => import('./pages/Auth/ForgotPassword'))
const Dashboard      = React.lazy(() => import('./pages/Dashboard/ConfigurableDashboard'))

// Customers
const CustomerList   = React.lazy(() => import('./pages/Customers/CustomerList'))
const CustomerDetail = React.lazy(() => import('./pages/Customers/CustomerDetail'))
const CustomerForm   = React.lazy(() => import('./pages/Customers/CustomerForm'))

// Factories
const FactoryList    = React.lazy(() => import('./pages/Factories/FactoryList'))
const FactoryDetail  = React.lazy(() => import('./pages/Factories/FactoryDetail'))
const FactoryForm    = React.lazy(() => import('./pages/Factories/FactoryForm'))

// Products
const ProductList       = React.lazy(() => import('./pages/Products/ProductList'))
const ProductDetail     = React.lazy(() => import('./pages/Products/ProductDetail'))
const ProductForm       = React.lazy(() => import('./pages/Products/ProductForm'))
const ProductCategories = React.lazy(() => import('./pages/Products/ProductCategories'))
const SpecTemplates     = React.lazy(() => import('./pages/Products/SpecTemplates'))

// Inquiries
const InquiryList   = React.lazy(() => import('./pages/Inquiries/InquiryList'))
const InquiryDetail = React.lazy(() => import('./pages/Inquiries/InquiryDetail'))
const InquiryForm   = React.lazy(() => import('./pages/Inquiries/InquiryForm'))

// Quotations
const QuotationList   = React.lazy(() => import('./pages/Quotations/QuotationList'))
const QuotationDetail = React.lazy(() => import('./pages/Quotations/QuotationDetail'))
const QuotationForm   = React.lazy(() => import('./pages/Quotations/QuotationForm'))

// Proforma Invoices
const ProformaList   = React.lazy(() => import('./pages/ProformaInvoices/ProformaList'))
const ProformaDetail = React.lazy(() => import('./pages/ProformaInvoices/ProformaDetail'))
const ProformaForm   = React.lazy(() => import('./pages/ProformaInvoices/ProformaForm'))

// Sales Orders
const OrderList   = React.lazy(() => import('./pages/SalesOrders/OrderList'))
const OrderDetail = React.lazy(() => import('./pages/SalesOrders/OrderDetail'))
const OrderForm   = React.lazy(() => import('./pages/SalesOrders/OrderForm'))

// Purchase Orders
const PurchaseOrderList   = React.lazy(() => import('./pages/PurchaseOrders/PurchaseOrderList'))
const PurchaseOrderDetail = React.lazy(() => import('./pages/PurchaseOrders/PurchaseOrderDetail'))
const PurchaseOrderForm   = React.lazy(() => import('./pages/PurchaseOrders/PurchaseOrderForm'))

// Packing Lists
const PackingListList   = React.lazy(() => import('./pages/PackingLists/PackingListList'))
const PackingListDetail = React.lazy(() => import('./pages/PackingLists/PackingListDetail'))
const PackingListForm   = React.lazy(() => import('./pages/PackingLists/PackingListForm'))

// Shipments
const ShipmentList   = React.lazy(() => import('./pages/Shipments/ShipmentList'))
const ShipmentDetail = React.lazy(() => import('./pages/Shipments/ShipmentDetail'))
const ShipmentForm   = React.lazy(() => import('./pages/Shipments/ShipmentForm'))

// Inspections
const InspectionList   = React.lazy(() => import('./pages/Inspections/InspectionList'))
const InspectionDetail = React.lazy(() => import('./pages/Inspections/InspectionDetail'))
const InspectionForm   = React.lazy(() => import('./pages/Inspections/InspectionForm'))

// Claims
const ClaimList   = React.lazy(() => import('./pages/Claims/ClaimList'))
const ClaimDetail = React.lazy(() => import('./pages/Claims/ClaimDetail'))
const ClaimForm   = React.lazy(() => import('./pages/Claims/ClaimForm'))

// Invoices
const InvoiceList   = React.lazy(() => import('./pages/Invoices/InvoiceList'))
const InvoiceDetail = React.lazy(() => import('./pages/Invoices/InvoiceDetail'))
const InvoiceForm   = React.lazy(() => import('./pages/Invoices/InvoiceForm'))

// Payments
const PaymentList   = React.lazy(() => import('./pages/Payments/PaymentList'))
const PaymentDetail = React.lazy(() => import('./pages/Payments/PaymentDetail'))
const PaymentForm   = React.lazy(() => import('./pages/Payments/PaymentForm'))

// Inventory
const InventoryList       = React.lazy(() => import('./pages/Inventory/InventoryList'))
const InventoryAdjustment = React.lazy(() => import('./pages/Inventory/InventoryAdjustment'))

// Reports
const SalesReport     = React.lazy(() => import('./pages/Reports/SalesReport'))
const PurchaseReport  = React.lazy(() => import('./pages/Reports/PurchaseReport'))
const FinancialReport = React.lazy(() => import('./pages/Reports/FinancialReport'))
const InventoryReport = React.lazy(() => import('./pages/Reports/InventoryReport'))
const CustomerReport  = React.lazy(() => import('./pages/Reports/CustomerReport'))
const FactoryReport   = React.lazy(() => import('./pages/Reports/FactoryReport'))

// Documents
const TemplateManager = React.lazy(() => import('./pages/Documents/TemplateManager'))

// Settings
const GeneralSettings  = React.lazy(() => import('./pages/Settings/GeneralSettings'))
const UserManagement   = React.lazy(() => import('./pages/Settings/UserManagement'))
const UserForm         = React.lazy(() => import('./pages/Settings/UserForm'))
const EmailTemplates   = React.lazy(() => import('./pages/Settings/EmailTemplates'))
const EmailSignatures  = React.lazy(() => import('./pages/Settings/EmailSignatures'))
const RolePermissions  = React.lazy(() => import('./pages/Settings/RolePermissions'))
const ProductTaxonomy  = React.lazy(() => import('./pages/Settings/ProductTaxonomy'))
const SystemLog        = React.lazy(() => import('./pages/Settings/SystemLog'))
const BulkImport       = React.lazy(() => import('./pages/Settings/BulkImport'))
const ProductAttributes = React.lazy(() => import('./pages/Settings/ProductAttributes'))
const PriceListManager  = React.lazy(() => import('./pages/Settings/PriceListManager'))
const ModulesManager    = React.lazy(() => import('./pages/Settings/ModulesManager'))
const MobileApp         = React.lazy(() => import('./pages/Settings/MobileApp'))
const ConnectedAccounts = React.lazy(() => import('./pages/Settings/ConnectedAccounts'))

// AI Assistant
const AssistantPage = React.lazy(() => import('./pages/AI/AssistantPage'))
const DevRunsPage = React.lazy(() => import('./pages/AI/DevRunsPage'))
const ResearchPage = React.lazy(() => import('./pages/AI/ResearchPage'))
const ExpensesPage = React.lazy(() => import('./pages/Expenses/ExpensesPage'))

// Google Drive
const GoogleDrivePage = React.lazy(() => import('./pages/GoogleDrive/GoogleDrivePage'))

// Analytics & BI
const AnalyticsDashboard = React.lazy(() => import('./pages/Analytics/AnalyticsDashboard'))
const BIDashboard        = React.lazy(() => import('./pages/BI/BIDashboard'))

// Audit Trail
const AuditTrailPage = React.lazy(() => import('./pages/AuditTrail/AuditTrailPage'))

// GRN
const GRNList   = React.lazy(() => import('./pages/GRN/GRNList'))
const GRNDetail = React.lazy(() => import('./pages/GRN/GRNDetail'))

// CRM
const CRMDashboard   = React.lazy(() => import('./pages/CRM/CRMDashboard'))
const LeadList       = React.lazy(() => import('./pages/CRM/LeadList'))
const LeadForm       = React.lazy(() => import('./pages/CRM/LeadForm'))
const DealPipeline   = React.lazy(() => import('./pages/CRM/DealPipeline'))
const ActivityList   = React.lazy(() => import('./pages/CRM/ActivityList'))
const ActivityForm   = React.lazy(() => import('./pages/CRM/ActivityForm'))
const ContactList    = React.lazy(() => import('./pages/CRM/ContactList'))
const ContactForm    = React.lazy(() => import('./pages/CRM/ContactForm'))
const ClientContacts = React.lazy(() => import('./pages/CRM/ClientContacts'))
const TriageInbox    = React.lazy(() => import('./pages/CRM/TriageInbox'))

// Chat
const ChatPage = React.lazy(() => import('./pages/ChatPage'))

// Public — no auth required
const ApprovalPage = React.lazy(() => import('./pages/Approvals/ApprovalPage'))
const InternalApprovalsList = React.lazy(() => import('./pages/InternalApprovals/InternalApprovalsList'))

// ─── ProtectedRoute ───────────────────────────────────────────────────────────
// Handles auth redirect + RBAC check in one wrapper.
//
// Props:
//   permission   — a permission key string (e.g. 'customers'). Checked against
//                  ROLE_PERMISSIONS[user.role] via canAccessRoute().
//   allowedRoles — legacy explicit role whitelist (e.g. ['admin', 'manager']).
//                  Only consulted when `permission` is not provided.
//
// When neither is provided, any authenticated user is allowed through.
const ProtectedRoute = ({ children, permission, allowedRoles }) => {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

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
      <ErrorBoundary key={location.pathname}>
        <RoleGuard permission={permission} allowedRoles={allowedRoles ?? ['*']}>
          {children}
        </RoleGuard>
      </ErrorBoundary>
    </Layout>
  )
}

// Shorthand: ProtectedRoute + Suspense in one line per route.
const P = ({ permission, roles, children }) => (
  <ProtectedRoute permission={permission} allowedRoles={roles}>
    <Suspense fallback={<LoadingFallback />}>
      {children}
    </Suspense>
  </ProtectedRoute>
)

// ─── Routes ───────────────────────────────────────────────────────────────────
function AppRoutes() {
  const { isAuthenticated } = useAuth()

  return (
    <Routes>
      {/* ── Auth (public) ── */}
      <Route
        path="/login"
        element={
          isAuthenticated
            ? <Navigate to="/" replace />
            : <Suspense fallback={<LoadingFallback />}><Login /></Suspense>
        }
      />
      <Route
        path="/forgot-password"
        element={<Suspense fallback={<LoadingFallback />}><ForgotPassword /></Suspense>}
      />

      {/* ── Dashboard ── */}
      <Route path="/" element={<P permission="dashboard"><Dashboard /></P>} />

      {/* ── Customers ── */}
      <Route path="/customers"          element={<P permission="customers"><CustomerList /></P>} />
      <Route path="/customers/new"      element={<P permission="customers"><CustomerForm /></P>} />
      <Route path="/customers/:id"      element={<P permission="customers"><CustomerDetail /></P>} />
      <Route path="/customers/:id/edit" element={<P permission="customers"><CustomerForm /></P>} />

      {/* ── Factories ── */}
      <Route path="/factories"          element={<P permission="factories"><FactoryList /></P>} />
      <Route path="/factories/new"      element={<P permission="factories"><FactoryForm /></P>} />
      <Route path="/factories/:id"      element={<P permission="factories"><FactoryDetail /></P>} />
      <Route path="/factories/:id/edit" element={<P permission="factories"><FactoryForm /></P>} />

      {/* ── Products ── */}
      <Route path="/products"                  element={<P permission="products"><ProductList /></P>} />
      <Route path="/products/new"              element={<P permission="products"><ProductForm /></P>} />
      <Route path="/products/categories"       element={<P permission="products"><ProductCategories /></P>} />
      <Route path="/products/spec-templates"   element={<P permission="products"><SpecTemplates /></P>} />
      <Route path="/products/:id"              element={<P permission="products"><ProductDetail /></P>} />
      <Route path="/products/:id/edit"         element={<P permission="products"><ProductForm /></P>} />

      {/* ── Inquiries ── */}
      <Route path="/inquiries"          element={<P permission="inquiries"><InquiryList /></P>} />
      <Route path="/inquiries/new"      element={<P permission="inquiries"><InquiryForm /></P>} />
      <Route path="/inquiries/:id"      element={<P permission="inquiries"><InquiryDetail /></P>} />
      <Route path="/inquiries/:id/edit" element={<P permission="inquiries"><InquiryForm /></P>} />

      {/* ── Quotations ── */}
      <Route path="/quotations"          element={<P permission="quotations"><QuotationList /></P>} />
      <Route path="/quotations/new"      element={<P permission="quotations"><QuotationForm /></P>} />
      <Route path="/quotations/:id"      element={<P permission="quotations"><QuotationDetail /></P>} />
      <Route path="/quotations/:id/edit" element={<P permission="quotations"><QuotationForm /></P>} />

      {/* ── Proforma Invoices ── */}
      <Route path="/proforma-invoices"          element={<P permission="proforma"><ProformaList /></P>} />
      <Route path="/proforma-invoices/new"      element={<P permission="proforma"><ProformaForm /></P>} />
      <Route path="/proforma-invoices/:id"      element={<P permission="proforma"><ProformaDetail /></P>} />
      <Route path="/proforma-invoices/:id/edit" element={<P permission="proforma"><ProformaForm /></P>} />

      {/* ── Sales Orders ── */}
      <Route path="/orders"          element={<P permission="orders"><OrderList /></P>} />
      <Route path="/orders/new"      element={<P permission="orders"><OrderForm /></P>} />
      <Route path="/orders/:id"      element={<P permission="orders"><OrderDetail /></P>} />
      <Route path="/orders/:id/edit" element={<P permission="orders"><OrderForm /></P>} />

      {/* ── Purchase Orders ── */}
      <Route path="/purchase-orders"          element={<P permission="purchase-orders"><PurchaseOrderList /></P>} />
      <Route path="/purchase-orders/new"      element={<P permission="purchase-orders"><PurchaseOrderForm /></P>} />
      <Route path="/purchase-orders/:id"      element={<P permission="purchase-orders"><PurchaseOrderDetail /></P>} />
      <Route path="/purchase-orders/:id/edit" element={<P permission="purchase-orders"><PurchaseOrderForm /></P>} />

      {/* ── Packing Lists ── */}
      <Route path="/packing-lists"          element={<P permission="packing-lists"><PackingListList /></P>} />
      <Route path="/packing-lists/new"      element={<P permission="packing-lists"><PackingListForm /></P>} />
      <Route path="/packing-lists/:id"      element={<P permission="packing-lists"><PackingListDetail /></P>} />
      <Route path="/packing-lists/:id/edit" element={<P permission="packing-lists"><PackingListForm /></P>} />

      {/* ── Shipments ── */}
      <Route path="/shipments"          element={<P permission="shipments"><ShipmentList /></P>} />
      <Route path="/shipments/new"      element={<P permission="shipments"><ShipmentForm /></P>} />
      <Route path="/shipments/:id"      element={<P permission="shipments"><ShipmentDetail /></P>} />
      <Route path="/shipments/:id/edit" element={<P permission="shipments"><ShipmentForm /></P>} />

      {/* ── Inspections ── */}
      <Route path="/inspections"          element={<P permission="inspections"><InspectionList /></P>} />
      <Route path="/inspections/new"      element={<P permission="inspections"><InspectionForm /></P>} />
      <Route path="/inspections/:id"      element={<P permission="inspections"><InspectionDetail /></P>} />
      <Route path="/inspections/:id/edit" element={<P permission="inspections"><InspectionForm /></P>} />

      {/* ── Claims ── */}
      <Route path="/claims"          element={<P permission="claims"><ClaimList /></P>} />
      <Route path="/claims/new"      element={<P permission="claims"><ClaimForm /></P>} />
      <Route path="/claims/:id"      element={<P permission="claims"><ClaimDetail /></P>} />
      <Route path="/claims/:id/edit" element={<P permission="claims"><ClaimForm /></P>} />

      {/* ── Invoices ── */}
      <Route path="/invoices"          element={<P permission="invoices"><InvoiceList /></P>} />
      <Route path="/invoices/new"      element={<P permission="invoices"><InvoiceForm /></P>} />
      <Route path="/invoices/:id"      element={<P permission="invoices"><InvoiceDetail /></P>} />
      <Route path="/invoices/:id/edit" element={<P permission="invoices"><InvoiceForm /></P>} />

      {/* ── Payments ── */}
      <Route path="/payments"          element={<P permission="payments"><PaymentList /></P>} />
      <Route path="/payments/new"      element={<P permission="payments"><PaymentForm /></P>} />
      <Route path="/payments/:id"      element={<P permission="payments"><PaymentDetail /></P>} />

      {/* ── Inventory ── */}
      <Route path="/inventory"            element={<P permission="inventory"><InventoryList /></P>} />
      <Route path="/inventory/adjustment" element={<P permission="inventory"><InventoryAdjustment /></P>} />

      {/* ── GRN ── */}
      <Route path="/grns"     element={<P permission="inventory"><GRNList /></P>} />
      <Route path="/grns/:id" element={<P permission="inventory"><GRNDetail /></P>} />

      {/* ── Reports ── */}
      <Route path="/reports"            element={<P permission="reports"><SalesReport /></P>} />
      <Route path="/reports/purchase"   element={<P permission="reports"><PurchaseReport /></P>} />
      <Route path="/reports/financial"  element={<P permission="reports"><FinancialReport /></P>} />
      <Route path="/reports/inventory"  element={<P permission="reports"><InventoryReport /></P>} />
      <Route path="/reports/customer"   element={<P permission="reports"><CustomerReport /></P>} />
      <Route path="/reports/factory"    element={<P permission="reports"><FactoryReport /></P>} />

      {/* ── Analytics / BI ── */}
      <Route path="/analytics"    element={<P permission="analytics"><AnalyticsDashboard /></P>} />
      <Route path="/bi-dashboard" element={<P permission="bi-dashboard"><BIDashboard /></P>} />

      {/* ── Chat ── */}
      <Route path="/chat" element={<P><ChatPage /></P>} />

      {/* ── Documents ── */}
      <Route path="/documents/templates" element={<P permission="documents"><TemplateManager /></P>} />

      {/* ── Google Drive ── */}
      <Route path="/drive" element={<P roles={['admin', 'manager']}><GoogleDrivePage /></P>} />

      {/* ── Audit Trail ── */}
      <Route path="/internal-approvals" element={<P roles={['admin', 'manager', 'ceo', 'coo']}><InternalApprovalsList /></P>} />
      <Route path="/audit-trail" element={<P permission="settings"><AuditTrailPage /></P>} />

      {/* ── Settings ── */}
      <Route path="/settings"                       element={<P permission="settings"><GeneralSettings /></P>} />
      <Route path="/settings/users"                 element={<P permission="settings"><UserManagement /></P>} />
      <Route path="/settings/users/new"             element={<P permission="settings"><UserForm /></P>} />
      <Route path="/settings/users/:id/edit"        element={<P permission="settings"><UserForm /></P>} />
      <Route path="/settings/email-templates"       element={<P permission="settings"><EmailTemplates /></P>} />
      <Route path="/settings/email-signatures"      element={<P permission="settings"><EmailSignatures /></P>} />
      <Route path="/settings/role-permissions"      element={<P permission="settings"><RolePermissions /></P>} />
      <Route path="/settings/product-taxonomy"      element={<P permission="settings"><ProductTaxonomy /></P>} />
      <Route path="/settings/logs"                  element={<P permission="settings"><SystemLog /></P>} />
      <Route path="/settings/bulk-import"           element={<P permission="settings"><BulkImport /></P>} />
      <Route path="/settings/product-attributes"    element={<P permission="settings"><ProductAttributes /></P>} />
      <Route path="/settings/price-lists"           element={<P permission="settings"><PriceListManager /></P>} />
      <Route path="/settings/modules"              element={<P roles={['admin']}><ModulesManager /></P>} />
      <Route path="/settings/mobile-app"           element={<P permission="settings"><MobileApp /></P>} />
      <Route path="/settings/connected-accounts"  element={<P roles={['admin']}><ConnectedAccounts /></P>} />

      {/* ── AI Assistant ── */}
      <Route path="/ai/assistant"  element={<P roles={['super_admin','admin','coo','sales_rep','finance','operations','viewer']}><AssistantPage /></P>} />
      <Route path="/ai/dev-runs"   element={<P roles={['super_admin']}><DevRunsPage /></P>} />
      <Route path="/ai/research"   element={<P roles={['super_admin','admin']}><ResearchPage /></P>} />
      <Route path="/expenses"      element={<P roles={['super_admin','admin']}><ExpensesPage /></P>} />

      {/* ── CRM / Pipeline ── */}
      <Route path="/crm"                       element={<P permission="outreach"><CRMDashboard /></P>} />
      <Route path="/crm/leads"                 element={<P permission="outreach"><LeadList /></P>} />
      <Route path="/crm/leads/new"             element={<P permission="outreach"><LeadForm /></P>} />
      <Route path="/crm/leads/:id"             element={<P permission="outreach"><LeadForm /></P>} />
      <Route path="/crm/pipeline"              element={<P permission="outreach"><DealPipeline /></P>} />
      <Route path="/crm/activities"            element={<P permission="outreach"><ActivityList /></P>} />
      <Route path="/crm/activities/new"        element={<P permission="outreach"><ActivityForm /></P>} />
      <Route path="/crm/activities/:id"        element={<P permission="outreach"><ActivityForm /></P>} />
      <Route path="/crm/contacts"              element={<P permission="outreach"><ContactList /></P>} />
      <Route path="/crm/contacts/new"          element={<P permission="outreach"><ContactForm /></P>} />
      <Route path="/crm/contacts/:id"          element={<P permission="outreach"><ContactForm /></P>} />
      <Route path="/client-contacts"           element={<P permission="outreach"><ClientContacts /></P>} />
      <Route path="/crm/inbox"                 element={<P permission="outreach"><TriageInbox /></P>} />

      {/* ── Public: document approval — no auth required ── */}
      <Route
        path="/approve/:token"
        element={<Suspense fallback={<LoadingFallback />}><ApprovalPage /></Suspense>}
      />

      {/* ── Fallback ── */}
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
