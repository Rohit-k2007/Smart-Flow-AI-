import { useState, type ReactNode } from 'react'
import { SimulationContext, type SimulationStatus } from './simulation-context'

export function SimulationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SimulationStatus>('Idle')
  return <SimulationContext.Provider value={{ status, setStatus }}>{children}</SimulationContext.Provider>
}
