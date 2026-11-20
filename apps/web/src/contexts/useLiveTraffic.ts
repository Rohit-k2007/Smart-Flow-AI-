import { useCallback, useEffect, useState } from 'react'
import type { TrafficIntersection, TrafficLiveResponse } from '../types/api'
import { api } from '../services/api'

export function useLiveTraffic() {
  const [data, setData] = useState<TrafficLiveResponse | null>(null)
  const [intersections, setIntersections] = useState<TrafficIntersection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [intersectionError, setIntersectionError] = useState<string | null>(null)

  const loadData = useCallback(() => Promise.all([
    api.liveTraffic(),
    api.intersections(),
  ]), [])

  const applyResults = useCallback(([liveResult, intersectionResult]: Awaited<ReturnType<typeof loadData>>) => {
    if (liveResult.ok) {
      setData(liveResult.data)
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

  return { data, intersections, loading, error, intersectionError, refresh }
}
