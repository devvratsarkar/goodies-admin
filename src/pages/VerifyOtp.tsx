import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { authApi } from '../api/endpoints'
import { ThemeToggle } from '../components/ThemeToggle'

export function VerifyOtp() {
  const location = useLocation()
  const navigate = useNavigate()
  const email = ((location.state as { email?: string } | null)?.email || '').trim()
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const otpFor = useMemo(() => 'forgot' as const, [])

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!email) {
      setError('Email is missing. Please start again from forgot password.')
      return
    }
    if (!/^\d{4}$/.test(otp.trim())) {
      setError('Please enter a valid 4-digit OTP.')
      return
    }
    setLoading(true)
    try {
      const res = await authApi.verifyOtp({
        email,
        code: otp.trim(),
        type: otpFor,
      })
      const payload = res.data as {
        token?: string
        data?: string | { token?: string; accessToken?: string; jwt?: string }
      }
      const verifyToken =
        payload?.token
        || (typeof payload?.data === 'string' ? payload.data : undefined)
        || (typeof payload?.data === 'object' ? payload.data?.token : undefined)
        || (typeof payload?.data === 'object' ? payload.data?.accessToken : undefined)
        || (typeof payload?.data === 'object' ? payload.data?.jwt : undefined)
      if (!verifyToken) throw new Error('Verification token not found in response')
      setSuccess('OTP verified. Set your new password.')
      navigate('/reset-password', {
        state: { email, resetToken: verifyToken },
      })
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err.response as { data?: { message?: string } })?.data?.message
          : null
      setError(msg || (err instanceof Error ? err.message : 'OTP verification failed'))
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (!email) {
      setError('Email is missing. Please start again from forgot password.')
      return
    }
    setError('')
    setSuccess('')
    setResending(true)
    try {
      await authApi.forgotPassword({ email })
      setSuccess('OTP resent to your email.')
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err.response as { data?: { message?: string } })?.data?.message
          : null
      setError(msg || (err instanceof Error ? err.message : 'Failed to resend OTP'))
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
        <h1>Verify OTP</h1>
        <p>Enter the 4-digit OTP sent to your email to verify your account.</p>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <form onSubmit={handleVerify}>
          <div className="input-wrap">
            <label htmlFor="otp">OTP*</label>
            <input
              id="otp"
              type="text"
              className="input"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Enter 4 digit OTP"
              required
              maxLength={4}
              pattern="\d{4}"
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </form>
        <div className="auth-page-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleResend} disabled={resending}>
            {resending ? 'Resending...' : 'Resend OTP'}
          </button>
        </div>
        <p className="auth-page-footer auth-page-footer-bottom-center">
          Back to <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  )
}
