import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { authApi } from '../api/endpoints'
import { ThemeToggle } from '../components/ThemeToggle'
import { passwordRuleError } from '../utils/password'

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.92-2.17 2.36-4.08 4.17-5.54" />
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.89 11 8a10.91 10.91 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

export function ResetPassword() {
  const location = useLocation()
  const navigate = useNavigate()
  const resetToken = (location.state as { resetToken?: string } | null)?.resetToken || ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const passwordError = password ? passwordRuleError(password) : ''

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!resetToken) {
      setError('Session expired. Please verify OTP again.')
      return
    }
    if (passwordError) {
      setError(passwordError)
      return
    }
    if (password !== confirmPassword) {
      setError('Password and confirm password must match.')
      return
    }
    setLoading(true)
    try {
      const res = await authApi.resetPassword(
        {
          password,
          confirm_password: confirmPassword,
        },
        resetToken,
      )
      const msg =
        (res.data as { message?: string; data?: { message?: string } })?.message
        || (res.data as { message?: string; data?: { message?: string } })?.data?.message
        || 'Password updated successfully.'
      setSuccess(msg)
      navigate('/login')
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err.response as { data?: { message?: string } })?.data?.message
          : null
      setError(msg || (err instanceof Error ? err.message : 'Failed to reset password'))
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
        <h1>Set New Password</h1>
        <p>Create your new password to complete account recovery. Use at least 8 characters, with uppercase, lowercase, a number, and a special character.</p>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <form onSubmit={handleSubmit}>
          <div className="input-wrap">
            <label htmlFor="new-password">New Password*</label>
            <div className="password-input-wrap">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                className="input password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter new password"
                required
                autoComplete="new-password"
                aria-invalid={Boolean(passwordError)}
                aria-describedby={passwordError ? 'new-password-error' : undefined}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeIcon /> : <EyeOffIcon />}
              </button>
            </div>
            {passwordError && <p id="new-password-error" className="form-field-error">{passwordError}</p>}
          </div>
          <div className="input-wrap">
            <label htmlFor="confirm-password">Confirm Password*</label>
            <div className="password-input-wrap">
              <input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                className="input password-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                title={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeIcon /> : <EyeOffIcon />}
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
        <p className="auth-page-footer auth-page-footer-bottom-center">
          Back to <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  )
}
