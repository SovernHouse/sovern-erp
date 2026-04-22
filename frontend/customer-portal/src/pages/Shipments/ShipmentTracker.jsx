import React, { useState, useEffect } from 'react'
import { Search, Filter } from 'lucide-react'
import { shipmentsAPI } from '../../services/api'
import ShipmentMap from '../../components/ShipmentMap'
import ShipmentTimeline from '../../components/ShipmentTimeline'
import StatusBadge from '../../components/StatusBadge'
import LoadingSpinner from '../../components/LoadingSpinner'
import { formatDate } from '../../utils/formatters'
import toast from 'react-hot-toast'

export default function ShipmentTracker() {
  const [shipments, setShipments] = useState([])
  const [selectedShipment, setSelectedShipment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    fetchShipments()
  }, [filter])

  const fetchShipments = async () => {
    setLoading(true)
    try {
      const params = filter === 'All' ? {} : { status: filter }
      const response = await shipmentsAPI.list(params)
      const ships = response.data.shipments || []
      setShipments(ships)
      if (ships.length > 0 && !selectedShipment) {
        setSelectedShipment(ships[0])
      }
    } catch (err) {
      console.error('Failed to fetch shipments:', err)
      toast.error('Failed to load shipments')
    } finally {
      setLoading(false)
    }
  }

  const filteredShipments = shipments.filter(
    (ship) =>
      ship.containerNumber.includes(searchTerm.toUpperCase()) ||
      ship.orderId?.toString().includes(searchTerm)
  )

  const displayShipment = selectedShipment || filteredShipments[0]

  const getProgress = (shipment) => {
    const statuses = ['CONFIRMED', 'IN_PRODUCTION', 'READY', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED']
    const statusIndex = statuses.indexOf(shipment.status)
    return ((statusIndex + 1) / statuses.length) * 100
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Shipment Tracking</h1>
        <p className="text-gray-600 mt-1">Track your orders in real-time</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-96">
          <LoadingSpinner text="Loading shipments..." />
        </div>
      ) : filteredShipments.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-500 text-lg">No shipments found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Shipments List */}
          <div className="lg:col-span-1 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search shipments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-base pl-10 w-full text-sm"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {['All', 'IN_TRANSIT', 'DELIVERED'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    filter === status
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status === 'All' ? 'All' : status.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredShipments.map((ship) => (
                <button
                  key={ship.id}
                  onClick={() => setSelectedShipment(ship)}
                  className={`w-full card p-4 text-left transition-all ${
                    displayShipment?.id === ship.id
                      ? 'ring-2 ring-primary-600 shadow-lg'
                      : 'hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-semibold text-gray-900 text-sm">
                      {ship.containerNumber}
                    </p>
                    <StatusBadge status={ship.status} size="sm" />
                  </div>
                  <p className="text-xs text-gray-600">
                    {ship.originPort} → {ship.destinationPort}
                  </p>
                  <div className="mt-2 bg-gray-100 rounded-full h-1.5 w-full">
                    <div
                      className="bg-gradient-to-r from-primary-600 to-accent-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${getProgress(ship)}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    ETA: {formatDate(ship.eta)}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Main Shipment View */}
          <div className="lg:col-span-3 space-y-6">
            {displayShipment && (
              <>
                {/* Header Info */}
                <div className="card p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        {displayShipment.containerNumber}
                      </h2>
                      <p className="text-gray-600 mt-2">
                        Order: ORD-{String(displayShipment.orderId).padStart(6, '0')}
                      </p>
                    </div>
                    <StatusBadge status={displayShipment.status} />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-gray-200">
                    <div>
                      <p className="text-sm text-gray-600">Vessel</p>
                      <p className="font-semibold text-gray-900">
                        {displayShipment.vesselName || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Type</p>
                      <p className="font-semibold text-gray-900">
                        {displayShipment.containerType || 'Standard'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Departure</p>
                      <p className="font-semibold text-gray-900">
                        {formatDate(displayShipment.departureDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Expected Arrival</p>
                      <p className="font-semibold text-gray-900 text-accent-600">
                        {formatDate(displayShipment.eta)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Map Visualization */}
                <ShipmentMap
                  origin={displayShipment.originPort}
                  destination={displayShipment.destinationPort}
                  currentLocation={displayShipment.currentLocation}
                  progress={getProgress(displayShipment)}
                />

                {/* Container Details */}
                <div className="card p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Container Details
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <div>
                      <p className="text-sm text-gray-600">Container Number</p>
                      <p className="font-mono font-semibold text-gray-900 mt-1">
                        {displayShipment.containerNumber}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Type</p>
                      <p className="font-semibold text-gray-900 mt-1">
                        {displayShipment.containerType || '20-Foot'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Weight</p>
                      <p className="font-semibold text-gray-900 mt-1">
                        {displayShipment.weight || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Vessel</p>
                      <p className="font-semibold text-gray-900 mt-1">
                        {displayShipment.vesselName || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Voyage</p>
                      <p className="font-semibold text-gray-900 mt-1">
                        {displayShipment.voyage || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Bill of Lading</p>
                      <p className="font-mono font-semibold text-gray-900 mt-1 text-sm">
                        {displayShipment.billOfLading || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="card p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Tracking Timeline
                  </h3>
                  <ShipmentTimeline events={displayShipment.events || []} />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
