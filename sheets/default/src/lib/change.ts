import type { CharacterData } from '../../../../cache/schemas/character'
import type { Character } from './character'
import { report } from './notice.svelte'

/**
 * Changes the character in one batch through a rule (lib/rules). A rule that throws changes
 * nothing and its message shows in the status line; the app's refusals reach it through the
 * store's error event.
 */
export function change(character: Character, fn: (data: CharacterData) => void) {
  try {
    character.update(fn)
  } catch (error) {
    report((error as Error).message)
  }
}

/** Sets one value; a refusal reaches the status line through the store's error event. */
export function set(character: Character, path: string, value: unknown) {
  character.set(path, value)
}
