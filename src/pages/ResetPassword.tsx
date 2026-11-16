import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { authApi } from '../api/endpoints'
import { ThemeToggle } from '../components/ThemeToggle'

export function ResetPassword() {
  const location = useLocation()
  const navigate = useNavigate()
  const resetToken = (location.state as { resetToken?: string } | null)?.resetToken || ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    if (!resetToken) {
      setError('Session expired. Please verify OTP again.')
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
        <p>Create your new password to complete account recovery.</p>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <form onSubmit={handleSubmit}>
          <div className="input-wrap">
            <label htmlFor="new-password">New Password*</label>
            <input
              id="new-password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              required
              autoComplete="new-password"
            />
          </div>
          <div className="input-wrap">
            <label htmlFor="confirm-password">Confirm Password*</label>
            <input
              id="confirm-password"
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              autoComplete="new-password"
            />
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
