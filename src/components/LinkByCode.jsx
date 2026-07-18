import { useId, useState } from 'react'

export function LinkByCode({ role, onGenerate, onClaim }) {
  const [generatedCode, setGeneratedCode] = useState('')
  const [claimInput, setClaimInput] = useState('')
  const [error, setError] = useState('')
  const claimInputId = useId()

  async function handleGenerate() {
    setError('')
    try {
      const link = await onGenerate(role)
      setGeneratedCode(link.invite_code)
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleClaim() {
    setError('')
    try {
      await onClaim(claimInput)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="plai-card">
      <div className="mb-4">
        <button type="button" className="plai-btn" onClick={handleGenerate}>
          Générer un code
        </button>
        {generatedCode && (
          <p className="plai-help mt-2">
            Votre code : <strong>{generatedCode}</strong> — transmettez-le à l'autre personne.
          </p>
        )}
      </div>

      <div className="plai-field">
        <label htmlFor={claimInputId} className="plai-label">
          Code reçu
        </label>
        <input
          id={claimInputId}
          className="plai-input"
          placeholder="ex : ABC123"
          value={claimInput}
          onChange={(e) => setClaimInput(e.target.value)}
        />
        <p className="plai-help">Saisissez ici le code transmis par l'enseignant ou l'élève.</p>
      </div>

      {error && <p className="plai-error">{error}</p>}

      <button type="button" className="plai-btn" onClick={handleClaim}>
        Valider le code
      </button>
    </div>
  )
}
