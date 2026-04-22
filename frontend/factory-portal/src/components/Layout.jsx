import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  Home,
  Package,
  DollarSign,
  ShoppingCart,
  Zap,
  Truck,
  CheckSquare,
  FileText,
  User,
  Settings,
  LogOut,
  ChevronDown,
  Boxes,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { LanguageSwitcher } from '@shared/components';

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedMenu, setExpandedMenu] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Logout failed');
    }
  };

  const menuItems = [
    {
      label: 'Dashboard',
      icon: Home,
      path: '/',
    },
    {
      label: 'Products',
      icon: Package,
      submenu: [
        { label: 'Product List', path: '/products' },
        { label: 'Add Product', path: '/products/new' },
        { label: 'Bulk Price Update', path: '/products/bulk-price-update' },
      ],
    },
    {
      label: 'Price Management',
      icon: DollarSign,
      submenu: [
        { label: 'Price List', path: '/prices' },
        { label: 'Update Prices', path: '/prices/update' },
        { label: 'Price History', path: '/prices/history' },
      ],
    },
    {
      label: 'Purchase Orders',
      icon: ShoppingCart,
      submenu: [
        { label: 'All POs', path: '/purchase-orders' },
        { label: 'Confirm PO', path: '/purchase-orders' },
      ],
    },
    {
      label: 'Production',
      icon: Zap,
      submenu: [
        { label: 'Production Tracker', path: '/production' },
        { label: 'Calendar', path: '/production/calendar' },
        { label: 'Production Plan', path: '/production/gantt' },
      ],
    },
    {
      label: 'Shipping',
      icon: Truck,
      submenu: [
        { label: 'Shipments', path: '/shipping' },
        { label: 'Create Shipment', path: '/shipping/new' },
      ],
    },
    {
      label: 'Inspections',
      icon: CheckSquare,
      submenu: [
        { label: 'Schedule', path: '/inspections/schedule' },
        { label: 'Results', path: '/inspections/results' },
        { label: 'Preparation', path: '/inspections/prep' },
      ],
    },
    {
      label: 'Warehouse',
      icon: Boxes,
      submenu: [
        { label: 'Scan Receive', path: '/warehouse/scan-receive' },
        { label: 'Scan Inventory', path: '/warehouse/scan-inventory' },
      ],
    },
    {
      label: 'Documents',
      icon: FileText,
      path: '/documents',
    },
    {
      label: 'Profile',
      icon: User,
      path: '/profile',
    },
    {
      label: 'Settings',
      icon: Settings,
      path: '/settings',
    },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const toggleMenu = (label) => {
    setExpandedMenu(expandedMenu === label ? null : label);
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } fixed md:static left-0 top-0 h-full w-64 md:w-64 bg-white shadow-lg md:shadow-md transition-all duration-300 flex flex-col border-r border-gray-200 z-40`}
      >
        {/* Logo */}
        <div className="p-4 md:p-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-8 h-8 bg-factory-600 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
              FP
            </div>
            {sidebarOpen && (
              <span className="font-bold text-gray-800 truncate">Factory</span>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-1 hover:bg-gray-100 rounded-lg text-gray-600 ml-2 flex-shrink-0"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {menuItems.map((item, index) => (
            <div key={index}>
              {item.submenu ? (
                <div>
                  <button
                    onClick={() => toggleMenu(item.label)}
                    className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors ${
                      expandedMenu === item.label
                        ? 'text-factory-600 bg-factory-50'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <item.icon size={20} />
                      {sidebarOpen && <span>{item.label}</span>}
                    </div>
                    {sidebarOpen && (
                      <ChevronDown
                        size={16}
                        className={`transition-transform ${
                          expandedMenu === item.label ? 'rotate-180' : ''
                        }`}
                      />
                    )}
                  </button>
                  {expandedMenu === item.label && sidebarOpen && (
                    <div className="bg-gray-50 py-2">
                      {item.submenu.map((subitem, subindex) => (
                        <Link
                          key={subindex}
                          to={subitem.path}
                          className={`flex items-center px-6 py-2 text-xs font-medium transition-colors ${
                            isActive(subitem.path)
                              ? 'text-factory-600 bg-factory-100 border-l-2 border-factory-600'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          {subitem.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                    isActive(item.path)
                      ? 'text-factory-600 bg-factory-50 border-l-4 border-factory-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <item.icon size={20} />
                  {sidebarOpen && <span>{item.label}</span>}
                </Link>
              )}
            </div>
          ))}
        </nav>

        {/* User Footer */}
        <div className="border-t border-gray-200 p-4 mt-auto">
          {sidebarOpen && (
            <div className="mb-4 pb-4 border-b border-gray-200">
              <p className="text-xs text-gray-500">Logged in as</p>
              <p className="text-sm font-medium text-gray-800 truncate">{user?.name}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between sticky top-0 z-20">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          >
            <Menu size={20} />
          </button>
          <h1 className="text-lg md:text-xl font-bold text-gray-800">Factory Portal</h1>
          <div className="flex items-center gap-2 md:gap-4 ml-auto">
            <LanguageSwitcher className="hidden md:block" />
            <span className="text-sm text-gray-600 hidden md:inline">{user?.factoryName}</span>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          <div style={{ fontSize: '16px' }}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Layout;
