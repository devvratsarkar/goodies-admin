import axios from 'axios'

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://goodies.plan-it.pro/api/admin/'
/** Base URL for static assets (profile pics, etc.). Falls back to apiBaseUrl if not set. */
export const assetsBaseUrl =
  (import.meta.env.VITE_ASSETS_BASE_URL || '').replace(/\/$/, '') || apiBaseUrl.replace(/\/$/, '')

export const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (config.data instanceof FormData && config.headers) {
    // Let browser/axios set multipart boundary automatically.
    delete config.headers['Content-Type']
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginRequest = err.config?.url?.includes('/login')
    if (err.response?.status === 401 && !isLoginRequest) {
      localStorage.removeItem('admin_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

/** Use for profile_pic from API: full URLs used as-is; relative paths get assetsBaseUrl (or apiBaseUrl) prepended. */
export function getProfileImageUrl(url: string | undefined | null): string | undefined {
  if (!url || typeof url !== 'string') return undefined
  const trimmed = url.trim()
  // Some responses contain malformed prefix like "undefinedpublic\\user\\...".
  const cleaned = trimmed
    .replace(/^undefined/i, '')
    .replace(/\\/g, '/')
    .replace(/^public\//i, '/public/')
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  // Some APIs return "domain.com/path.jpg" (missing protocol). Treat it as https.
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(cleaned)) return `https://${cleaned}`
  // Some APIs return protocol-relative URLs like "//domain.com/path.jpg".
  if (cleaned.startsWith('//')) return `https:${cleaned}`
  const path = cleaned.startsWith('/') ? cleaned : `/${cleaned}`
  return `${assetsBaseUrl}${path}`
}

/** Returns URL candidates for avatar loading (direct first, then API-host fallback). */
export function getProfileImageCandidates(url: string | undefined | null): string[] {
  const resolved = getProfileImageUrl(url)
  if (!resolved) return []

  const out = new Set<string>([resolved])
  try {
    const resolvedUrl = new URL(resolved)
    const apiUrl = new URL(apiBaseUrl)
    if (resolvedUrl.origin !== apiUrl.origin) {
      // Fallback: same path on API host can work if CDN/hotlink blocks browser origin.
      out.add(`${apiUrl.origin}${resolvedUrl.pathname}${resolvedUrl.search}`)
    }
  } catch {
    // ignore malformed URL edge cases
  }
  return Array.from(out)
}
