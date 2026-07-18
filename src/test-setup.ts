import '@testing-library/jest-dom/vitest'

function createMemoryStorage(): Storage {
  let values: Record<string, string> = {}
  return {
    getItem(key) { return values[key] ?? null },
    setItem(key, value) { values[key] = value },
    removeItem(key) { delete values[key] },
    clear() { values = {} },
    key(index) { return Object.keys(values)[index] ?? null },
    get length() { return Object.keys(values).length },
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: createMemoryStorage(),
})
