// Which of the sheet's sections is open, remembered in this browser (or web view) only.

const key = 'daggerheart.character.section'

function stored(): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export const section = $state({ open: stored() ?? 'main' })

export function openSection(id: string) {
  section.open = id
  try {
    localStorage.setItem(key, id)
  } catch {
    // remembered for this page only
  }
}
