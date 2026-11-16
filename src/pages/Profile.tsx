import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { authApi, globalSettingsApi } from '../api/endpoints'
import { getProfileImageCandidates, getProfileImageUrl } from '../api/client'
import { ImageSourceField, imageFieldValue } from '../components/media/ImageSourceField'
import { User, Save, Key, Eye, EyeOff } from 'lucide-react'
import { passwordRuleError } from '../utils/password'

const countryOptions = (() => {
  const displayNames = typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null
  const codes = [
    'AF', 'AL', 'DZ', 'AD', 'AO', 'AG', 'AR', 'AM', 'AU', 'AT', 'AZ',
    'BS', 'BH', 'BD', 'BB', 'BY', 'BE', 'BZ', 'BJ', 'BT', 'BO', 'BA', 'BW', 'BR', 'BN', 'BG', 'BF', 'BI',
    'CV', 'KH', 'CM', 'CA', 'CF', 'TD', 'CL', 'CN', 'CO', 'KM', 'CG', 'CD', 'CR', 'CI', 'HR', 'CU', 'CY', 'CZ',
    'DK', 'DJ', 'DM', 'DO', 'EC', 'EG', 'SV', 'GQ', 'ER', 'EE', 'SZ', 'ET',
    'FJ', 'FI', 'FR', 'GA', 'GM', 'GE', 'DE', 'GH', 'GR', 'GD', 'GT', 'GN', 'GW', 'GY',
    'HT', 'HN', 'HU', 'IS', 'IN', 'ID', 'IR', 'IQ', 'IE', 'IL', 'IT',
    'JM', 'JP', 'JO', 'KZ', 'KE', 'KI', 'KP', 'KR', 'KW', 'KG',
    'LA', 'LV', 'LB', 'LS', 'LR', 'LY', 'LI', 'LT', 'LU',
    'MG', 'MW', 'MY', 'MV', 'ML', 'MT', 'MH', 'MR', 'MU', 'MX', 'FM', 'MD', 'MC', 'MN', 'ME', 'MA', 'MZ', 'MM',
    'NA', 'NR', 'NP', 'NL', 'NZ', 'NI', 'NE', 'NG', 'MK', 'NO', 'OM',
    'PK', 'PW', 'PA', 'PG', 'PY', 'PE', 'PH', 'PL', 'PT', 'QA',
    'RO', 'RU', 'RW', 'KN', 'LC', 'VC', 'WS', 'SM', 'ST', 'SA', 'SN', 'RS', 'SC', 'SL', 'SG', 'SK', 'SI', 'SB', 'SO', 'ZA', 'SS', 'ES', 'LK', 'SD', 'SR', 'SE', 'CH', 'SY',
    'TW', 'TJ', 'TZ', 'TH', 'TL', 'TG', 'TO', 'TT', 'TN', 'TR', 'TM', 'TV',
    'UG', 'UA', 'AE', 'GB', 'US', 'UY', 'UZ', 'VU', 'VA', 'VE', 'VN', 'YE', 'ZM', 'ZW',
  ]
  return codes
    .map((code) => displayNames?.of(code) || code)
    .filter((name, index, list) => list.indexOf(name) === index)
    .sort((a, b) => a.localeCompare(b))
})()

const countryLabel = (value?: string | null) => {
  const raw = (value || '').trim()
  if (!raw) return ''
  if (countryOptions.includes(raw)) return raw
  if (/^[A-Za-z]{2}$/.test(raw) && typeof Intl.DisplayNames === 'function') {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(raw.toUpperCase()) || raw
  }
  return raw
}

