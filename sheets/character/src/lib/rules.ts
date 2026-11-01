// Daggerheart's rules the sheet applies: game rules belong to the system, never to the SDK.
import type { CharacterData, Trait, TrackedFeature } from '../../../../cache/schemas/character'

/** The traits in the character sheet's order. */
export const traits: Trait[] = ['agility', 'strength', 'finesse', 'instinct', 'presence', 'knowledge']

/** A level's tier: 1 is level 1, 2 levels 2–4, 3 levels 5–7, 4 levels 8–10. */
export function tier(level = 1) {
  return level >= 8 ? 4 : level >= 5 ? 3 : level >= 2 ? 2 : 1
}

/** A modifier with its sign: `+2`, `-1`, `+0`. */
export function signed(value = 0) {
  return value < 0 ? String(value) : `+${value}`
}

/** An action roll with a modifier: the Duality Dice, read as a sum. */
export function actionRoll(modifier = 0) {
  return `2d12${signed(modifier)}`
}

/**
 * A damage roll: Proficiency dice of a weapon's or attack's damage. Library entries store their
 * dice without a count (`d8+3`), so Proficiency prefixes them; a count already there stays.
 */
export function damageRoll(damage: string | undefined, proficiency = 1) {
  if (!damage) {
    return ''
  }
  return /^d\d/i.test(damage.trim()) ? `${proficiency}${damage.trim()}` : damage.trim()
}

// USAGE LIMITS AND TOKENS

/** When a feature's or card's uses come back, as its text words it ("once per long rest"). */
export type Limit = 'scene' | 'rest' | 'shortRest' | 'longRest' | 'session'

/** The usage limit a text names, if any. */
export function usageLimit(text: string | undefined): Limit | undefined {
  const match = /once per (long rest|short rest|rest|session|scene|day)/i.exec(text ?? '')
  switch (match?.[1].toLowerCase()) {
    case 'scene': return 'scene'
    case 'rest': return 'rest'
    case 'short rest': return 'shortRest'
    case 'long rest':
    case 'day': return 'longRest'
    case 'session': return 'session'
    default: return undefined
  }
}

/** Whether a text places tokens, so the sheet offers a counter. */
export function placesTokens(text: string | undefined) {
  return /\btokens?\b/i.test(text ?? '')
}

/** What each reset brings back: a short rest the "per rest" uses too, a long rest both. */
const resets: Record<'scene' | 'shortRest' | 'longRest' | 'session', Limit[]> = {
  scene: ['scene'],
  shortRest: ['rest', 'shortRest'],
  longRest: ['rest', 'longRest'],
  session: ['session']
}

/** Every tracked feature the character carries, wherever it comes from. */
function trackedFeatures(data: CharacterData): TrackedFeature[] {
  const subclass = (entry?: CharacterData['subclass']) =>
    [...(entry?.foundations ?? []), ...(entry?.specializations ?? []), ...(entry?.masteries ?? [])]
  return [
    data.class?.hopeFeature,
    ...(data.class?.features ?? []),
    ...subclass(data.subclass),
    ...(data.multiclass?.class?.features ?? []),
    ...subclass(data.multiclass?.subclass),
    ...(data.ancestry?.features ?? []),
    ...(data.community?.features ?? []),
    ...(data.transformation?.features ?? []),
    ...(data.beastform?.features ?? []),
    ...(data.stances?.known ?? []),
    data.armor?.feature,
    ...(data.weapons ?? []).map((weapon) => weapon.feature)
  ].filter((feature): feature is TrackedFeature => Boolean(feature))
}

/**
 * Clears the spent uses a scene's end, a rest or a session's end brings back: features and
 * domain cards whose text names that limit. Tokens are left: when they clear differs card by card.
 */
export function reset(data: CharacterData, event: keyof typeof resets) {
  const limits = resets[event]
  for (const feature of trackedFeatures(data)) {
    const limit = usageLimit(feature.text)
    if (feature.used && limit && limits.includes(limit)) {
      feature.used = false
    }
  }
  for (const card of data.domainCards ?? []) {
    const limit = usageLimit(card.descr)
    if (card.used && limit && limits.includes(limit)) {
      card.used = false
    }
  }
}

