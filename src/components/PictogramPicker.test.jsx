import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { PictogramPicker } from './PictogramPicker.jsx'

describe('PictogramPicker', () => {
  it('affiche le pictogramme actuel avec un bouton Changer et Retirer', () => {
    render(
      <PictogramPicker
        title="Réviser"
        pictoUrl="https://api.arasaac.org/api/pictograms/5064"
        onSearch={vi.fn()}
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    )
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://api.arasaac.org/api/pictograms/5064')
    expect(screen.getByRole('button', { name: /changer/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retirer le pictogramme/i })).toBeInTheDocument()
  })

  it('déclenche onClear au clic sur Retirer', async () => {
    const onClear = vi.fn()
    render(
      <PictogramPicker
        title="Réviser"
        pictoUrl="https://api.arasaac.org/api/pictograms/5064"
        onSearch={vi.fn()}
        onSelect={vi.fn()}
        onClear={onClear}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /retirer le pictogramme/i }))
    expect(onClear).toHaveBeenCalled()
  })

  it('propose de chercher un pictogramme si aucun n\'est attaché', () => {
    render(
      <PictogramPicker title="Réviser" pictoUrl={null} onSearch={vi.fn()} onSelect={vi.fn()} onClear={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: /chercher un pictogramme/i })).toBeInTheDocument()
  })

  it('recherche avec le titre de la tâche et affiche les résultats cliquables', async () => {
    const onSearch = vi.fn().mockResolvedValue([
      { id: 5064, url: 'https://api.arasaac.org/api/pictograms/5064', keywords: ['maison'] },
      { id: 3479, url: 'https://api.arasaac.org/api/pictograms/3479', keywords: ['venir'] },
    ])
    const onSelect = vi.fn()
    render(
      <PictogramPicker title="Réviser" pictoUrl={null} onSearch={onSearch} onSelect={onSelect} onClear={vi.fn()} />,
    )

    await userEvent.click(screen.getByRole('button', { name: /chercher un pictogramme/i }))
    expect(onSearch).toHaveBeenCalledWith('Réviser')

    const results = await screen.findAllByRole('button', { name: /choisir ce pictogramme/i })
    expect(results).toHaveLength(2)

    await userEvent.click(results[0])
    expect(onSelect).toHaveBeenCalledWith('https://api.arasaac.org/api/pictograms/5064')
  })

  it('affiche un message explicite si aucun résultat n\'est trouvé', async () => {
    const onSearch = vi.fn().mockResolvedValue([])
    render(
      <PictogramPicker title="Bidule" pictoUrl={null} onSearch={onSearch} onSelect={vi.fn()} onClear={vi.fn()} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /chercher un pictogramme/i }))
    expect(await screen.findByText(/aucun pictogramme trouvé/i)).toBeInTheDocument()
  })

  it('affiche un message explicite en cas d\'échec de la recherche', async () => {
    const onSearch = vi.fn().mockRejectedValue(new Error('réseau indisponible'))
    render(
      <PictogramPicker title="Bidule" pictoUrl={null} onSearch={onSearch} onSelect={vi.fn()} onClear={vi.fn()} />,
    )
    await userEvent.click(screen.getByRole('button', { name: /chercher un pictogramme/i }))
    expect(await screen.findByText(/la recherche a échoué/i)).toBeInTheDocument()
  })
})