const formatJoined = (value?: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function Profile() {
  const { profile, refreshProfile } = useAuth()
  const [name, setname] = useState(profile?.name ?? '')
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number ?? '')
  const [country, setCountry] = useState(profile?.country ?? '')
  const [last_name, setLast_name] = useState(profile?.last_name ?? '')
  const [profile_pic, setprofile_pic] = useState<File | null>(null)
  const [profileImageUrl, setProfileImageUrl] = useState('')
  const [imgFailed, setImgFailed] = useState(false)
  const [avatarIndex, setAvatarIndex] = useState(0)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'profile' | 'password'>('profile')
  const [old_password, setOld_password] = useState('')
  const [new_password, setNew_password] = useState('')
  const [confirm_password, setConfirm_password] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true)
  const [twoFactorReady, setTwoFactorReady] = useState(false)

  useEffect(() => {
    globalSettingsApi
      .get()
      .then((res) => {
        const body = res.data as { data?: { enable_two_factor_authentication?: boolean }; enable_two_factor_authentication?: boolean } | undefined
        const settings = body?.data && typeof body.data === 'object' ? body.data : body
        setTwoFactorEnabled(settings?.enable_two_factor_authentication !== false)
        setTwoFactorReady(true)
      })
      .catch(() => setTwoFactorReady(false))
  }, [])

  useEffect(() => {
    setname(profile?.name ?? '')
    setPhoneNumber(profile?.phone_number ?? '')
    setCountry(countryLabel(profile?.country))
    setLast_name(profile?.last_name ?? '')
  }, [profile])

  useEffect(() => {
    setImgFailed(false)
    setAvatarIndex(0)
  }, [profile?.profile_pic])

  const avatarCandidates = getProfileImageCandidates(profile?.profile_pic)
  const profileImgUrl = avatarCandidates[avatarIndex]

  const profileInitials =
    profile?.name || profile?.last_name
      ? [profile.name, profile.last_name].filter(Boolean).map((n) => n!.charAt(0).toUpperCase()).join('')
      : profile?.email
        ? profile.email.charAt(0).toUpperCase()
        : 'A'

  const pendingPreview = useMemo(() => (profile_pic ? URL.createObjectURL(profile_pic) : ''), [profile_pic])
  useEffect(() => {
    if (!pendingPreview) return
    return () => URL.revokeObjectURL(pendingPreview)
  }, [pendingPreview])

  const displaySrc =
    pendingPreview ||
    (profileImageUrl.trim() ? getProfileImageUrl(profileImageUrl) : '') ||
    (!imgFailed ? profileImgUrl : '')

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setMessageType('success')
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('name', name)
      fd.append('phone_number', phoneNumber.trim())
      fd.append('country', country.trim())
      fd.append('last_name', last_name)
      if (profile_pic) fd.append('profile_pic', profile_pic)
      else if (profileImageUrl.trim()) fd.append('profile_pic', imageFieldValue(profileImageUrl))
      await authApi.updateProfile(fd)
      if (twoFactorReady) {
        await globalSettingsApi.update({ enable_two_factor_authentication: twoFactorEnabled })
      }
      await refreshProfile()
      setMessage('Profile updated.')
      setMessageType('success')
      setprofile_pic(null)
      setProfileImageUrl('')
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err.response as { data?: { message?: string } })?.data?.message
          : null
      setMessageType('error')
      setMessage(msg || 'Update failed.')
    } finally {
      setLoading(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setMessageType('success')
    const ruleError = passwordRuleError(new_password)
    if (ruleError) {
      setMessageType('error')
      setMessage(ruleError)
      return
    }
    if (new_password !== confirm_password) {
      setMessageType('error')
      setMessage('Confirm password does not match.')
      return
    }
    setLoading(true)
    try {
      await authApi.changePassword({ old_password: old_password, new_password: new_password })
      setMessage('Password changed.')
      setMessageType('success')
      setOld_password('')
      setNew_password('')
      setConfirm_password('')
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err.response as { data?: { message?: string } })?.data?.message
          : null
      setMessageType('error')
      setMessage(msg || 'Change password failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="profile-page">
      <h1 className="page-title">Profile</h1>
      <p className="page-subtitle">Manage your account.</p>

      <div className="card profile-card">
        <div className="profile-tabs" role="tablist">
          <button
            type="button"
            className={`profile-tab${tab === 'profile' ? ' is-active' : ''}`}
            role="tab"
            aria-selected={tab === 'profile'}
            onClick={() => setTab('profile')}
          >
            <User size={16} /> Profile
          </button>
          <button
            type="button"
            className={`profile-tab${tab === 'password' ? ' is-active' : ''}`}
            role="tab"
            aria-selected={tab === 'password'}
            onClick={() => setTab('password')}
          >
            <Key size={16} /> Change password
          </button>
        </div>
        <div className="profile-card-body">
          {message && (
            <div className={`${messageType === 'error' ? 'alert alert-error' : 'alert alert-success'} profile-alert`}>
              {message}
            </div>
          )}
          {tab === 'profile' && (
            <form onSubmit={handleUpdateProfile}>
              <div className={`profile-photo${profile_pic || profileImageUrl.trim() ? ' profile-photo--pending' : ''}`}>
                {displaySrc ? (
                  <img
                    src={displaySrc}
                    alt=""
                    className="profile-avatar"
                    onError={() => {
                      if (!profile_pic && !profileImageUrl.trim() && avatarIndex + 1 < avatarCandidates.length) {
                        setAvatarIndex((i) => i + 1)
                      } else {
                        setImgFailed(true)
                      }
                    }}
                  />
                ) : (
                  <span className="profile-avatar profile-avatar-fallback">{profileInitials}</span>
                )}
                <ImageSourceField
                  label="Profile image"
                  hint="This photo is shown next to your name."
                  file={profile_pic}
                  url={profileImageUrl}
                  existing={profile?.profile_pic ?? ''}
                  onFileChange={setprofile_pic}
                  onUrlChange={setProfileImageUrl}
                />
              </div>
              <div className="profile-fields">
                <div className="input-wrap profile-field">
                  <label>Email</label>
                  <input type="text" className="input" value={profile?.email ?? ''} disabled />
                </div>
                <div className="input-wrap profile-field">
                  <label>Full name</label>
                  <input
                    type="text"
                    className="input"
                    value={name}
                    onChange={(e) => setname(e.target.value)}
                    placeholder="Name"
                  />
                </div>
                <div className="input-wrap profile-field">
                  <label>Phone number</label>
                  <input
                    type="tel"
                    className="input"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Phone number"
                  />
                </div>
                <div className="input-wrap profile-field">
                  <label htmlFor="profile-country">Country</label>
                  <select
                    id="profile-country"
                    className="select"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  >
                    <option value="">Select country</option>
                    {country && !countryOptions.includes(country) ? (
                      <option value={country}>{country}</option>
                    ) : null}
                    {countryOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-wrap profile-field">
                  <label>Role</label>
                  <input type="text" className="input" value={profile?.role ? String(profile.role) : ''} disabled />
                </div>
                <div className="input-wrap profile-field">
                  <label>Joined</label>
                  <input type="text" className="input" value={formatJoined(profile?.createdAt)} disabled />
                </div>
              </div>
              <div className="payment-gateway-row profile-security">
                <div>
                  <p className="payment-gateway-row__name">Two-factor authentication</p>
                  <p className="payment-gateway-row__note">
                    When this is on, admin sign-in emails a code before the session starts.
                  </p>
                </div>
                <label className="toggle-switch" htmlFor="enable_two_factor_authentication">
                  <input
                    id="enable_two_factor_authentication"
                    type="checkbox"
                    checked={twoFactorEnabled}
                    disabled={loading || !twoFactorReady}
                    aria-label={`${twoFactorEnabled ? 'Turn off' : 'Turn on'} two-factor authentication`}
                    onChange={(event) => setTwoFactorEnabled(event.target.checked)}
                  />
                  <span className="toggle-switch-track" aria-hidden>
                    <span className="toggle-switch-thumb" />
                  </span>
                </label>
              </div>
              <div className="profile-actions">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  <Save size={18} /> {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          )}
          {tab === 'password' && (
            <form onSubmit={handleChangePassword}>
              <div className="input-wrap profile-field">
                <label>Current password*</label>
                <div className="password-input-wrap">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    className="input password-input"
                    value={old_password}
                    onChange={(e) => setOld_password(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                    title={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                  >
                    {showCurrentPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              </div>
              <div className="input-wrap profile-field">
                <label>New password*</label>
                <div className="password-input-wrap">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    className="input password-input"
                    value={new_password}
                    onChange={(e) => setNew_password(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                    title={showNewPassword ? 'Hide new password' : 'Show new password'}
                  >
                    {showNewPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              </div>
              <div className="input-wrap profile-field">
                <label>Confirm new password*</label>
                <div className="password-input-wrap">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="input password-input"
                    value={confirm_password}
                    onChange={(e) => setConfirm_password(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    title={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showConfirmPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              </div>
              <div className="profile-actions">
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  <Key size={18} /> {loading ? 'Updating...' : 'Change password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
