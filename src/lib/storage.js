const HISTORY_KEY = 'photocritic_history'
const SETTINGS_KEY = 'photocritic_settings'

export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch {
    return []
  }
}

export function addToHistory(entry) {
  const history = getHistory()
  history.unshift({
    ...entry,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  })
  // Keep last 50 entries
  if (history.length > 50) history.length = 50
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  return history
}

export function deleteFromHistory(id) {
  const history = getHistory().filter((e) => e.id !== id)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  return history
}

export function clearHistory() {
  localStorage.removeItem(HISTORY_KEY)
}

export function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
  } catch {
    return {}
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}
