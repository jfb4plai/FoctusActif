// src/components/QuickCapture.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { QuickCapture } from './QuickCapture.jsx'

describe('QuickCapture', () => {
  afterEach(() => {
    delete window.SpeechRecognition
    delete window.webkitSpeechRecognition
  })

  it('le bouton Ajouter est désactivé tant que le champ est vide', () => {
    render(<QuickCapture onAdd={vi.fn()} />)
    expect(screen.getByRole('button', { name: /ajouter/i })).toBeDisabled()
  })

  it('déclenche onAdd avec le texte saisi puis vide le champ', async () => {
    const onAdd = vi.fn()
    render(<QuickCapture onAdd={onAdd} />)

    const input = screen.getByPlaceholderText(/ex :/i)
    await userEvent.type(input, 'Ranger le sac')
    await userEvent.click(screen.getByRole('button', { name: /ajouter/i }))

    expect(onAdd).toHaveBeenCalledWith('Ranger le sac')
    expect(input).toHaveValue('')
  })

  it('n\'affiche pas le bouton micro si l\'API n\'est pas disponible', () => {
    render(<QuickCapture onAdd={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /dicter/i })).not.toBeInTheDocument()
  })

  it('affiche le bouton micro si SpeechRecognition est disponible', () => {
    window.SpeechRecognition = vi.fn()
    render(<QuickCapture onAdd={vi.fn()} />)
    expect(screen.getByRole('button', { name: /dicter/i })).toBeInTheDocument()
  })
})
