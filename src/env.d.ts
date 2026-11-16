/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  /** Base URL for static assets (e.g. profile images). Use when images are on a different host than the API. */
  readonly VITE_ASSETS_BASE_URL?: string
  readonly VITE_STORE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
