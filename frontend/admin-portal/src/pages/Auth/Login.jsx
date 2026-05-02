import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'
import { EmailInput, PasswordInput } from '../../components/FormFields'

// Sovern House brand tokens
const SH = {
  forest: '#1D5A32',
  forestLight: '#2A7040',
  cream: '#F1EEE7',
  creamDark: '#E4E0D8',
  ink: '#0E0D0C',
  inkMuted: 'rgba(14,13,12,0.55)',
}

// Sovern House wordmark — three stacked elements sharing identical width
function Wordmark({ size = 'md' }) {
  const sovern = size === 'lg' ? 52 : 36
  const rule = size === 'lg' ? 3 : 2
  const house = size === 'lg' ? 13 : 9

  return (
    <div style={{ display: 'inline-block', textAlign: 'left' }}>
      {/* SOVERN */}
      <div
        style={{
          fontFamily: "'Big Shoulders Display', sans-serif",
          fontWeight: 700,
          fontSize: sovern,
          lineHeight: 1,
          color: SH.cream,
          letterSpacing: '0.01em',
          whiteSpace: 'nowrap',
        }}
      >
        SOVERN
      </div>
      {/* Rule */}
      <div style={{ height: rule, background: SH.cream, width: '100%', margin: '3px 0' }} />
      {/* HOUSE — flex space-between to match SOVERN width exactly */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: "'Arsenal SC', sans-serif",
          fontWeight: 400,
          fontSize: house,
          lineHeight: 1,
          color: SH.cream,
          letterSpacing: 0,
          textTransform: 'uppercase',
        }}
      >
        {'HOUSE'.split('').map((l, i) => <span key={i}>{l}</span>)}
      </div>
    </div>
  )
}

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
    <div
      style={{ background: SH.forest, minHeight: '100vh' }}
      className="flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md">

        {/* Wordmark */}
        <div className="text-center mb-10">
          <Wordmark size="lg" />
          <p
            style={{
              fontFamily: "'Arsenal SC', sans-serif",
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(241,238,231,0.55)',
              marginTop: 10,
            }}
          >
            Operations Platform
          </p>
        </div>

        {/* Login Card */}
        <div style={{ background: SH.cream, padding: '36px 40px' }}>

          <h2
            style={{
              fontFamily: "'Arsenal SC', sans-serif",
              fontSize: 13,
              fontWeight: 400,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: SH.inkMuted,
              marginBottom: 24,
            }}
          >
            Sign In
          </h2>

          {loginError && (
            <div
              className="mb-4 p-3 flex items-start gap-2"
              style={{ background: '#fef2f2', border: '1px solid #fecaca' }}
            >
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm" style={{ color: '#b91c1c' }}>{loginError}</p>
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
              placeholder="admin@sovernhouse.co"
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

            <div className="flex items-center justify-between text-sm" style={{ marginTop: 8 }}>
              <label className="flex items-center" style={{ cursor: 'pointer' }}>
                <input type="checkbox" className="w-4 h-4 border-slate-300" style={{ accentColor: SH.forest }} />
                <span className="ml-2" style={{ color: SH.inkMuted, fontSize: 13 }}>Remember me</span>
              </label>
              <Link
                to="/forgot-password"
                style={{ color: SH.forest, fontSize: 13, fontWeight: 500 }}
                className="hover:underline"
              >
                Forgot Password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                background: isLoading ? SH.forestLight : SH.forest,
                color: SH.cream,
                fontFamily: "'Arsenal SC', sans-serif",
                fontSize: 13,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                padding: '12px 0',
                border: 'none',
                borderRadius: 0,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.7 : 1,
                marginTop: 8,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!isLoading) e.target.style.background = SH.forestLight }}
              onMouseLeave={e => { if (!isLoading) e.target.style.background = SH.forest }}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p
          className="text-center mt-8"
          style={{
            fontFamily: "'Arsenal SC', sans-serif",
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(241,238,231,0.35)',
          }}
        >
          © {new Date().getFullYear()} Sovern House. All rights reserved.
        </p>

      </div>
    </div>
  )
}
