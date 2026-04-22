import React from 'react';

export function FormGroup({ label, required, error, children }) {
  return (
    <div className="mb-4">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-600">*</span>}
        </label>
      )}
      {children}
      {error && <p className="text-red-600 text-sm mt-1">{error}</p>}
    </div>
  );
}

export function Input({
  type = 'text',
  placeholder,
  value,
  onChange,
  disabled,
  error,
  ...props
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
        error
          ? 'border-red-500 focus:ring-red-500'
          : 'border-gray-300 focus:ring-factory-500'
      } disabled:bg-gray-100 disabled:cursor-not-allowed`}
      {...props}
    />
  );
}

export function Textarea({
  placeholder,
  value,
  onChange,
  rows = 4,
  disabled,
  error,
  ...props
}) {
  return (
    <textarea
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      rows={rows}
      disabled={disabled}
      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-all font-mono text-sm ${
        error
          ? 'border-red-500 focus:ring-red-500'
          : 'border-gray-300 focus:ring-factory-500'
      } disabled:bg-gray-100 disabled:cursor-not-allowed`}
      {...props}
    />
  );
}

export function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  error,
  ...props
}) {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-all ${
        error
          ? 'border-red-500 focus:ring-red-500'
          : 'border-gray-300 focus:ring-factory-500'
      } disabled:bg-gray-100 disabled:cursor-not-allowed`}
      {...props}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options?.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({ label, checked, onChange, disabled }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="w-4 h-4 text-factory-600 border-gray-300 rounded focus:ring-factory-500 disabled:cursor-not-allowed"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading,
  disabled,
  ...props
}) {
  const baseClasses =
    'font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variantClasses = {
    primary: 'bg-factory-600 text-white hover:bg-factory-700 focus:ring-factory-500',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-500',
    outline:
      'border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-factory-500',
    danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
  };

  const sizeClasses = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      disabled={isLoading || disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
      {...props}
    >
      {isLoading && (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
      )}
      {children}
    </button>
  );
}
