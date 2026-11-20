import { createContext } from 'react'

export type SimulationStatus = 'Idle' | 'Running' | 'Paused' | 'Stopped'

type SimulationContextValue = {
  status: SimulationStatus
  setStatus: (status: SimulationStatus) => void
}

export const SimulationContext = createContext<SimulationContextValue | undefined>(undefined)
