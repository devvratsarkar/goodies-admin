import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi } from '../api/endpoints'
import { ThemeToggle } from '../components/ThemeToggle'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const res = await authApi.forgotPassword({ email })
      const msg =
        (res.data as { message?: string; data?: { message?: string } })?.message
        || (res.data as { message?: string; data?: { message?: string } })?.data?.message
        || 'OTP sent to your email.'
      setSuccess(msg)
      navigate('/verify-otp', { state: { email } })
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err.response as { data?: { message?: string } })?.data?.message
          : null
      setError(msg || (err instanceof Error ? err.message : 'Failed to send OTP'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-theme-toggle">
        <ThemeToggle />
      </div>
      <div className="login-card">
        <h1>Forgot Password</h1>
        <p>Enter your email and we will send you an OTP code.</p>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
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
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Sending OTP...' : 'Send OTP'}
          </button>
        </form>
        <p className="auth-page-footer auth-page-footer-bottom-center">
          Back to <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  )
}
