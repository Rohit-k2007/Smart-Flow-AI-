import { createContext } from 'react'
import type { User } from '@supabase/supabase-js'

export type MfaChallenge = { factorId: string; challengeId: string }
export type MfaStatus = 'guest' | 'checking' | 'not-enabled' | 'required' | 'verified' | 'unavailable'
export type AuthResult = { error?: string; notice?: string; mfaChallenge?: MfaChallenge }

export type AuthContextValue = {
  configured: boolean
  loading: boolean
  user: User | null
  mfaStatus: MfaStatus
  signIn: (email: string, password: string) => Promise<AuthResult>
  beginMfaChallenge: () => Promise<AuthResult>
  verifyMfa: (factorId: string, challengeId: string, code: string) => Promise<AuthResult>
  signUp: (email: string, password: string, name: string) => Promise<AuthResult>
  resetPassword: (email: string) => Promise<AuthResult>
  signOut: () => Promise<AuthResult>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
