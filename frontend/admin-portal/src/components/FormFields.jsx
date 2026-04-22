export const TextInput = ({
  label,
  error,
  required,
  ...props
}) => (
  <div className="mb-4">
    {label && (
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
    )}
    <input
      type="text"
      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
        error ? 'border-red-500' : 'border-slate-300'
      }`}
      {...props}
    />
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
  </div>
)

export const NumberInput = ({
  label,
  error,
  required,
  ...props
}) => (
  <div className="mb-4">
    {label && (
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
    )}
    <input
      type="number"
      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
        error ? 'border-red-500' : 'border-slate-300'
      }`}
      {...props}
    />
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
  </div>
)

export const EmailInput = ({
  label,
  error,
  required,
  ...props
}) => (
  <div className="mb-4">
    {label && (
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
    )}
    <input
      type="email"
      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
        error ? 'border-red-500' : 'border-slate-300'
      }`}
      {...props}
    />
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
  </div>
)

export const PasswordInput = ({
  label,
  error,
  required,
  ...props
}) => (
  <div className="mb-4">
    {label && (
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
    )}
    <input
      type="password"
      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
        error ? 'border-red-500' : 'border-slate-300'
      }`}
      {...props}
    />
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
  </div>
)

export const SelectInput = ({
  label,
  error,
  required,
  options = [],
  ...props
}) => (
  <div className="mb-4">
    {label && (
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
    )}
    <select
      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
        error ? 'border-red-500' : 'border-slate-300'
      }`}
      {...props}
    >
      <option value="">Select {label || 'option'}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
  </div>
)

export const DateInput = ({
  label,
  error,
  required,
  ...props
}) => (
  <div className="mb-4">
    {label && (
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
    )}
    <input
      type="date"
      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
        error ? 'border-red-500' : 'border-slate-300'
      }`}
      {...props}
    />
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
  </div>
)

export const DateTimeInput = ({
  label,
  error,
  required,
  ...props
}) => (
  <div className="mb-4">
    {label && (
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
    )}
    <input
      type="datetime-local"
      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
        error ? 'border-red-500' : 'border-slate-300'
      }`}
      {...props}
    />
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
  </div>
)

export const TextArea = ({
  label,
  error,
  required,
  rows = 4,
  ...props
}) => (
  <div className="mb-4">
    {label && (
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
    )}
    <textarea
      rows={rows}
      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none ${
        error ? 'border-red-500' : 'border-slate-300'
      }`}
      {...props}
    />
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
  </div>
)

export const CheckboxInput = ({
  label,
  error,
  ...props
}) => (
  <div className="mb-4">
    <label className="flex items-center">
      <input
        type="checkbox"
        className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
        {...props}
      />
      {label && <span className="ml-2 text-sm text-slate-700">{label}</span>}
    </label>
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
  </div>
)

export const RadioInput = ({
  label,
  options = [],
  error,
  required,
  ...props
}) => (
  <div className="mb-4">
    {label && (
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
    )}
    <div className="space-y-2">
      {options.map((opt) => (
        <label key={opt.value} className="flex items-center">
          <input
            type="radio"
            value={opt.value}
            className="w-4 h-4 border-slate-300 text-primary-600 focus:ring-primary-500"
            {...props}
          />
          <span className="ml-2 text-sm text-slate-700">{opt.label}</span>
        </label>
      ))}
    </div>
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
  </div>
)

export const FileInput = ({
  label,
  error,
  required,
  accept,
  ...props
}) => (
  <div className="mb-4">
    {label && (
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
    )}
    <input
      type="file"
      accept={accept}
      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
        error ? 'border-red-500' : 'border-slate-300'
      }`}
      {...props}
    />
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
  </div>
)

export const CurrencyInput = ({
  label,
  error,
  required,
  currency = 'USD',
  ...props
}) => (
  <div className="mb-4">
    {label && (
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
    )}
    <div className="flex">
      <span className="inline-flex items-center px-3 bg-slate-100 border border-r-0 border-slate-300 rounded-l-lg text-slate-700 font-medium">
        {currency}
      </span>
      <input
        type="number"
        step="0.01"
        className={`flex-1 px-4 py-2 border rounded-r-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
          error ? 'border-red-500' : 'border-slate-300'
        }`}
        {...props}
      />
    </div>
    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
  </div>
)
