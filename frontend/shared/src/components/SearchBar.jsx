import { Search, X } from 'lucide-react'
import { useState } from 'react'

export default function SearchBar({ onSearch, placeholder = 'Search...', debounceMs = 300 }) {
  const [query, setQuery] = useState('')
  const [timeoutId, setTimeoutId] = useState(null)

  const handleChange = (e) => {
    const value = e.target.value
    setQuery(value)

    if (timeoutId) clearTimeout(timeoutId)

    const id = setTimeout(() => {
      onSearch(value)
    }, debounceMs)

    setTimeoutId(id)
  }

  const handleClear = () => {
    setQuery('')
    onSearch('')
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
      <input
        type="text"
        value={query}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {query && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}
