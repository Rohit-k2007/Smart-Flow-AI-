import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card } from '../common/UI'
import { useAuth } from '../../contexts/useAuth'
import { supabase } from '../../services/supabase'

type FactorSummary = { id: string; name: string | null }
type Enrollment = { factorId: string; qrCode: string; secret: string }
type DisableChallenge = { factorId: string; challengeId: string }
type FactorState = 'loading' | 'guest' | 'none' | 'pending' | 'verified' | 'unavailable'

export function TwoFactorSettings() {
  const { configured, mfaStatus, user } = useAuth()
  const [factorState, setFactorState] = useState<FactorState>('loading')
  const [verifiedFactor, setVerifiedFactor] = useState<FactorSummary | null>(null)
  const [pendingFactorId, setPendingFactorId] = useState<string | null>(null)
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [disableChallenge, setDisableChallenge] = useState<DisableChallenge | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refreshFactors = useCallback(async () => {
    if (!supabase || !user) {
      setFactorState('guest')
      setVerifiedFactor(null)
      setPendingFactorId(null)
      return
    }

    setFactorState('loading')
    try {
      const { data, error: listError } = await supabase.auth.mfa.listFactors()
      if (listError) throw listError
      const verified = data.totp.find((factor) => factor.status === 'verified')
      const pending = data.all.find(
        (factor) => factor.factor_type === 'totp' && factor.status === 'unverified',
      )
      setVerifiedFactor(verified ? { id: verified.id, name: verified.friendly_name ?? null } : null)
      setPendingFactorId(pending?.id ?? null)
      setFactorState(verified ? 'verified' : pending ? 'pending' : 'none')
      setError('')
    } catch (loadError) {
      setFactorState('unavailable')
      setError(loadError instanceof Error ? loadError.message : 'Authenticator status could not be loaded.')
    }
  }, [user])

  useEffect(() => {
    void refreshFactors()
  }, [refreshFactors])

  const enroll = async () => {
    if (!supabase || !user) return
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'SmartFlow AI authenticator',
      })
      if (enrollError) throw enrollError
      setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
      setCode('')
      setNotice('Scan the QR code, then enter the current 6-digit code to verify enrollment.')
      await refreshFactors()
    } catch (enrollError) {
      setError(enrollError instanceof Error ? enrollError.message : 'TOTP enrollment could not be started.')
    } finally {
      setBusy(false)
    }
  }

  const verifyEnrollment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !enrollment) return
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your authenticator app.')
      return
    }
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: enrollment.factorId })
      if (challengeError) throw challengeError
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollment.factorId,
        challengeId: challenge.id,
        code,
      })
      if (verifyError) throw verifyError
      setEnrollment(null)
      setCode('')
      setNotice('Two-factor authentication is enabled and verified for this account.')
      await refreshFactors()
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Authenticator verification failed. Check the code and try again.')
    } finally {
      setBusy(false)
    }
  }

  const cancelPendingEnrollment = async () => {
    if (!supabase || !pendingFactorId) return
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: pendingFactorId })
      if (unenrollError) throw unenrollError
      setEnrollment(null)
      setNotice('Unverified authenticator setup was removed.')
      await refreshFactors()
    } catch (unenrollError) {
      setError(unenrollError instanceof Error ? unenrollError.message : 'Pending authenticator setup could not be removed.')
    } finally {
      setBusy(false)
    }
  }

  const startDisable = async () => {
    if (!supabase || !verifiedFactor) return
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const { data, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: verifiedFactor.id })
      if (challengeError) throw challengeError
      setDisableChallenge({ factorId: verifiedFactor.id, challengeId: data.id })
      setCode('')
      setNotice('Verify with your authenticator before removing this factor.')
    } catch (challengeError) {
      setError(challengeError instanceof Error ? challengeError.message : 'A removal challenge could not be created.')
    } finally {
      setBusy(false)
    }
  }

  const renewDisableChallenge = async () => {
    if (!supabase || !disableChallenge) return
    setError('')
    setBusy(true)
    try {
      const { data, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: disableChallenge.factorId })
      if (challengeError) throw challengeError
      setDisableChallenge({ ...disableChallenge, challengeId: data.id })
      setCode('')
    } catch (challengeError) {
      setError(challengeError instanceof Error ? challengeError.message : 'A new verification challenge could not be created.')
    } finally {
      setBusy(false)
    }
  }

  const verifyAndDisable = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !disableChallenge) return
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your authenticator app.')
      return
    }
    setError('')
    setNotice('')
    setBusy(true)
    try {
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: disableChallenge.factorId,
        challengeId: disableChallenge.challengeId,
        code,
      })
      if (verifyError) throw verifyError
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: disableChallenge.factorId })
      if (unenrollError) throw unenrollError
      setDisableChallenge(null)
      setCode('')
      setNotice('Two-factor authentication has been disabled after authenticator verification.')
      await refreshFactors()
    } catch (disableError) {
      setError(disableError instanceof Error ? disableError.message : 'Two-factor authentication could not be disabled.')
    } finally {
      setBusy(false)
    }
  }

  const statusLabel = factorState === 'verified'
    ? 'Enabled · verified'
    : factorState === 'pending'
      ? 'Enrollment pending'
      : factorState === 'loading'
        ? 'Checking'
        : factorState === 'unavailable'
          ? 'Status unavailable'
          : factorState === 'guest'
            ? 'Sign-in required'
            : 'Not enabled'

  return (
    <Card className="data-panel security-section">
      <div className="security-heading">
        <div>
          <h2>Security</h2>
          <p>Optional TOTP verification for registered users. Public guest access remains available.</p>
        </div>
        <Badge tone={factorState === 'verified' ? 'success' : factorState === 'unavailable' ? 'danger' : 'neutral'}>{statusLabel}</Badge>
      </div>
      {error && <div className="error-state" role="alert">{error}</div>}
      {notice && <div className="mini-callout" role="status">{notice}</div>}

      {!configured || !user ? (
        <div className="security-guest">
          <p>{configured ? 'Sign in to manage authenticator settings. The public dashboard does not require an account.' : 'Supabase Auth is not configured in this environment. No mock MFA is used.'}</p>
          {configured && <Link to="/login">Sign in</Link>}
        </div>
      ) : (
        <>
          <div className="security-readout">
            <span>Authenticator factor</span><strong>{statusLabel}</strong>
            <span>Current session</span><strong>{mfaStatus === 'verified' ? 'MFA verified' : mfaStatus === 'required' ? 'MFA verification required' : mfaStatus === 'checking' ? 'Checking assurance level' : mfaStatus === 'unavailable' ? 'Assurance status unavailable' : 'Password-only session'}</strong>
          </div>

          {factorState === 'verified' && !disableChallenge && (
            <Button type="button" variant="secondary" disabled={busy} onClick={() => void startDisable()}>
              Disable Two-Factor Authentication
            </Button>
          )}
          {factorState === 'none' && !enrollment && (
            <Button type="button" disabled={busy} onClick={() => void enroll()}>
              {busy ? 'Starting…' : 'Enable Two-Factor Authentication'}
            </Button>
          )}
          {factorState === 'pending' && !enrollment && (
            <div className="security-pending">
              <p>An unverified TOTP enrollment already exists. Continue its setup on the device where it was started, or remove it and start again.</p>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void cancelPendingEnrollment()}>Remove pending enrollment</Button>
            </div>
          )}

          {enrollment && (
            <section className="mfa-enrollment" aria-labelledby="mfa-enrollment-title">
              <h3 id="mfa-enrollment-title">Set up an authenticator</h3>
              <p>Scan this Supabase-generated QR code with an authenticator app. Keep the setup secret private.</p>
              <img src={enrollment.qrCode} alt="TOTP authenticator setup QR code" />
              <p className="mfa-secret-label">Manual setup key</p>
              <code className="mfa-secret">{enrollment.secret}</code>
              <form className="auth-form" onSubmit={(event) => void verifyEnrollment(event)}>
                <label htmlFor="enrollment-totp-code">6-digit authenticator code</label>
                <input id="enrollment-totp-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
                <Button type="submit" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify and enable'}</Button>
                <Button type="button" variant="secondary" disabled={busy} onClick={() => void cancelPendingEnrollment()}>Cancel setup</Button>
              </form>
            </section>
          )}

          {disableChallenge && (
            <form className="auth-form mfa-disable-form" onSubmit={(event) => void verifyAndDisable(event)}>
              <label htmlFor="disable-totp-code">Re-enter your authenticator code to disable MFA</label>
              <input id="disable-totp-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required />
              <Button type="submit" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify and disable'}</Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void renewDisableChallenge()}>Get a new challenge</Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => { setDisableChallenge(null); setCode(''); setError(''); setNotice('') }}>Cancel</Button>
            </form>
          )}
        </>
      )}

      <p className="security-recovery-note">
        Recovery codes are not enabled or stored by SmartFlow. If an authenticator is lost, use the project owner’s verified Supabase recovery process; do not share passwords or service-role credentials.
      </p>
      <p className="security-policy-note">
        Admin MFA enforcement is not active: this deployment currently has no backend-verified admin role or protected admin route. Configure and verify the admin role source before applying a mandatory policy.
      </p>
    </Card>
  )
}
