import type { Character } from './character'

/**
 * Lets the user pick entries of an entity from the library and adds a copy of each: to a list,
 * or in place of a single copy (`multiple: false`). `keys` are the entry's data the copy keeps,
 * as the schema's copies and forms/character.json's `custom.map` name them.
 */
export async function addFromLibrary(character: Character, path: string, entity: string, keys: string[], multiple = true) {
  if (multiple) {
    const entries = await EP.pick({ entity, multiple: true })
    for (const entry of entries) {
      // one at a time: a refused copy reports through the store's error event, the others still go
      await character.embed(path, entry, keys).catch(() => {})
    }
  } else {
    const entry = await EP.pick({ entity })
    if (entry) {
      await character.embed(path, entry, keys).catch(() => {})
    }
  }
}

/** What each copy keeps of its library entry: the schema's copies, by entity. */
export const copyKeys = {
  Ancestry: ['features'],
  Community: ['features'],
  Transformation: ['features'],
  Class: ['domains', 'evasion', 'hp', 'hopeFeature', 'features'],
  Subclass: ['spellcastTrait', 'foundations', 'specializations', 'masteries'],
  Armor: ['tier', 'score', 'thresholds', 'feature'],
  Weapon: ['category', 'tier', 'type', 'trait', 'range', 'damage', 'damageType', 'burden', 'feature'],
  // consumables too: Consumable extends Item
  Item: ['rarity', 'descr'],
  DomainCard: ['domain', 'type', 'level', 'recall', 'descr'],
  Beastform: ['tier', 'trait', 'traitModifier', 'evasionModifier', 'attack', 'advantages', 'features']
}
