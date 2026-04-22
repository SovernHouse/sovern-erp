import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Mail, ArrowLeft } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const navigate = useNavigate()
  const { forgotPassword, loading } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) {
      toast.error('Please enter your email address')
      return
    }

    try {
      await forgotPassword(email)
      setSubmitted(true)
    } catch (err) {
      // Error is handled by the hook
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 flex items-center justify-center p-4">
        <div className="relative z-10 w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-accent-500 to-accent-600 px-8 py-12 text-center">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="text-accent-600" size={32} />
              </div>
              <h1 className="text-2xl font-bold text-white">Check Your Email</h1>
            </div>

            <div className="p-8 space-y-6 text-center">
              <div>
                <p className="text-gray-700 mb-2">
                  We've sent a password reset link to:
                </p>
                <p className="font-semibold text-gray-900">{email}</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  Check your email (and spam folder) for the reset link. It expires in 24 hours.
                </p>
              </div>

              <button
                onClick={() => navigate('/login')}
                className="w-full btn-primary justify-center"
              >
                Back to Login
              </button>

              <p className="text-sm text-gray-600">
                Didn't receive the email?{' '}
                <button
                  onClick={() => setSubmitted(false)}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  Try again
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 flex items-center justify-center p-4">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-accent-500/10 rounded-full blur-3xl"></div>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-8 py-8 text-center">
            <h1 className="text-2xl font-bold text-white">Reset Password</h1>
            <p className="text-primary-100 text-sm mt-2">
              Enter your email to receive a reset link
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {/* Email Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-gray-400" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@company.com"
                  className="input-base pl-10"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary justify-center text-base font-semibold py-3"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            {/* Back to Login */}
            <div className="text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                <ArrowLeft size={16} />
                Back to Login
              </Link>
            </div>
          </form>

          {/* Footer */}
          <div className="px-8 py-4 bg-gray-50 border-t border-gray-200 text-center text-sm text-gray-600">
            <p>We'll send you a secure link to reset your password.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
