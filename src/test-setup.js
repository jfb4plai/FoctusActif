import '@testing-library/jest-dom'
import 'fake-indexeddb/auto'
import { vi } from 'vitest'

// @testing-library/dom's waitFor() only auto-advances fake timers when it
// detects Jest's global `jest` object. Under Vitest (vi.useFakeTimers()),
// without this shim waitFor() hangs forever waiting on an internal
// setTimeout(0) that fake timers never advance. This shim lets
// testing-library's detection succeed so waitFor() works with Vitest fake
// timers exactly as it does with Jest's.
if (typeof globalThis.jest === 'undefined') {
  globalThis.jest = {
    advanceTimersByTime: (...args) => vi.advanceTimersByTime(...args),
  }
}
