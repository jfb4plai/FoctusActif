export function TeacherRoster({ links, onSelectStudent }) {
  return (
    <div className="plai-section">
      <h2>Mes élèves liés</h2>

      {links.length === 0 && <p className="plai-empty">Aucun élève lié pour l'instant.</p>}

      <ul>
        {links.map((link) => (
          <li
            key={link.id}
            data-testid="roster-item"
            className="plai-card mb-2"
            role="button"
            tabIndex={0}
            onClick={() => onSelectStudent(link.student_id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelectStudent(link.student_id)
            }}
          >
            Élève {link.student_id.slice(0, 8)}
          </li>
        ))}
      </ul>
    </div>
  )
}
