import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { getApiVersion } from '@/services/apiPrefix'

const V2_PREFIX = '/v2'

export const isV2Mode = () => getApiVersion() === 'v2'

export const mapPathByApiVersion = (path: string) => {
  const wantV2 = isV2Mode()
  const hasV2 = path.startsWith(V2_PREFIX)

  if (wantV2 && !hasV2) return `${V2_PREFIX}${path}`
  if (!wantV2 && hasV2) return path.replace(V2_PREFIX, '') || '/'
  return path
}

export const mapRouteByApiVersion = (route: RouteLocationNormalizedLoaded) => {
  const wantV2 = isV2Mode()
  const hasV2 = route.path.startsWith(V2_PREFIX)

  if (wantV2 && !hasV2) route.path = `${V2_PREFIX}${route.path}`
  if (!wantV2 && hasV2) route.path = route.path.replace(V2_PREFIX, '') || '/'
  return route
}
