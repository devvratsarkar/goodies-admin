import { createContext, useContext, useCallback, useState, useEffect, type ReactNode } from 'react'
import { authApi } from '../api/endpoints'
import type { AdminAccess, AdminProfile } from '../types/api'

const TOKEN_KEY = 'admin_token'

function roleName(role: unknown): string | undefined {
  if (typeof role === 'string') {
    const text = role.trim()
    return text && text !== '[object Object]' ? text : undefined
  }
  if (role && typeof role === 'object') {
    const record = role as Record<string, unknown>
    const name = record.name ?? record.role_name ?? record.title
    if (typeof name === 'string' && name.trim()) return name.trim()
  }
  return undefined
}

interface AuthContextValue {
  profile: AdminProfile | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ twoFactor: boolean }>
  verifyLogin: (email: string, code: string) => Promise<void>
  logout: () => void
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AdminProfile | null>(null)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [loading, setLoading] = useState(true)

  const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null

  const refreshProfile = useCallback(async () => {
    if (!token) {
      setProfile(null)
      setLoading(false)
      return
    }
    if (token.startsWith('local:')) {
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
      setProfile(null)
      setLoading(false)
      return
    }
    try {
      const res = await authApi.getProfile()
      const raw: unknown = res.data
      const container = isRecord(raw) ? raw : null
      const candidate: unknown =
        container?.data ?? container?.admin ?? container?.user ?? raw

      const payload = isRecord(candidate) ? candidate : null
      const hasIdentity = payload && (payload.email != null || payload._id != null)

      const normalized: AdminProfile | null = hasIdentity
        ? {
            _id: String(payload?._id ?? ''),
            email: String(payload?.email ?? ''),
            name: payload?.name != null ? String(payload.name) : undefined,
            last_name: payload?.last_name != null ? String(payload.last_name) : undefined,
            phone_number: payload?.phone_number != null ? String(payload.phone_number) : undefined,
            country: payload?.country != null ? String(payload.country) : undefined,
            createdAt: payload?.createdAt != null ? String(payload.createdAt) : undefined,
            profile_pic:
              payload?.profile_pic != null
                ? String(payload.profile_pic)
                : payload?.profilePic != null
                  ? String(payload.profilePic)
                  : payload?.avatar != null
                    ? String(payload.avatar)
                    : undefined,
            role: roleName(payload?.role),
            access: isRecord(payload?.access) ? (payload.access as unknown as AdminAccess) : undefined,
          }
        : null

      setProfile(normalized)
    } catch {
      setToken(null)
      localStorage.removeItem(TOKEN_KEY)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    refreshProfile()
  }, [refreshProfile])

  const storeSession = useCallback(async (raw: unknown) => {
    const data = raw as { token?: string; data?: { token?: string; accessToken?: string } }
    const t = data?.token ?? data?.data?.token ?? data?.data?.accessToken
    if (!t) throw new Error('No token received')
    localStorage.setItem(TOKEN_KEY, t)
    setToken(t)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login({ email, password })
    const body = res.data as { two_factor?: boolean; data?: { two_factor?: boolean; token?: string } }
    const twoFactor = body?.data?.two_factor ?? body?.two_factor
    if (twoFactor === false) {
      await storeSession(res.data)
      return { twoFactor: false }
    }
    if (!twoFactor) throw new Error('Verification code was not sent')
    return { twoFactor: true }
  }, [storeSession])

  const verifyLogin = useCallback(async (email: string, code: string) => {
    const res = await authApi.verifyLogin({ email, code })
    await storeSession(res.data)
  }, [storeSession])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setProfile(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        profile,
        token,
        loading,
        login,
        verifyLogin,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
