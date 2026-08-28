import { useId, useState } from 'react'

function explainAuthError(error) {
  const message = error?.message || ''

  if (/at least \d+ characters/i.test(message)) {
    return 'Le mot de passe doit contenir au moins 6 caractères.'
  }
  if (/rate limit/i.test(message)) {
    return 'Trop de tentatives. Patientez quelques minutes avant de réessayer.'
  }
  if (/invalid login credentials/i.test(message)) {
    return 'Identifiants incorrects. Vérifiez votre e-mail et votre mot de passe.'
  }
  if (/user already registered|already exists/i.test(message)) {
    return "Un compte existe déjà avec cette adresse e-mail. Utilisez « J'ai déjà un compte » pour vous connecter."
  }
  return 'Une erreur est survenue. Vérifiez votre e-mail et votre mot de passe (au moins 6 caractères), puis réessayez.'
}

export function Auth({ onSignIn, onSignUp, onForgotPassword, onUpdatePassword, passwordRecovery }) {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'reset'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const emailId = useId()
  const passwordId = useId()
  const newPasswordId = useId()

  async function handleSubmit() {
    setError('')
    setInfo('')
    try {
      if (mode === 'signin') {
        await onSignIn(email, password)
      } else if (mode === 'reset') {
        await onForgotPassword(email)
        setInfo('Email envoyé ! Vérifiez votre boîte mail pour créer un nouveau mot de passe.')
      } else {
        const result = await onSignUp(email, password)
        if (result?.alreadyExists) {
          setError(
            "Un compte existe déjà avec cette adresse e-mail. Utilisez « J'ai déjà un compte » pour vous connecter.",
          )
        } else if (result?.needsConfirmation) {
          setInfo(
            'Compte créé — vérifiez votre boîte mail et cliquez sur le lien de confirmation avant de vous connecter.',
          )
        }
      }
    } catch (err) {
      setError(explainAuthError(err))
    }
  }

  function handleFormSubmit(event) {
    event.preventDefault()
    handleSubmit()
  }

  async function handleUpdatePassword(event) {
    event.preventDefault()
    setError('')
    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }
    try {
      await onUpdatePassword(newPassword)
    } catch (err) {
      setError(explainAuthError(err))
    }
  }

  if (passwordRecovery) {
    return (
      <div className="plai-section">
        <h2>Nouveau mot de passe</h2>
        {error && <p className="plai-error">{error}</p>}
        <form onSubmit={handleUpdatePassword}>
          <div className="plai-field">
            <label htmlFor={newPasswordId} className="plai-label">
              Nouveau mot de passe
            </label>
            <input
              id={newPasswordId}
              type="password"
              className="plai-input"
              placeholder="ex : au moins 6 caractères"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="plai-btn">
            Enregistrer
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="plai-section">
      <h2>{mode === 'signin' ? 'Se connecter' : mode === 'reset' ? 'Mot de passe oublié' : 'Créer un compte'}</h2>

      {error && <p className="plai-error">{error}</p>}
      {info && <p className="plai-success">{info}</p>}

      <form onSubmit={handleFormSubmit}>
        <div className="plai-field">
          <label htmlFor={emailId} className="plai-label">
            Adresse e-mail
          </label>
          <input
            id={emailId}
            type="email"
            className="plai-input"
            placeholder="ex : eleve@ecole.be"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="plai-help">Sert uniquement à retrouver votre compte, jamais partagée.</p>
        </div>

        {mode !== 'reset' && (
          <div className="plai-field">
            <label htmlFor={passwordId} className="plai-label">
              Mot de passe
            </label>
            <input
              id={passwordId}
              type="password"
              className="plai-input"
              placeholder="ex : au moins 8 caractères"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="plai-help">Vous en aurez besoin pour vous reconnecter la prochaine fois.</p>
          </div>
        )}

        <button type="submit" className="plai-btn">
          {mode === 'signin' ? 'Se connecter' : mode === 'reset' ? 'Envoyer le lien' : 'Créer mon compte'}
        </button>
      </form>

      {mode !== 'reset' && (
        <button
          type="button"
          className="plai-btn-ghost mt-3"
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setInfo('') }}
        >
          {mode === 'signin' ? 'Créer un compte' : "J'ai déjà un compte"}
        </button>
      )}
      {mode === 'signin' && (
        <button
          type="button"
          className="plai-btn-ghost mt-3"
          onClick={() => { setMode('reset'); setError(''); setInfo('') }}
        >
          Mot de passe oublié ?
        </button>
      )}
      {mode === 'reset' && (
        <button
          type="button"
          className="plai-btn-ghost mt-3"
          onClick={() => { setMode('signin'); setError(''); setInfo('') }}
        >
          ← Retour à la connexion
        </button>
      )}
    </div>
  )
}
