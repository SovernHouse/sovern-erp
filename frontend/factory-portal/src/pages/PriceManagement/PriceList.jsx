import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown } from 'lucide-react';
import DataTable from '../../components/DataTable';
import { Button } from '../../components/FormFields';
import { pricesAPI } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import toast from 'react-hot-toast';

function PriceList() {
  const [prices, setPrices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadPrices();
  }, [searchTerm]);

  const loadPrices = async () => {
    setIsLoading(true);
    try {
      const response = await pricesAPI.list({ search: searchTerm });
      setPrices(response.data);
    } catch (error) {
      toast.error('Failed to load prices');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const columns = [
    { key: 'productCode', label: 'Product Code', sortable: true },
    { key: 'productName', label: 'Product Name', sortable: true },
    {
      key: 'currentPrice',
      label: 'Current Price',
      render: (price) => formatCurrency(price),
      sortable: true,
    },
    {
      key: 'previousPrice',
      label: 'Previous Price',
      render: (price) => formatCurrency(price),
    },
    {
      key: 'priceChange',
      label: 'Change',
      render: (_, row) => {
        const change = row.currentPrice - (row.previousPrice || row.currentPrice);
        const percentage =
          row.previousPrice > 0
            ? ((change / row.previousPrice) * 100).toFixed(2)
            : 0;

        return (
          <div className="flex items-center gap-1">
            {change > 0 ? (
              <>
                <TrendingUp size={18} className="text-green-600" />
                <span className="text-green-600 font-semibold">
                  {formatCurrency(change)} ({percentage}%)
                </span>
              </>
            ) : change < 0 ? (
              <>
                <TrendingDown size={18} className="text-red-600" />
                <span className="text-red-600 font-semibold">
                  {formatCurrency(change)} ({percentage}%)
                </span>
              </>
            ) : (
              <span className="text-gray-600">No change</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'effectiveDate',
      label: 'Effective Date',
      render: (date) => formatDate(date),
      sortable: true,
    },
    {
      key: 'expiryDate',
      label: 'Expiry Date',
      render: (date) => (date ? formatDate(date) : 'No expiry'),
    },
    {
      key: 'status',
      label: 'Status',
      render: (status) => (
        <span className={`px-2 py-1 rounded text-xs font-semibold ${
          status === 'active'
            ? 'bg-green-100 text-green-800'
            : status === 'scheduled'
            ? 'bg-blue-100 text-blue-800'
            : 'bg-gray-100 text-gray-800'
        }`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Price List</h1>
          <p className="text-gray-600 mt-1">Current pricing for all products</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate('/prices/update')}>
            Update Prices
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/products/bulk-price-update')}
          >
            Bulk Update
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow p-4">
        <input
          type="text"
          placeholder="Search by product code or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-factory-500"
        />
      </div>

      {/* Prices Table */}
      <div className="bg-white rounded-lg shadow">
        <DataTable
          columns={columns}
          data={prices}
          isLoading={isLoading}
          emptyMessage="No prices found"
        />
      </div>
    </div>
  );
}

export default PriceList;
