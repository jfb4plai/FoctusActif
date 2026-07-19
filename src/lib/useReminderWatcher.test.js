import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useReminderWatcher } from './useReminderWatcher.js'

describe('useReminderWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retourne false si la tâche n\'a pas de rappel', () => {
    const store = { markReminderSent: vi.fn() }
    const task = { id: 't1', remindAt: null, reminderSent: false }
    const { result } = renderHook(() => useReminderWatcher(store, task))
    expect(result.current).toBe(false)
  })

  it('déclenche le rappel dès que remindAt est dans le passé, une seule fois', async () => {
    const store = { markReminderSent: vi.fn().mockResolvedValue(undefined) }
    const task = { id: 't1', remindAt: new Date(Date.now() - 1000).toISOString(), reminderSent: false }

    const { result } = renderHook(() => useReminderWatcher(store, task))

    await waitFor(() => expect(result.current).toBe(true))
    expect(store.markReminderSent).toHaveBeenCalledWith('t1')
    expect(store.markReminderSent).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(60000)
    expect(store.markReminderSent).toHaveBeenCalledTimes(1)
  })

  it('ne déclenche rien si reminderSent est déjà true', () => {
    const store = { markReminderSent: vi.fn() }
    const task = { id: 't1', remindAt: new Date(Date.now() - 1000).toISOString(), reminderSent: true }
    const { result } = renderHook(() => useReminderWatcher(store, task))
    expect(result.current).toBe(false)
    expect(store.markReminderSent).not.toHaveBeenCalled()
  })
})
