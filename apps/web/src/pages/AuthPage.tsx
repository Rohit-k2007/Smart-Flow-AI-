import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button, Card } from '../components/common/UI'
import { useAuth } from '../contexts/useAuth'

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
  const navigate = useNavigate()
  const auth = useAuth()
  const isLogin = mode === 'login'
  const isSignup = mode === 'signup'
  const title = isLogin ? 'Sign in' : isSignup ? 'Create your account' : 'Reset your password'
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
  const onSubmit = async (values: FormValues) => {
    setMessage('')
    setErrorMessage('')
    const result = mode === 'login'
      ? await auth.signIn(values.email, values.password ?? '')
      : mode === 'signup'
        ? await auth.signUp(values.email, values.password ?? '', values.name?.trim() ?? '')
        : await auth.resetPassword(values.email)
    if (result.error) {
      setErrorMessage(result.error)
      return
    }
    if (result.notice) {
      setMessage(result.notice)
      return
    }
    navigate('/dashboard')
  }
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })
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
        <form className="auth-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          {isSignup && <label>Full name<input {...register('name')} autoComplete="name" placeholder="Your name" aria-invalid={Boolean(errors.name)} />{errors.name && <small className="field-error">{errors.name.message}</small>}</label>}
          <label>Email<input {...register('email')} type="email" autoComplete="email" placeholder="you@example.com" aria-invalid={Boolean(errors.email)} />{errors.email && <small className="field-error">{errors.email.message}</small>}</label>
          {mode !== 'forgot' && <>
            <label>Password<div className="password-field"><input {...register('password')} type={showPassword ? 'text' : 'password'} autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder="At least 8 characters" aria-invalid={Boolean(errors.password)} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{errors.password && <small className="field-error">{errors.password.message}</small>}</label>
            {isSignup && <label>Confirm password<input {...register('confirmPassword')} type={showPassword ? 'text' : 'password'} autoComplete="new-password" aria-invalid={Boolean(errors.confirmPassword)} />{errors.confirmPassword && <small className="field-error">{errors.confirmPassword.message}</small>}</label>}
          </>}
          <Button type="submit" disabled={isSubmitting || !auth.configured}>{isSubmitting ? 'Please wait…' : isLogin ? 'Continue' : isSignup ? 'Create account' : 'Send reset link'}</Button>
        </form>
        <div className="auth-footer">
          {isLogin ? <><Link to="/forgot-password">Forgot password?</Link><br />New to SmartFlow? <Link to="/signup">Create account</Link></> :
            <>{isSignup ? 'Already have an account?' : 'Remembered your password?'} <Link to="/login">Sign in</Link></>}
        </div>
      </Card>
    </div>
  )
}
