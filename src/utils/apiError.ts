import axios from 'axios'

/**
 * Extracts a human-readable error message from an Axios/fetch error.
 * Falls back to the provided default if no message is available.
 *
 * Backend responses look like:
 *   { http_status_code: 400, success: false, message: 'Some message', data: {} }
 */
export function getApiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (!err) return fallback

  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | {
          message?: unknown
          error?: unknown
          errors?: unknown
        }
      | undefined

    const candidates: unknown[] = [
      data?.message,
      data?.error,
      Array.isArray(data?.errors)
        ? (data?.errors as unknown[]).map((entry) =>
            typeof entry === 'string'
              ? entry
              : (entry as { message?: string })?.message,
          )
        : undefined,
    ]

    for (const value of candidates) {
      if (typeof value === 'string' && value.trim()) return value.trim()
      if (Array.isArray(value)) {
        const joined = value
          .filter((v): v is string => typeof v === 'string' && Boolean(v.trim()))
          .join(', ')
        if (joined.trim()) return joined.trim()
      }
    }

    if (typeof err.message === 'string' && err.message.trim()) return err.message
  }

  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err.trim()) return err

  return fallback
}
