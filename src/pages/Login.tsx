import { useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { authApi } from '../api/endpoints'
import { useAuth } from '../context/AuthContext'
import { ThemeToggle } from '../components/ThemeToggle'

const CODE_LENGTH = 6

function maskEmail(email: string) {
  const [name, domain] = email.split('@')
  if (!name || !domain) return email
  const visible = name.slice(0, 1)
  return `${visible}${'*'.repeat(Math.max(name.length - 1, 1))}@${domain}`
}

function apiMessage(err: unknown, fallback: string) {
  const msg =
    err && typeof err === 'object' && 'response' in err
      ? (err.response as { data?: { message?: string } })?.data?.message
      : null
  return msg || (err instanceof Error ? err.message : fallback)
}

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'password' | 'code'>('password')
  const [digits, setDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(''))
  const [resending, setResending] = useState(false)
  const inputs = useRef<Array<HTMLInputElement | null>>([])
  const { login, verifyLogin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)
    try {
      const result = await login(email, password)
      if (!result.twoFactor) {
        navigate(from, { replace: true })
        return
      }
      setDigits(Array(CODE_LENGTH).fill(''))
      setStep('code')
      setInfo(`Enter the 6-digit code sent to ${maskEmail(email.trim())}.`)
    } catch (err: unknown) {
      setError(apiMessage(err, 'Login failed'))
    } finally {
      setLoading(false)
    }
  }

  function updateDigit(index: number, value: string) {
    const next = value.replace(/\D/g, '')
    if (!next) {
      setDigits((current) => current.map((digit, digitIndex) => (digitIndex === index ? '' : digit)))
      return
    }
    const chars = next.slice(0, CODE_LENGTH - index).split('')
    setDigits((current) => {
      const copy = [...current]
      chars.forEach((char, offset) => {
        copy[index + offset] = char
      })
      return copy
    })
    const focusIndex = Math.min(index + chars.length, CODE_LENGTH - 1)
    inputs.current[focusIndex]?.focus()
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    const code = digits.join('')
    setError('')
    setInfo('')
    if (code.length !== CODE_LENGTH) {
      setError('Enter the 6-digit code from your email.')
      return
    }
    setLoading(true)
    try {
      await verifyLogin(email.trim(), code)
      navigate(from, { replace: true })
    } catch (err: unknown) {
      setError(apiMessage(err, 'That code is not valid'))
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setError('')
    setInfo('')
    setResending(true)
    try {
      await authApi.resendLoginCode({ email: email.trim() })
      setDigits(Array(CODE_LENGTH).fill(''))
      setInfo('A new code was sent to your email.')
      inputs.current[0]?.focus()
    } catch (err: unknown) {
      setError(apiMessage(err, 'Could not send a new code'))
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-theme-toggle">
        <ThemeToggle />
      </div>
      <div className="login-card">
        <h1>Goodies Admin</h1>
        {step === 'password' ? (
          <>
            <p>Sign in with your admin credentials.</p>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="input-wrap">
                <label htmlFor="email">Email*</label>
                <input
                  id="email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="input-wrap">
                <label htmlFor="password">Password*</label>
                <div className="password-input-wrap">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="input password-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.92-2.17 2.36-4.08 4.17-5.54" />
                        <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.89 11 8a10.91 10.91 0 0 1-2.16 3.19" />
                        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="login-form-meta">
                  <Link to="/forgot-password" className="login-forgot-link">
                    Forgot password?
                  </Link>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p>Two-factor authentication</p>
            {error && <div className="alert alert-error">{error}</div>}
            {info && <div className="alert alert-success">{info}</div>}
            <form onSubmit={handleVerify}>
              <div className="input-wrap">
                <label htmlFor="login-code-0">Verification code</label>
                <div className="login-code">
                  {digits.map((digit, index) => (
                    <input
                      key={index}
                      id={index === 0 ? 'login-code-0' : undefined}
                      ref={(node) => { inputs.current[index] = node }}
                      className="input login-code__digit"
                      inputMode="numeric"
                      autoComplete={index === 0 ? 'one-time-code' : 'off'}
                      maxLength={index === 0 ? CODE_LENGTH : 1}
                      value={digit}
                      aria-label={`Digit ${index + 1}`}
                      onChange={(event) => updateDigit(index, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Backspace' && !digits[index] && index > 0) {
                          inputs.current[index - 1]?.focus()
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify and sign in'}
              </button>
            </form>
            <div className="login-code-actions">
              <button type="button" className="login-forgot-link" onClick={handleResend} disabled={resending || loading}>
                {resending ? 'Sending...' : 'Resend code'}
              </button>
              <button
                type="button"
                className="login-forgot-link"
                onClick={() => {
                  setStep('password')
                  setError('')
                  setInfo('')
                  setDigits(Array(CODE_LENGTH).fill(''))
                }}
              >
                Use a different account
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
