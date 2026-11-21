import { useCallback, useEffect, useState } from 'react'
import type { HereIntegrationStatus, TrafficIntersection, TrafficLiveResponse } from '../types/api'
import { api } from '../services/api'

export function useLiveTraffic() {
  const [data, setData] = useState<TrafficLiveResponse | null>(null)
  const [hereStatus, setHereStatus] = useState<HereIntegrationStatus | null>(null)
  const [hereNotConfigured, setHereNotConfigured] = useState(false)
  const [intersections, setIntersections] = useState<TrafficIntersection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [intersectionError, setIntersectionError] = useState<string | null>(null)
  const [lastSuccessfulUpdateAt, setLastSuccessfulUpdateAt] = useState<string | null>(null)

  const loadData = useCallback(() => Promise.all([
    api.liveTraffic(),
    api.intersections(),
    api.hereStatus(),
  ]), [])

  const applyResults = useCallback(([liveResult, intersectionResult, hereStatusResult]: Awaited<ReturnType<typeof loadData>>) => {
    const missingHereKey = !liveResult.ok && (
      (hereStatusResult.ok && hereStatusResult.data.status === 'NOT_CONFIGURED')
      || (
        liveResult.error.status === 503
        && liveResult.error.message.includes('HERE_API_KEY is not configured')
      )
    )
    setHereStatus(hereStatusResult.ok ? hereStatusResult.data : null)
    setHereNotConfigured(missingHereKey)

    if (liveResult.ok) {
      setData(liveResult.data)
      setError(null)
      if (liveResult.data.available) {
        setLastSuccessfulUpdateAt(new Date().toISOString())
      }
    } else if (missingHereKey) {
      setData(null)
      setError(null)
    } else {
      setData(null)
      setError(liveResult.error.message)
    }
    if (intersectionResult.ok) {
      setIntersections(intersectionResult.data.items)
      setIntersectionError(null)
    } else {
      setIntersections([])
      setIntersectionError(intersectionResult.error.message)
    }
    setLoading(false)
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    applyResults(await loadData())
  }, [applyResults, loadData])

  useEffect(() => {
    let active = true
    void loadData().then((results) => {
      if (active) applyResults(results)
    })
    return () => { active = false }
  }, [applyResults, loadData])

  return {
    data,
    hereStatus,
    hereNotConfigured,
    intersections,
    loading,
    error,
    intersectionError,
    lastSuccessfulUpdateAt,
    refresh,
  }
}
