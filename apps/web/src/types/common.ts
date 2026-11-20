export type ApiError = {
  status?: number
  code: 'TIMEOUT' | 'NETWORK' | 'INVALID_RESPONSE' | 'HTTP_ERROR'
  message: string
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError }

export type Status = 'active' | 'paused' | 'stopped' | 'completed'
export type CongestionLevel = 'low' | 'medium' | 'high' | 'critical'