// EQUIPMENT

type Weapon = NonNullable<CharacterData['weapons']>[number]

/** At most two weapons carried besides the active ones. */
export const inventoryWeaponLimit = 2

/**
 * Equips a weapon in its category's slot, unequipping what it displaces: the other weapon of the
 * same category, the secondary for a two-handed primary, a two-handed primary for a secondary.
 */
export function equip(data: CharacterData, index: number) {
  const weapons = data.weapons ?? []
  const weapon = weapons[index]
  if (!weapon) {
    return
  }
  for (const [other, entry] of weapons.entries()) {
    if (other === index || !entry.equipped) {
      continue
    }
    if (displaces(weapon, entry) || displaces(entry, weapon)) {
      entry.equipped = false
    }
  }
  weapon.equipped = true
}

function displaces(weapon: Weapon, other: Weapon) {
  if (weapon.category === other.category) {
    return true
  }
  // a two-handed primary takes both hands
  return weapon.category === 'primary' && weapon.burden === 'twoHanded' && other.category === 'secondary'
}

// DOMAIN CARDS

/** At most five cards in the loadout; the rest are in the vault. */
export const loadoutLimit = 5

/**
 * Moves a vaulted card into the loadout. Recalling it outside a rest marks Stress equal to its
 * Recall Cost (`recall`), refused when the character can't mark that much.
 */
export function moveToLoadout(data: CharacterData, id: string, recall: boolean) {
  const cards = data.domainCards ?? []
  const card = cards.find((entry) => entry.id === id)
  if (!card) {
    return
  }
  if (cards.filter((entry) => !entry.vault).length >= loadoutLimit) {
    throw new Error(`The loadout holds ${loadoutLimit} cards: move one to the vault first.`)
  }
  if (recall && card.recall) {
    const stress = data.stress ?? {}
    const current = stress.current ?? 0
    if (current + card.recall > (stress.maximum ?? 0)) {
      throw new Error(`Recalling ${card.name} marks ${card.recall} Stress, more than is left.`)
    }
    data.stress = { ...stress, current: current + card.recall }
  }
  card.vault = false
}

// LEVELING UP

/** The advancement options, the tiers they open at and their slots in a tier. */
export const advancements = [
  { key: 'traits', label: '+1 to two unmarked traits, and mark them', slots: 3, from: 2 },
  { key: 'hp', label: 'One Hit Point slot', slots: 2, from: 2 },
  { key: 'stress', label: 'One Stress slot', slots: 2, from: 2 },
  { key: 'experiences', label: '+1 to two Experiences', slots: 1, from: 2 },
  { key: 'domainCard', label: 'An additional domain card', slots: 1, from: 2 },
  { key: 'evasion', label: '+1 to Evasion', slots: 1, from: 2 },
  { key: 'subclass', label: 'Upgraded subclass card', slots: 1, from: 3 },
  { key: 'proficiency', label: '+1 Proficiency (both of a level\'s advancements)', slots: 2, from: 3 },
  { key: 'multiclass', label: 'Multiclass (both of a level\'s advancements)', slots: 2, from: 3 }
] as const

/** The levels at which a new tier starts, with its achievements. */
const tierAchievements = [2, 5, 8]

/** Whether reaching a level brings a tier achievement. */
export function isTierAchievement(level: number) {
  return tierAchievements.includes(level)
}

/** The Experience a tier achievement brings, named by the player afterwards. */
export const newExperience = { name: 'New Experience', modifier: 2 }

/**
 * Raises the level by one with what comes with it alone: the tier achievements' +1 Proficiency
 * (levels 2, 5 and 8) and cleared trait marks (5 and 8). Their new Experience is an insert of its
 * own (`newExperience`): `update` would send the id list whole. Damage thresholds follow the
 * level (views/transforms); the advancements and the new domain card are the player's choices.
 */
export function levelUp(data: CharacterData) {
  const level = Math.min((data.level ?? 1) + 1, 10)
  data.level = level
  if (isTierAchievement(level)) {
    data.proficiency = Math.min((data.proficiency ?? 1) + 1, 6)
    if (level >= 5) {
      data.markedTraits = []
    }
  }
}
