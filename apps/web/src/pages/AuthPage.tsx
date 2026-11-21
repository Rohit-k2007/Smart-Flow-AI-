import { useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Card } from '../components/common/UI'
import { useAuth } from '../contexts/useAuth'
import type { MfaChallenge } from '../contexts/auth-context'

type Mode = 'login' | 'signup' | 'forgot'
const schema = z.object({
  name: z.string().optional(),
  email: z.string().email('Enter a valid email address.'),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export function AuthPage({ mode }: { mode: Mode }) {
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [mfaChallenge, setMfaChallenge] = useState<MfaChallenge | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaError, setMfaError] = useState('')
  const [mfaBusy, setMfaBusy] = useState(false)
  const navigate = useNavigate()
  const auth = useAuth()
  const isLogin = mode === 'login'
  const isSignup = mode === 'signup'
  const title = isLogin ? 'Sign in' : isSignup ? 'Create your account' : 'Reset your password'
  const requiresMfa = isLogin && (Boolean(mfaChallenge) || auth.mfaStatus === 'required')
  const formSchema = schema.superRefine((values, context) => {
    if (mode === 'signup' && !values.name?.trim()) {
      context.addIssue({ code: 'custom', path: ['name'], message: 'Enter your name.' })
    }
    if (mode !== 'forgot' && (!values.password || values.password.length < 8)) {
      context.addIssue({ code: 'custom', path: ['password'], message: 'Use at least 8 characters.' })
    }
    if (mode === 'signup' && values.password !== values.confirmPassword) {
      context.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' })
    }
  })
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })
  const onSubmit = async (values: FormValues) => {
    setMessage('')
    setErrorMessage('')
    let result
    try {
      result = mode === 'login'
        ? await auth.signIn(values.email, values.password ?? '')
        : mode === 'signup'
          ? await auth.signUp(values.email, values.password ?? '', values.name?.trim() ?? '')
          : await auth.resetPassword(values.email)
    } catch {
      setErrorMessage('Account service is unavailable. Public prototype pages remain accessible.')
      return
    }
    if (result.error) {
      setErrorMessage(result.error)
      return
    }
    if (result.mfaChallenge) {
      setMfaChallenge(result.mfaChallenge)
      setMfaCode('')
      setValue('password', '')
      setMessage('Password verified. Complete authenticator verification to finish signing in.')
      return
    }
    if (result.notice) {
      setMessage(result.notice)
      return
    }
    navigate('/dashboard')
  }
  const requestMfaChallenge = async () => {
    setMfaError('')
    setMfaBusy(true)
    try {
      const result = await auth.beginMfaChallenge()
      if (result.error || !result.mfaChallenge) {
        setMfaError(result.error ?? 'A verification challenge could not be started.')
      } else {
        setMfaChallenge(result.mfaChallenge)
        setMfaCode('')
      }
    } catch (error) {
      setMfaError(error instanceof Error ? error.message : 'The verification service is unavailable.')
    } finally {
      setMfaBusy(false)
    }
  }
  const verifyMfaCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!mfaChallenge) return
    setMfaError('')
    setMfaBusy(true)
    try {
      const result = await auth.verifyMfa(mfaChallenge.factorId, mfaChallenge.challengeId, mfaCode)
      if (result.error) {
        setMfaError(result.error)
        return
      }
      setMfaCode('')
      navigate('/dashboard')
    } catch (error) {
      setMfaError(error instanceof Error ? error.message : 'Authenticator verification failed.')
    } finally {
      setMfaBusy(false)
    }
  }
  const cancelMfaLogin = async () => {
    setMfaBusy(true)
    try {
      const result = await auth.signOut()
      if (result.error) {
        setMfaError(result.error)
        return
      }
      setMfaChallenge(null)
      setMfaCode('')
      navigate('/dashboard')
    } catch (error) {
      setMfaError(error instanceof Error ? error.message : 'Sign-out failed.')
    } finally {
      setMfaBusy(false)
    }
  }
  return (
    <div className="auth-page">
      <Link className="auth-brand" to="/">
        <div className="brand-mark">S</div>
        <strong>SmartFlow AI</strong>
      </Link>
      <Card className="auth-card">
        <span className="eyebrow">{isLogin ? 'Welcome back' : isSignup ? 'Get started' : 'Account recovery'}</span>
        <h1>{title}</h1>
        <p>{auth.configured ? 'Sign in to save private dashboard preferences.' : 'Public traffic access is available; account features require Supabase configuration.'}</p>
        {errorMessage && <div className="error-state" role="alert">{errorMessage}</div>}
        {message && <div className="mini-callout" role="status">{message}</div>}
        {requiresMfa ? (
          <section className="auth-mfa-step" aria-labelledby="mfa-login-title">
            <h2 id="mfa-login-title">Authenticator verification</h2>
            <p>Enter the current 6-digit code from your authenticator app. The code is used only for this verification and is not saved.</p>
            <p>If you lost access to the authenticator, password reset does not bypass MFA. Use the verified account-recovery process configured by the project owner; SmartFlow does not issue recovery codes.</p>
            {mfaError && <div className="error-state" role="alert">{mfaError}</div>}
            {mfaChallenge ? (
              <form className="auth-form" onSubmit={(event) => void verifyMfaCode(event)}>
                <label htmlFor="login-totp-code">6-digit authenticator code</label>
                <input id="login-totp-code" value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
                <Button type="submit" disabled={mfaBusy || mfaCode.length !== 6}>{mfaBusy ? 'Verifying…' : 'Verify and sign in'}</Button>
                <Button type="button" variant="secondary" disabled={mfaBusy} onClick={() => void requestMfaChallenge()}>Get a new challenge</Button>
              </form>
            ) : (
              <Button type="button" disabled={mfaBusy || !auth.configured} onClick={() => void requestMfaChallenge()}>{mfaBusy ? 'Starting…' : 'Start verification'}</Button>
            )}
            <Button type="button" variant="ghost" disabled={mfaBusy} onClick={() => void cancelMfaLogin()}>Cancel sign-in and continue as guest</Button>
          </section>
        ) : auth.user && auth.mfaStatus === 'checking' ? (
          <div className="mini-callout" role="status">Checking your account’s MFA status…</div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            {isSignup && <label>Full name<input {...register('name')} autoComplete="name" placeholder="Your name" aria-invalid={Boolean(errors.name)} />{errors.name && <small className="field-error">{errors.name.message}</small>}</label>}
            <label>Email<input {...register('email')} type="email" autoComplete="email" placeholder="you@example.com" aria-invalid={Boolean(errors.email)} />{errors.email && <small className="field-error">{errors.email.message}</small>}</label>
            {mode !== 'forgot' && <>
              <label>Password<div className="password-field"><input {...register('password')} type={showPassword ? 'text' : 'password'} autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder="At least 8 characters" aria-invalid={Boolean(errors.password)} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{errors.password && <small className="field-error">{errors.password.message}</small>}</label>
              {isSignup && <label>Confirm password<input {...register('confirmPassword')} type={showPassword ? 'text' : 'password'} autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} />{errors.confirmPassword && <small className="field-error">{errors.confirmPassword.message}</small>}</label>}
            </>}
            <Button type="submit" disabled={isSubmitting || !auth.configured}>{isSubmitting ? 'Please wait…' : isLogin ? 'Continue' : isSignup ? 'Create account' : 'Send reset link'}</Button>
          </form>
        )}
        <div className="auth-footer">
          {isLogin ? <><Link to="/forgot-password">Forgot password?</Link><br />New to SmartFlow? <Link to="/signup">Create account</Link></> :
            <>{isSignup ? 'Already have an account?' : 'Remembered your password?'} <Link to="/login">Sign in</Link></>}
        </div>
      </Card>
    </div>
  )
}
