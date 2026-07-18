import { useId, useState } from 'react'

export function Auth({ onSignIn, onSignUp }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const emailId = useId()
  const passwordId = useId()

  async function handleSubmit() {
    setError('')
    try {
      if (mode === 'signin') {
        await onSignIn(email, password)
      } else {
        await onSignUp(email, password)
      }
    } catch {
      setError('Identifiants incorrects, ou compte déjà existant. Vérifiez et réessayez.')
    }
  }

  return (
    <div className="plai-section">
      <h2>{mode === 'signin' ? 'Se connecter' : 'Créer un compte'}</h2>

      {error && <p className="plai-error">{error}</p>}

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
      </div>

      <button type="button" className="plai-btn" onClick={handleSubmit}>
        {mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
      </button>

      <button
        type="button"
        className="plai-btn-ghost mt-3"
        onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
      >
        {mode === 'signin' ? 'Créer un compte' : "J'ai déjà un compte"}
      </button>
    </div>
  )
}
