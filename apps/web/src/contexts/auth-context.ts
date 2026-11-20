import { createContext } from 'react'
import type { User } from '@supabase/supabase-js'

export type AuthResult = { error?: string; notice?: string }

export type AuthContextValue = {
  configured: boolean
  loading: boolean
  user: User | null
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, password: string, name: string) => Promise<AuthResult>
  resetPassword: (email: string) => Promise<AuthResult>
  signOut: () => Promise<AuthResult>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
