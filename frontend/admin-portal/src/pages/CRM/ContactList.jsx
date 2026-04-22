import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Search,
  Plus,
  Phone,
  Mail,
  Edit2,
  Trash2,
  AlertCircle,
  User,
} from 'lucide-react';

const ContactList = () => {
  const [contacts, setContacts] = useState([]);
  const [filteredContacts, setFilteredContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    customerId: null,
    factoryId: null,
    isActive: true,
  });
  const [customers, setCustomers] = useState([]);
  const [factories, setFactories] = useState([]);

  useEffect(() => {
    fetchContacts();
    fetchCustomersAndFactories();
  }, [filters]);

  useEffect(() => {
    filterContacts();
  }, [contacts, searchTerm]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.customerId) params.append('customerId', filters.customerId);
      if (filters.factoryId) params.append('factoryId', filters.factoryId);
      params.append('isActive', filters.isActive);
      params.append('limit', 100);

      const response = await axios.get(`/api/crm/contacts?${params.toString()}`);
      setContacts(response.data.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load contacts');
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomersAndFactories = async () => {
    try {
      const [customersRes, factoriesRes] = await Promise.all([
        axios.get('/api/customers?limit=100'),
        axios.get('/api/factories?limit=100'),
      ]);
      setCustomers(customersRes.data.data || []);
      setFactories(factoriesRes.data.data || []);
    } catch (err) {
      console.error('Failed to load customers/factories:', err);
    }
  };

  const filterContacts = () => {
    let filtered = contacts;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        contact =>
          contact.firstName.toLowerCase().includes(term) ||
          contact.lastName.toLowerCase().includes(term) ||
          contact.email.toLowerCase().includes(term) ||
          (contact.phone && contact.phone.includes(term)) ||
          (contact.mobile && contact.mobile.includes(term))
      );
    }

    setFilteredContacts(filtered);
  };

  const handleDeleteContact = async (id) => {
    if (window.confirm('Are you sure you want to delete this contact?')) {
      try {
        await axios.delete(`/api/crm/contacts/${id}`);
        setContacts(contacts.filter(contact => contact.id !== id));
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to delete contact');
      }
    }
  };

  if (loading && contacts.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading contacts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
            <p className="text-gray-600 mt-2">{filteredContacts.length} contacts</p>
          </div>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center">
            <Plus size={20} className="mr-2" />
            New Contact
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start">
            <AlertCircle className="text-red-600 mr-3 flex-shrink-0" size={20} />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={filters.customerId || ''}
              onChange={(e) => setFilters({ ...filters, customerId: e.target.value || null })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Customers</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
              ))}
            </select>

            <select
              value={filters.factoryId || ''}
              onChange={(e) => setFilters({ ...filters, factoryId: e.target.value || null })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Factories</option>
              {factories.map(factory => (
                <option key={factory.id} value={factory.id}>{factory.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Contacts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredContacts.map(contact => (
            <div key={contact.id} className="bg-white rounded-lg shadow hover:shadow-lg transition p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                    <User className="text-blue-600" size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {contact.firstName} {contact.lastName}
                    </h3>
                    {contact.jobTitle && (
                      <p className="text-sm text-gray-600">{contact.jobTitle}</p>
                    )}
                  </div>
                </div>
                {contact.isPrimary && (
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Primary</span>
                )}
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center text-gray-600">
                  <Mail size={16} className="mr-3 flex-shrink-0" />
                  <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline text-sm">
                    {contact.email}
                  </a>
                </div>

                {contact.phone && (
                  <div className="flex items-center text-gray-600">
                    <Phone size={16} className="mr-3 flex-shrink-0" />
                    <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline text-sm">
                      {contact.phone}
                    </a>
                  </div>
                )}

                {contact.mobile && (
                  <div className="flex items-center text-gray-600">
                    <Phone size={16} className="mr-3 flex-shrink-0" />
                    <a href={`tel:${contact.mobile}`} className="text-blue-600 hover:underline text-sm">
                      {contact.mobile}
                    </a>
                  </div>
                )}
              </div>

              {contact.Customer && (
                <div className="mb-4 p-3 bg-gray-50 rounded">
                  <p className="text-xs text-gray-600">Company</p>
                  <p className="text-sm font-medium text-gray-900">{contact.Customer.name}</p>
                </div>
              )}

              {contact.notes && (
                <div className="mb-4 p-3 bg-blue-50 rounded">
                  <p className="text-xs text-gray-600">Notes</p>
                  <p className="text-sm text-gray-700">{contact.notes.substring(0, 80)}...</p>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t border-gray-200">
                <button className="flex-1 text-blue-600 hover:bg-blue-50 px-3 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium">
                  <Edit2 size={16} />
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteContact(contact.id)}
                  className="flex-1 text-red-600 hover:bg-red-50 px-3 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredContacts.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <User size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">No contacts found. Try adjusting your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactList;
