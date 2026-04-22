import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Zap,
  Truck,
  CheckSquare,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import StatsCard from '../components/StatsCard';
import DataTable from '../components/DataTable';
import Timeline from '../components/Timeline';
import { dashboardAPI } from '../services/api';
import { formatDate, formatCurrency } from '../utils/formatters';
import toast from 'react-hot-toast';

function Dashboard() {
  const [kpis, setKpis] = useState(null);
  const [revenueData, setRevenueData] = useState([]);
  const [poDistribution, setPoDistribution] = useState([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState([]);
  const [recentPOs, setRecentPOs] = useState([]);
  const [inspectionSchedule, setInspectionSchedule] = useState([]);
  const [actionItems, setActionItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    loadDashboardData();
  }, [period]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [
        kpisRes,
        revenueRes,
        poRes,
        deadlinesRes,
        posRes,
        inspectionsRes,
        actionsRes,
      ] = await Promise.all([
        dashboardAPI.getKPIs(),
        dashboardAPI.getRevenueChart(period),
        dashboardAPI.getPOStatusDistribution(),
        dashboardAPI.getUpcomingDeadlines(),
        dashboardAPI.getRecentPOs(),
        dashboardAPI.getInspectionSchedule(),
        dashboardAPI.getActionItems(),
      ]);

      setKpis(kpisRes.data);
      setRevenueData(revenueRes.data);
      setPoDistribution(poRes.data);
      setUpcomingDeadlines(deadlinesRes.data);
      setRecentPOs(posRes.data);
      setInspectionSchedule(inspectionsRes.data);
      setActionItems(actionsRes.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const poColumns = [
    { key: 'poNumber', label: 'PO Number', sortable: true },
    {
      key: 'poNumber',
      label: 'Client Ref',
      render: (value) => `Client Ref: ${value}`,
      sortable: true,
    },
    {
      key: 'totalValue',
      label: 'Total Value',
      render: (value) => formatCurrency(value),
    },
    {
      key: 'status',
      label: 'Status',
      render: (status) => (
        <span className={`px-2 py-1 rounded text-xs font-semibold ${
          status === 'confirmed'
            ? 'bg-green-100 text-green-800'
            : status === 'in_progress'
            ? 'bg-blue-100 text-blue-800'
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {status}
        </span>
      ),
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      render: (date) => formatDate(date),
    },
  ];

  const deadlineColumns = [
    { key: 'poNumber', label: 'PO Number', sortable: true },
    { key: 'itemName', label: 'Item', sortable: true },
    {
      key: 'daysUntilDue',
      label: 'Days Until Due',
      render: (days) => (
        <span className={days <= 7 ? 'text-red-600 font-semibold' : 'text-gray-700'}>
          {days} days
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Production Status',
      render: (status) => (
        <span className="px-2 py-1 rounded text-xs font-semibold bg-purple-100 text-purple-800">
          {status}
        </span>
      ),
    },
  ];

  const actionItemColumns = [
    { key: 'title', label: 'Action', sortable: true },
    {
      key: 'type',
      label: 'Type',
      render: (type) => (
        <span className={`px-2 py-1 rounded text-xs font-semibold ${
          type === 'urgent'
            ? 'bg-red-100 text-red-800'
            : type === 'warning'
            ? 'bg-yellow-100 text-yellow-800'
            : 'bg-blue-100 text-blue-800'
        }`}>
          {type}
        </span>
      ),
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      render: (date) => formatDate(date),
    },
  ];

  const inspectionColumns = [
    { key: 'inspectionId', label: 'Inspection ID', sortable: true },
    { key: 'poNumber', label: 'PO Number', sortable: true },
    {
      key: 'scheduledDate',
      label: 'Scheduled Date',
      render: (date) => formatDate(date),
    },
    { key: 'inspectorName', label: 'Inspector', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (status) => (
        <span className={`px-2 py-1 rounded text-xs font-semibold ${
          status === 'scheduled'
            ? 'bg-blue-100 text-blue-800'
            : status === 'completed'
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-800'
        }`}>
          {status}
        </span>
      ),
    },
  ];

  const COLORS = ['#e67e22', '#3498db', '#2ecc71', '#e74c3c'];

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome to your factory portal</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Active Purchase Orders"
          value={kpis?.activePOs || 0}
          icon={ShoppingCart}
          isLoading={isLoading}
        />
        <StatsCard
          title="Production In Progress"
          value={kpis?.productionInProgress || 0}
          icon={Zap}
          isLoading={isLoading}
        />
        <StatsCard
          title="Pending Shipments"
          value={kpis?.pendingShipments || 0}
          icon={Truck}
          isLoading={isLoading}
        />
        <StatsCard
          title="Pending Inspections"
          value={kpis?.pendingInspections || 0}
          icon={CheckSquare}
          isLoading={isLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">Revenue Trend</h2>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-factory-500"
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
              <option value="year">This Year</option>
            </select>
          </div>
          {revenueData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#e67e22"
                  strokeWidth={2}
                  dot={{ fill: '#e67e22' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </div>

        {/* PO Status Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">PO Status Distribution</h2>
          {poDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={poDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {poDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Action Items & Alerts */}
      {actionItems.length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-600 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-semibold text-red-800 mb-2">Action Items</h3>
              <ul className="space-y-1">
                {actionItems.slice(0, 5).map((item, index) => (
                  <li key={index} className="text-sm text-red-700">
                    • {item.title} (Due: {formatDate(item.dueDate)})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Deadlines */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Upcoming Deadlines</h2>
        <DataTable
          columns={deadlineColumns}
          data={upcomingDeadlines}
          isLoading={isLoading}
          emptyMessage="No upcoming deadlines"
        />
      </div>

      {/* Recent POs */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Recent Purchase Orders</h2>
        <DataTable
          columns={poColumns}
          data={recentPOs}
          isLoading={isLoading}
          emptyMessage="No recent purchase orders"
        />
      </div>

      {/* Inspection Schedule */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Inspection Schedule</h2>
        <DataTable
          columns={inspectionColumns}
          data={inspectionSchedule}
          isLoading={isLoading}
          emptyMessage="No scheduled inspections"
        />
      </div>
    </div>
  );
}

export default Dashboard;
