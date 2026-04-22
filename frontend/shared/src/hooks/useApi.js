import { useCallback, useState } from 'react'
import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

export const useApi = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const request = useCallback(async (method, url, data = null, config = {}) => {
    try {
      setLoading(true)
      setError(null)

      const token = localStorage.getItem('authToken')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const response = await apiClient({
        method,
        url,
        data,
        headers,
        ...config,
      })

      return response.data
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message
      setError(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const get = useCallback((url, config) => request('GET', url, null, config), [request])
  const post = useCallback((url, data, config) => request('POST', url, data, config), [request])
  const put = useCallback((url, data, config) => request('PUT', url, data, config), [request])
  const patch = useCallback((url, data, config) => request('PATCH', url, data, config), [request])
  const del = useCallback((url, config) => request('DELETE', url, null, config), [request])

  return {
    loading,
    error,
    get,
    post,
    put,
    patch,
    del,
  }
}
