// src/services/apiVersion.ts

export type ApiVersion = 'v1' | 'v2'

const STORAGE_KEY = 'USE_API_V2'

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

export function getApiVersionFromUrl(): ApiVersion | null {
  try {
    const url = new URL(window.location.href)
    const api = (url.searchParams.get('api') || '').toLowerCase()
    if (api === 'v2') return 'v2'
    if (api === 'v1') return 'v1'
    return null
  } catch {
    return null
  }
}

export function getApiVersionFromStorage(): ApiVersion | null {
  const v = safeGetItem(STORAGE_KEY)
  if (v === 'true') return 'v2'
  if (v === 'false') return 'v1'
  return null
}

export function setApiVersion(version: ApiVersion): void {
  safeSetItem(STORAGE_KEY, version === 'v2' ? 'true' : 'false')
}

export function getApiVersion(defaultVersion: ApiVersion = 'v1'): ApiVersion {
  // Priority: URL -> storage -> default
  const urlV = getApiVersionFromUrl()
  if (urlV) return urlV

  const stored = getApiVersionFromStorage()
  if (stored) return stored

  return defaultVersion
}

export function toggleApiVersion(): ApiVersion {
  const next: ApiVersion = getApiVersion() === 'v2' ? 'v1' : 'v2'
  setApiVersion(next)
  return next
}
