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

  it('affiche un label et une aide explicite pour le champ de saisie', () => {
    render(<QuickCapture onAdd={vi.fn()} />)
    expect(screen.getByLabelText(/titre de la tâche/i)).toBeInTheDocument()
    expect(screen.getByText(/une seule action à la fois/i)).toBeInTheDocument()
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

  it('accepte un placeholder personnalisé pour les contextes de réutilisation', () => {
    render(<QuickCapture onAdd={vi.fn()} placeholder="ex : Choisir le sujet" />)
    expect(screen.getByPlaceholderText('ex : Choisir le sujet')).toBeInTheDocument()
  })

  it('revient silencieusement en mode texte si la dictée échoue (onerror)', async () => {
    class FakeSpeechRecognition {
      start() {
        this.onresult
        // simulate an async error shortly after start
        setTimeout(() => this.onerror && this.onerror(), 0)
      }
      stop() {}
    }
    window.SpeechRecognition = FakeSpeechRecognition
    render(<QuickCapture onAdd={vi.fn()} />)

    const micButton = screen.getByRole('button', { name: /dicter/i })
    await userEvent.click(micButton)

    // after the simulated error, the button must return to the non-listening label
    await screen.findByRole('button', { name: /dicter/i })
    expect(screen.queryByRole('button', { name: /arrêter/i })).not.toBeInTheDocument()
  })

  it('revient silencieusement en mode texte si start() lève une exception', async () => {
    class ThrowingSpeechRecognition {
      start() {
        throw new Error('InvalidStateError')
      }
      stop() {}
    }
    window.SpeechRecognition = ThrowingSpeechRecognition
    render(<QuickCapture onAdd={vi.fn()} />)

    const micButton = screen.getByRole('button', { name: /dicter/i })
    await userEvent.click(micButton)

    expect(screen.getByRole('button', { name: /dicter/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /arrêter/i })).not.toBeInTheDocument()
  })
})
