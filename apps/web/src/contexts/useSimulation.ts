import { useContext } from 'react'
import { SimulationContext } from './simulation-context'

export function useSimulation() {
  const context = useContext(SimulationContext)
  if (!context) throw new Error('useSimulation must be used within SimulationProvider')
  return context
}
