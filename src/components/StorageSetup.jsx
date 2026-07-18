export function StorageSetup({ onChooseLocal, onChooseAccount }) {
  return (
    <div className="plai-section">
      <h2>Comment voulez-vous utiliser FocusActif ?</h2>

      <div className="plai-card mb-4">
        <p className="mb-3">
          <strong>Sans compte</strong> — vos contextes et tâches restent uniquement sur cet
          appareil.
        </p>
        <p className="plai-help mb-3">
          Limite à connaître : dans ce mode, un enseignant ne peut pas configurer ou verrouiller
          de contexte à distance, puisque rien n'est envoyé sur un serveur.
        </p>
        <button type="button" className="plai-btn" onClick={onChooseLocal}>
          Continuer sans compte
        </button>
      </div>

      <div className="plai-card">
        <p className="mb-3">
          <strong>Avec un compte</strong> — vos données sont synchronisées, et un enseignant lié
          peut configurer certains contextes pour vous.
        </p>
        <button type="button" className="plai-btn" onClick={onChooseAccount}>
          Créer un compte / Se connecter
        </button>
      </div>
    </div>
  )
}
