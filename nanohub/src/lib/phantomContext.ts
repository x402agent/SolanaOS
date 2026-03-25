/**
 * Provides phantom wallet state through a context that is safe to read
 * from any component — even outside PhantomProvider (returns disconnected).
 */
import { createContext, useContext } from 'react'

export interface PhantomState {
  isConnected: boolean
  address: string | null
}

const defaultState: PhantomState = { isConnected: false, address: null }

export const PhantomStateContext = createContext<PhantomState>(defaultState)

export function usePhantomState(): PhantomState {
  return useContext(PhantomStateContext)
}
