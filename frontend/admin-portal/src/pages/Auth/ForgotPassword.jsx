import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'
import { EmailInput } from '../../components/FormFields'
import { ArrowLeft } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState({})
  const { forgotPassword, isLoading } = useAuth()

  const validateForm = () => {
    const newErrors = {}
    if (!email) newErrors.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Email is invalid'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validateForm()) return

    const result = await forgotPassword(email)
    if (result.success) {
      setSubmitted(true)
      toast.success('Password reset email sent!')
    } else {
      toast.error(result.error || 'Failed to send email')
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
        </div>

        {/* Card */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          {!submitted ? (
            <>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Reset Password</h2>
              <p className="text-slate-600 mb-6">
                Enter your email address and we'll send you a link to reset your password.
              </p>

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

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary-600 text-white py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                >
                  {isLoading ? 'Sending...' : 'Send Reset Email'}
                </button>
              </form>

              <Link
                to="/login"
                className="flex items-center justify-center text-primary-600 hover:text-primary-700 font-medium text-sm mt-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Login
              </Link>
            </>
          ) : (
            <>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-6 h-6 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Check Your Email</h2>
                <p className="text-slate-600 mb-6">
                  We've sent a password reset link to <strong>{email}</strong>. Please check your email and follow the instructions to reset your password.
                </p>

                <Link
                  to="/login"
                  className="block w-full bg-primary-600 text-white py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors text-center"
                >
                  Back to Login
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-primary-100 text-sm mt-6">
          © 2024 Trading ERP. All rights reserved.
        </p>
      </div>
    </div>
  )
}
