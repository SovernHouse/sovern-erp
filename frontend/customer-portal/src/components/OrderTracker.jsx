import React from 'react'
import {
  CheckCircle,
  Wrench,
  Package,
  Truck,
  Ship,
  Home,
  Circle,
} from 'lucide-react'
import { formatDate } from '../utils/formatters'

const ORDER_STEPS = [
  {
    key: 'CONFIRMED',
    label: 'Confirmed',
    icon: CheckCircle,
    description: 'Order confirmed',
  },
  {
    key: 'IN_PRODUCTION',
    label: 'In Production',
    icon: Wrench,
    description: 'Manufacturing',
  },
  {
    key: 'READY',
    label: 'Ready',
    icon: Package,
    description: 'Ready to ship',
  },
  {
    key: 'SHIPPED',
    label: 'Shipped',
    icon: Truck,
    description: 'In transit',
  },
  {
    key: 'IN_TRANSIT',
    label: 'In Transit',
    icon: Ship,
    description: 'Overseas transit',
  },
  {
    key: 'DELIVERED',
    label: 'Delivered',
    icon: Home,
    description: 'Delivered',
  },
]

export default function OrderTracker({ status, estimatedDates = {} }) {
  const statusIndex = ORDER_STEPS.findIndex((step) => step.key === status)
  const currentStepIndex = statusIndex >= 0 ? statusIndex : 0

  return (
    <div className="w-full">
      {/* Timeline */}
      <div className="space-y-6">
        {/* Visual Line */}
        <div className="flex items-start">
          <div className="flex-1">
            {/* Steps */}
            <div className="flex justify-between items-start relative">
              {/* Progress Line Background */}
              <div className="absolute top-6 left-0 right-0 h-1 bg-gray-200 z-0"></div>

              {/* Progress Line Foreground */}
              <div
                className="absolute top-6 left-0 h-1 bg-gradient-to-r from-primary-600 to-accent-500 z-0 transition-all duration-500"
                style={{
                  width: `${(currentStepIndex / (ORDER_STEPS.length - 1)) * 100}%`,
                }}
              ></div>

              {/* Step Items */}
              {ORDER_STEPS.map((step, index) => {
                const Icon = step.icon
                const isCompleted = index < currentStepIndex
                const isCurrent = index === currentStepIndex
                const isUpcoming = index > currentStepIndex

                return (
                  <div key={step.key} className="flex flex-col items-center relative z-10">
                    {/* Circle */}
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold transition-all duration-300 mb-3 ${
                        isCompleted
                          ? 'bg-accent-500 text-white shadow-lg'
                          : isCurrent
                          ? 'bg-primary-600 text-white shadow-lg ring-4 ring-primary-200'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {isCompleted || isCurrent ? (
                        <Icon size={24} />
                      ) : (
                        <Circle size={24} />
                      )}
                    </div>

                    {/* Label */}
                    <p
                      className={`text-sm font-semibold text-center transition-colors ${
                        isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-500'
                      }`}
                    >
                      {step.label}
                    </p>

                    {/* Date */}
                    {estimatedDates[step.key] && (
                      <p className="text-xs text-gray-500 mt-1 text-center">
                        {formatDate(estimatedDates[step.key])}
                      </p>
                    )}

                    {/* Status Badge */}
                    {isCurrent && (
                      <div className="mt-2 px-3 py-1 bg-primary-100 text-primary-700 text-xs font-semibold rounded-full">
                        Current
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Status Details */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-primary-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-primary-600 rounded-full mt-1.5 flex-shrink-0"></div>
            <div>
              <p className="font-semibold text-gray-900">
                {ORDER_STEPS[currentStepIndex].label}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {ORDER_STEPS[currentStepIndex].description}
              </p>
              {estimatedDates[ORDER_STEPS[currentStepIndex].key] && (
                <p className="text-xs text-gray-500 mt-2">
                  Expected: {formatDate(estimatedDates[ORDER_STEPS[currentStepIndex].key])}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
