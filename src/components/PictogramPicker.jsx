import { useState } from 'react'

export function PictogramPicker({ title, pictoUrl, onSearch, onSelect, onClear }) {
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSearch() {
    setError('')
    setLoading(true)
    try {
      setResults(await onSearch(title))
    } catch {
      setError('La recherche a échoué. Réessayez, ou continuez sans pictogramme.')
      setResults(null)
    } finally {
      setLoading(false)
    }
  }

  if (pictoUrl) {
    return (
      <div className="plai-field flex items-center gap-3">
        <img src={pictoUrl} alt="Pictogramme de la tâche" style={{ width: 48, height: 48 }} />
        <button type="button" className="plai-btn-ghost" onClick={handleSearch}>
          Changer
        </button>
        <button type="button" className="plai-btn-ghost" onClick={onClear}>
          Retirer le pictogramme
        </button>
      </div>
    )
  }

  return (
    <div className="plai-field">
      <button type="button" className="plai-btn-ghost" onClick={handleSearch} disabled={loading}>
        {loading ? 'Recherche...' : 'Chercher un pictogramme'}
      </button>
      <p className="plai-help mt-1">
        Optionnel — une image à côté du titre pour aider à comprendre la tâche d'un coup d'œil.
      </p>

      {error && (
        <p className="plai-error mt-2" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && results && results.length === 0 && (
        <p className="plai-help mt-2" role="status">
          Aucun pictogramme trouvé pour « {title} ». Essayez de renommer la tâche avec un mot plus simple.
        </p>
      )}

      {results && results.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-2">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              className="plai-btn-ghost"
              onClick={() => onSelect(p.url)}
              title={p.keywords.join(', ')}
              aria-label={`Choisir ce pictogramme : ${p.keywords.join(', ')}`}
            >
              <img src={p.url} alt="" style={{ width: 48, height: 48 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
