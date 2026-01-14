export type ApiVersion = 'v1' | 'v2'

const API_VERSION_KEY = 'api_version'

export const getApiVersion = (): ApiVersion => {
  const v = localStorage.getItem(API_VERSION_KEY)
  return v === 'v2' ? 'v2' : 'v1'
}

export const setApiVersion = (v: ApiVersion) => {
  localStorage.setItem(API_VERSION_KEY, v)
}

export const getApiPrefix = () => {
  const apiVersion = localStorage.getItem('api_version') // "v2"
  const useApiV2 = localStorage.getItem('USE_API_V2')    // "true"

  console.log('🔥🔥🔥 getApiPrefix loaded from apiPrefix.ts')
  console.log('[getApiPrefix]', { apiVersion, useApiV2 })
  

  const isV2 =
    apiVersion === 'v2' ||
    useApiV2 === 'true' ||
    useApiV2 === '1'

  return isV2 ? '/api/v2' : '/api/v1'
}
