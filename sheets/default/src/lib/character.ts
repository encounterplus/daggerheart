import type { CharacterData } from '../../../../cache/schemas/character'

/** The character's store, typed by the model schema's export (`cache/schemas/character.d.ts`). */
export type Character = EPEntityStore<CharacterData>

/** A snapshot of the character. */
export type CharacterSnapshot = EPSnapshot<CharacterData>

/** The character the sheet's address names (`?id=`), or `null` when it names none. */
export const character = EP.entity as Character | null
