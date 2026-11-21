import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'
import { AuthContext, type AuthContextValue, type MfaStatus } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [mfaStatus, setMfaStatus] = useState<MfaStatus>(supabase ? 'checking' : 'guest')

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
      setMfaStatus('guest')
      setLoading(false)
      console.warn('The optional account session is unavailable; public prototype access remains enabled.')
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setMfaStatus(nextSession ? 'checking' : 'guest')
      setLoading(false)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!supabase || !session) {
      setMfaStatus('guest')
      return
    }

    let active = true
    setMfaStatus('checking')
    void supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setMfaStatus('unavailable')
          return
        }
        if (data.currentLevel === 'aal2') setMfaStatus('verified')
        else if (data.nextLevel === 'aal2') setMfaStatus('required')
        else setMfaStatus('not-enabled')
      })
      .catch(() => {
        if (active) setMfaStatus('unavailable')
      })
    return () => { active = false }
  }, [session])

  const value = useMemo<AuthContextValue>(() => {
    const beginMfaChallenge = async () => {
      if (!supabase) return { error: 'Supabase Auth is not configured for this deployment.' }
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()
      if (factorsError) return { error: factorsError.message }
      const factor = factors.totp.find((item) => item.status === 'verified')
      if (!factor) return { error: 'No verified TOTP authenticator is available for this account.' }
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id })
      if (challengeError) return { error: challengeError.message }
      return { mfaChallenge: { factorId: factor.id, challengeId: challenge.id } }
    }

    return {
      configured: Boolean(supabase),
      loading,
      user: session?.user ?? null,
      mfaStatus,
      signIn: async (email, password) => {
        if (!supabase) return { error: 'Supabase Auth is not configured for this deployment.' }
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) return { error: error.message }

        const { data, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (assuranceError) return { error: `Unable to verify the account's MFA requirement: ${assuranceError.message}` }
        if (data.nextLevel === 'aal2' && data.currentLevel !== 'aal2') {
          return beginMfaChallenge()
        }
        return {}
      },
      beginMfaChallenge,
      verifyMfa: async (factorId, challengeId, code) => {
        if (!supabase) return { error: 'Supabase Auth is not configured for this deployment.' }
        if (!/^\d{6}$/.test(code)) return { error: 'Enter the 6-digit authenticator code.' }
        const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code })
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
    }
  }, [loading, mfaStatus, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
