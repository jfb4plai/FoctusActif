// src/components/QuickCapture.jsx
import { useRef, useState } from 'react'

function getSpeechRecognitionCtor() {
  return typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : undefined
}

export function QuickCapture({ onAdd }) {
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef(null)

  const SpeechRecognitionCtor = getSpeechRecognitionCtor()

  function handleAdd() {
    const trimmed = text.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setText('')
  }

  function toggleDictation() {
    if (!SpeechRecognitionCtor) return

    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }

    const recognition = new SpeechRecognitionCtor()
    recognition.lang = 'fr-FR'
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setText((prev) => (prev ? `${prev} ${transcript}` : transcript))
    }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  return (
    <div className="flex gap-2 items-center">
      <input
        className="plai-input flex-1"
        placeholder="ex : Ranger la trousse"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {SpeechRecognitionCtor && (
        <button
          type="button"
          className="plai-btn"
          onClick={toggleDictation}
          aria-pressed={listening}
        >
          {listening ? 'Arrêter' : 'Dicter 🎤'}
        </button>
      )}
      <button type="button" className="plai-btn" onClick={handleAdd} disabled={!text.trim()}>
        Ajouter
      </button>
    </div>
  )
}
