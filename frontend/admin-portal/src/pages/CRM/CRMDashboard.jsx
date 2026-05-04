import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  TrendingUp,
  DollarSign,
  Users,
  AlertCircle,
  Calendar,
  Target,
  Zap,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  FunnelChart,
  Funnel,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const CRMDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    pipelineValue: 0,
    weightedPipelineValue: 0,
    winRate: 0,
    avgDealSize: 0,
    activitiesToday: 0,
    leadsBySource: [],
    dealsByStage: [],
    recentActivities: [],
    topDeals: [],
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/crm/dashboard');
      setDashboardData(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load dashboard data');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const StatCard = ({ icon: Icon, label, value, subtext, bgColor }) => (
    <div className="bg-white rounded-lg shadow p-6 border-l-4" style={{ borderLeftColor: bgColor }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
          {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
        </div>
        <div className="p-3 rounded-lg" style={{ backgroundColor: `${bgColor}20` }}>
          <Icon size={24} style={{ color: bgColor }} />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">CRM Dashboard</h1>
          <p className="text-gray-600 mt-2">Real-time sales pipeline and performance metrics</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start">
            <AlertCircle className="text-red-600 mr-3 flex-shrink-0" size={20} />
            <div>
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={DollarSign}
            label="Pipeline Value"
            value={`$${parseFloat(dashboardData.pipelineValue).toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
            subtext={`Weighted: $${parseFloat(dashboardData.weightedPipelineValue).toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
            bgColor="#3b82f6"
          />
          <StatCard
            icon={TrendingUp}
            label="Win Rate"
            value={`${dashboardData.winRate}%`}
            subtext="Closed deals won"
            bgColor="#10b981"
          />
          <StatCard
            icon={Users}
            label="Avg Deal Size"
            value={`$${parseFloat(dashboardData.avgDealSize).toLocaleString('en-US', { minimumFractionDigits: 0 })}`}
            subtext="Average won deal"
            bgColor="#f59e0b"
          />
          <StatCard
            icon={Calendar}
            label="Activities Today"
            value={dashboardData.activitiesToday}
            subtext="Tasks due"
            bgColor="#ef4444"
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Pipeline Funnel */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales Pipeline Funnel</h2>
            <ResponsiveContainer width="100%" height={300}>
              <FunnelChart>
                <Tooltip />
                <Funnel
                  dataKey="value"
                  data={[
                    { name: 'Leads', value: dashboardData.dealsByStage.find(d => d.stage === 'prospecting')?.count || 0 },
                    { name: 'Qualified', value: dashboardData.dealsByStage.find(d => d.stage === 'qualification')?.count || 0 },
                    { name: 'Proposal', value: dashboardData.dealsByStage.find(d => d.stage === 'proposal')?.count || 0 },
                    { name: 'Negotiation', value: dashboardData.dealsByStage.find(d => d.stage === 'negotiation')?.count || 0 },
                    { name: 'Won', value: dashboardData.dealsByStage.find(d => d.stage === 'closed_won')?.count || 0 },
                  ]}
                >
                  <Tooltip />
                  {COLORS.map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>

          {/* Deals by Stage */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Deals by Stage (Value)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dashboardData.dealsByStage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="stage" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip
                  formatter={(value) => `$${parseFloat(value).toLocaleString()}`}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Lead Sources */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Lead Sources</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dashboardData.leadsBySource}
                  dataKey="count"
                  nameKey="source"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {dashboardData.leadsBySource.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Conversion Trend */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Conversion Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={[
                  { month: 'Jan', conversion: 65 },
                  { month: 'Feb', conversion: 78 },
                  { month: 'Mar', conversion: 72 },
                  { month: 'Apr', conversion: 85 },
                  { month: 'May', conversion: 90 },
                  { month: 'Jun', conversion: 88 },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb' }} />
                <Line type="monotone" dataKey="conversion" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Activities */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Zap size={20} className="text-blue-600 mr-2" />
              Recent Activities
            </h2>
            <div className="space-y-3">
              {dashboardData.recentActivities.length > 0 ? (
                dashboardData.recentActivities.map((activity, idx) => (
                  <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2">
                    <p className="text-sm font-medium text-gray-900">{activity.subject}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {activity.Contact?.firstName} {activity.Contact?.lastName} • {activity.type}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(activity.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No activities yet</p>
              )}
            </div>
          </div>

          {/* Top Deals */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Target size={20} className="text-blue-600 mr-2" />
              Top Deals
            </h2>
            <div className="space-y-3">
              {dashboardData.topDeals.length > 0 ? (
                dashboardData.topDeals.map((deal, idx) => (
                  <div key={idx} className="flex items-center justify-between border-b pb-3 last:border-b-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{deal.title}</p>
                      <p className="text-xs text-gray-600">{deal.Customer?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-blue-600">
                        ${parseFloat(deal.value).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">{deal.stage}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No deals yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CRMDashboard;
