import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Select, Button } from '../../components/FormFields';
import Timeline from '../../components/Timeline';
import { productsAPI, pricesAPI } from '../../services/api';
import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters';
import toast from 'react-hot-toast';

function PriceHistory() {
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [historyData, setHistoryData] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const response = await productsAPI.list({ limit: 1000 });
      setProducts(response.data);
      if (response.data.length > 0) {
        setSelectedProductId(response.data[0].id.toString());
        await loadPriceHistory(response.data[0].id);
      }
    } catch (error) {
      toast.error('Failed to load products');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPriceHistory = async (productId) => {
    setIsLoading(true);
    try {
      const response = await pricesAPI.getHistory(productId);
      setHistoryData(response.data);

      // Prepare chart data
      const chartData = response.data
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map((item) => ({
          date: formatDate(item.date),
          price: item.price,
          fullDate: item.date,
        }));

      setChartData(chartData);
    } catch (error) {
      toast.error('Failed to load price history');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProductChange = (productId) => {
    setSelectedProductId(productId);
    loadPriceHistory(productId);
  };

  const timelineEvents = historyData.map((item) => ({
    title: `Price: ${formatCurrency(item.price)}`,
    description: item.reason || 'Price update',
    date: item.date,
    status: 'completed',
    details: `Valid from ${formatDate(item.effectiveDate)}${
      item.expiryDate ? ` to ${formatDate(item.expiryDate)}` : ''
    }`,
  }));

  const selectedProduct = products.find(
    (p) => p.id.toString() === selectedProductId
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Price History</h1>
        <p className="text-gray-600 mt-1">Track price changes over time</p>
      </div>

      {/* Product Selection */}
      <div className="bg-white rounded-lg shadow p-4">
        <Select
          value={selectedProductId}
          onChange={(e) => handleProductChange(e.target.value)}
          options={products.map((p) => ({
            value: p.id.toString(),
            label: `${p.productCode} - ${p.productName}`,
          }))}
          placeholder="Select a product"
        />
      </div>

      {selectedProduct && (
        <>
          {/* Product Info Card */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-factory-600">
              <p className="text-sm font-medium text-gray-600">Product Code</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {selectedProduct.productCode}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-600">
              <p className="text-sm font-medium text-gray-600">Current Price</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {formatCurrency(selectedProduct.currentPrice)}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-600">
              <p className="text-sm font-medium text-gray-600">Changes</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {historyData.length}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-600">
              <p className="text-sm font-medium text-gray-600">MOQ</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {formatNumber(selectedProduct.moq)} units
              </p>
            </div>
          </div>

          {/* Price Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Price Trend</h2>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#e67e22"
                    strokeWidth={2}
                    dot={{ fill: '#e67e22' }}
                    activeDot={{ r: 6 }}
                    name="Price (USD)"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                No price history available
              </div>
            )}
          </div>

          {/* History Timeline */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Change History</h2>
            <Timeline events={timelineEvents} isLoading={isLoading} />
          </div>

          {/* Price Changes Table */}
          {historyData.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">All Changes</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Price
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Effective From
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Expires
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                        Reason
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyData.map((item, index) => (
                      <tr
                        key={index}
                        className="border-b border-gray-200 hover:bg-gray-50"
                      >
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {formatDate(item.date)}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                          {formatCurrency(item.price)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {formatDate(item.effectiveDate)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {item.expiryDate ? formatDate(item.expiryDate) : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {item.reason || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default PriceHistory;
