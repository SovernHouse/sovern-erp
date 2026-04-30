import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'
import { EmailInput, PasswordInput } from '../../components/FormFields'
import tenant from '../../config/tenant'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [loginError, setLoginError] = useState('')
  const { login, isLoading } = useAuth()
  const navigate = useNavigate()

  const validateForm = () => {
    const newErrors = {}
    if (!email) newErrors.email = 'Email is required'
    if (!password) newErrors.password = 'Password is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoginError('')
    const result = await login(email, password)
    if (result.success) {
      toast.success('Login successful!')
      navigate('/')
    } else {
      const errMsg = result.error || 'Login failed. Please check your credentials.'
      setLoginError(errMsg)
      toast.error(errMsg)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-lg flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-2xl font-bold text-primary-600">ERP</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Trading ERP</h1>
          <p className="text-primary-100 mt-2">Admin Portal</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Sign In</h2>

          {loginError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700">{loginError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <EmailInput
              label="Email Address"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (errors.email) setErrors({ ...errors, email: '' })
              }}
              error={errors.email}
              placeholder="admin@example.com"
              required
            />

            <PasswordInput
              label="Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (errors.password) setErrors({ ...errors, password: '' })
              }}
              error={errors.password}
              placeholder="••••••••"
              required
            />

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-300"
                />
                <span className="ml-2 text-slate-700">Remember me</span>
              </label>
              <Link
                to="/forgot-password"
                className="text-primary-600 hover:text-primary-700 font-medium"
              >
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary-600 text-white py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-xs text-slate-600 text-center mb-3">Demo Credentials</p>
            <div className="bg-slate-50 rounded p-3 space-y-1 text-xs">
              <p className="text-slate-700">
                <span className="font-medium">Email:</span> {tenant.adminEmail}
              </p>
              <p className="text-slate-700">
                <span className="font-medium">Password:</span> admin123
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-primary-100 text-sm mt-6">
          © 2024 Trading ERP. All rights reserved.
        </p>
      </div>
    </div>
  )
}
