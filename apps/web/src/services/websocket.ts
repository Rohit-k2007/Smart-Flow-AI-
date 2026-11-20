import { API_URL } from '../utils/constants'

export function createSimulationSocket(runId: string) {
  const wsUrl = new URL(`/ws/simulation/${encodeURIComponent(runId)}`, API_URL)
  wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:'
  return new WebSocket(wsUrl.toString())
}
