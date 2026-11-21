import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) console.error('Unable to restore the Supabase session.', error.message)
      setSession(data.session)
      setLoading(false)
    }).catch(() => {
      if (!active) return
      setSession(null)
      setLoading(false)
      console.warn('The optional account session is unavailable; public prototype access remains enabled.')
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    configured: Boolean(supabase),
    loading,
    user: session?.user ?? null,
    signIn: async (email, password) => {
      if (!supabase) return { error: 'Supabase Auth is not configured for this deployment.' }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return error ? { error: error.message } : {}
    },
    signUp: async (email, password, name) => {
      if (!supabase) return { error: 'Supabase Auth is not configured for this deployment.' }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      })
      if (error) return { error: error.message }
      return data.session ? {} : { notice: 'Check your email to confirm your account before signing in.' }
    },
    resetPassword: async (email) => {
      if (!supabase) return { error: 'Supabase Auth is not configured for this deployment.' }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      })
      return error ? { error: error.message } : { notice: 'If an account exists for that email, a reset link has been sent.' }
    },
    signOut: async () => {
      if (!supabase) return { error: 'Supabase Auth is not configured for this deployment.' }
      const { error } = await supabase.auth.signOut()
      return error ? { error: error.message } : {}
    },
  }), [loading, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
