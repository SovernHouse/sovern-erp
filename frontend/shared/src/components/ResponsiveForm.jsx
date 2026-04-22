import React from 'react'
import { useIsMobile, useIsTablet } from '../utils/responsive'

export default function ResponsiveForm({
  children,
  columns = 1,
  onSubmit,
  submitLabel = 'Submit',
  submitLoading = false,
  gap = 'gap-6',
  className = '',
}) {
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()

  // Determine actual columns based on screen size
  const getColumns = () => {
    if (isMobile) return 1
    if (isTablet) return 2
    return columns
  }

  const actualColumns = getColumns()

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.(e)
      }}
      className={`${className}`}
    >
      <div
        className={`grid grid-cols-1 ${
          actualColumns === 2
            ? 'md:grid-cols-2'
            : actualColumns === 3
              ? 'md:grid-cols-2 lg:grid-cols-3'
              : 'md:grid-cols-1'
        } ${gap}`}
      >
        {children}
      </div>

      {/* Submit Button */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <button
          type="submit"
          disabled={submitLoading}
          className={`w-full md:w-auto px-6 md:px-8 py-3 md:py-2 bg-primary-600 text-white rounded-lg font-medium transition-colors min-h-[44px] md:min-h-[40px] ${
            submitLoading
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:bg-primary-700 active:bg-primary-800'
          }`}
        >
          {submitLoading ? 'Loading...' : submitLabel}
        </button>
      </div>
    </form>
  )
}

export function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  required = false,
  placeholder,
  disabled = false,
  hint,
  fullWidth = false,
  autoFocus = false,
  min,
  max,
  step,
  children,
  className = '',
}) {
  const isMobile = useIsMobile()

  return (
    <div className={`flex flex-col ${fullWidth ? 'w-full' : ''}`}>
      <label
        htmlFor={name}
        className="block text-sm font-medium text-gray-700 mb-2"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {type === 'textarea' ? (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoFocus={autoFocus}
          rows={4}
          className={`w-full px-4 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-base md:text-sm transition-all ${
            error ? 'border-red-500 focus:ring-red-500' : ''
          } ${className}`}
        />
      ) : type === 'select' ? (
        <select
          id={name}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          required={required}
          className={`w-full px-4 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-base md:text-sm transition-all appearance-none bg-white ${
            error ? 'border-red-500 focus:ring-red-500' : ''
          } ${className}`}
        >
          <option value="">Select {label.toLowerCase()}</option>
          {children}
        </select>
      ) : (
        <input
          id={name}
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          autoFocus={autoFocus}
          min={min}
          max={max}
          step={step}
          className={`w-full px-4 py-3 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-base md:text-sm transition-all ${
            error ? 'border-red-500 focus:ring-red-500' : ''
          } ${className}`}
        />
      )}

      {error && (
        <p className="mt-2 text-sm text-red-500 font-medium">{error}</p>
      )}

      {hint && !error && (
        <p className="mt-2 text-sm text-gray-500">{hint}</p>
      )}
    </div>
  )
}

export function FormFieldGroup({
  children,
  fullWidth = false,
}) {
  return (
    <div className={`flex flex-col gap-4 ${fullWidth ? 'md:col-span-2' : ''}`}>
      {children}
    </div>
  )
}
