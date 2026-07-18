import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { LinkByCode } from './LinkByCode.jsx'

describe('LinkByCode', () => {
  it('génère un code au clic sur "Générer un code" et l\'affiche', async () => {
    const onGenerate = vi.fn().mockResolvedValue({ invite_code: 'ABC123' })
    render(<LinkByCode role="teacher" onGenerate={onGenerate} onClaim={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /générer un code/i }))

    expect(onGenerate).toHaveBeenCalledWith('teacher')
    expect(await screen.findByText('ABC123')).toBeInTheDocument()
  })

  it('déclenche onClaim avec le code saisi', async () => {
    const onClaim = vi.fn().mockResolvedValue({ status: 'linked' })
    render(<LinkByCode role="student" onGenerate={vi.fn()} onClaim={onClaim} />)

    await userEvent.type(screen.getByLabelText(/code reçu/i), 'XYZ789')
    await userEvent.click(screen.getByRole('button', { name: /valider le code/i }))

    expect(onClaim).toHaveBeenCalledWith('XYZ789')
  })

  it('affiche un message d\'erreur générique si onClaim échoue', async () => {
    const onClaim = vi.fn().mockRejectedValue(new Error('Code invalide ou déjà utilisé.'))
    render(<LinkByCode role="student" onGenerate={vi.fn()} onClaim={onClaim} />)

    await userEvent.type(screen.getByLabelText(/code reçu/i), 'BADCODE')
    await userEvent.click(screen.getByRole('button', { name: /valider le code/i }))

    expect(await screen.findByText(/code invalide/i)).toBeInTheDocument()
  })

  it('affiche un message d\'erreur générique si onGenerate échoue', async () => {
    const onGenerate = vi.fn().mockRejectedValue(new Error('Une erreur est survenue, réessayez.'))
    render(<LinkByCode role="teacher" onGenerate={onGenerate} onClaim={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: /générer un code/i }))

    expect(await screen.findByText(/une erreur est survenue/i)).toBeInTheDocument()
  })
})
