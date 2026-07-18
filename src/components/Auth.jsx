import { useId, useState } from 'react'

export function Auth({ onSignIn, onSignUp }) {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const emailId = useId()
  const passwordId = useId()

  async function handleSubmit() {
    setError('')
    setInfo('')
    try {
      if (mode === 'signin') {
        await onSignIn(email, password)
      } else {
        const result = await onSignUp(email, password)
        if (result?.needsConfirmation) {
          setInfo(
            'Compte créé — vérifiez votre boîte mail et cliquez sur le lien de confirmation avant de vous connecter.',
          )
        }
      }
    } catch {
      setError('Identifiants incorrects, ou compte déjà existant. Vérifiez et réessayez.')
    }
  }

  function handleFormSubmit(event) {
    event.preventDefault()
    handleSubmit()
  }

  return (
    <div className="plai-section">
      <h2>{mode === 'signin' ? 'Se connecter' : 'Créer un compte'}</h2>

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

        <button type="submit" className="plai-btn">
          {mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
        </button>
      </form>

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
