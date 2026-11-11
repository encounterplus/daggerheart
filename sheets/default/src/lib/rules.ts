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

/**
 * An action roll with a modifier: the Duality Dice. Each die carries its label, so the app
 * colours them and reads the roll's outcome (config.json `dice`) from the two d12s alone:
 * `1d12[Hope] + 1d12[Fear] + 2`. Advantage and disadvantage are the system's roll options
 * (config.json `dice.options`), which add their d6 in the link's menu.
 */
export function actionRoll(modifier = 0) {
  return `1d12[Hope] + 1d12[Fear] ${signed(modifier).replace(/^([+-])/, '$1 ')}`
}

/** A duality roll's outcome, as config.json's `dice.outcomes` name them. */
export type DualityOutcome = 'hope' | 'fear' | 'critical'

/** The outcome of a duality roll the app rolled; `null` for one it read none from. */
export function dualityOutcome(roll: EPRoll | null): DualityOutcome | null {
  const id = roll?.outcome?.id
  return id === 'hope' || id === 'fear' || id === 'critical' ? id : null
}

/**
 * What an action roll's outcome gives the character: with Hope, a Hope; a critical success, a
 * Hope and a Stress cleared. With Fear the GM gains a Fear, which is the campaign's, not the
 * character's (components use `EP.adjustResource`). Hope stays within its maximum.
 */
export function applyDuality(data: CharacterData, outcome: DualityOutcome, hopeMaximum = 6) {
  if (outcome === 'hope' || outcome === 'critical') {
    data.hope = Math.min((data.hope ?? 0) + 1, hopeMaximum)
  }
  if (outcome === 'critical' && (data.stress?.current ?? 0) > 0) {
    data.stress = { ...data.stress, current: (data.stress?.current ?? 0) - 1 }
  }
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

// DOWNTIME

export type Rest = 'shortRest' | 'longRest'

/**
 * The downtime moves, by the rest they're chosen in: a short rest's clear 1d4 + Tier, a long
 * rest's all of it. `ally` moves can be made on an ally, whose own sheet clears it.
 */
export const downtimeMoves = [
  { key: 'wounds', shortRest: 'Tend to Wounds', longRest: 'Tend to All Wounds', ally: true, text: 'Clear Hit Points for yourself or an ally.' },
  { key: 'stress', shortRest: 'Clear Stress', longRest: 'Clear All Stress', ally: false, text: 'Clear Stress.' },
  { key: 'armor', shortRest: 'Repair Armor', longRest: 'Repair All Armor', ally: true, text: 'Clear Armor Slots from your or an ally\'s armor.' },
  { key: 'prepare', shortRest: 'Prepare', longRest: 'Prepare', ally: false, text: 'Describe how you prepare, then gain a Hope; 2 Hope each when you Prepare with one or more members of your party.' },
  { key: 'project', shortRest: null, longRest: 'Work on a Project', ally: false, text: 'With GM approval, advance a long-term project\'s countdown, automatically or with an action roll (GM\'s choice).' }
] as const

export type DowntimeMoveKey = typeof downtimeMoves[number]['key']

/** A move as the player chose it: whose it is, what its dice came to, a project's advance. */
export interface DowntimeMove {
  key: DowntimeMoveKey
  /** made on an ally: nothing changes here */
  ally?: boolean
  /** a short rest's 1d4 + Tier as rolled */
  amount?: number
  /** Prepare with one or more members of the party */
  together?: boolean
  project?: string
  advance?: number
}

/** During a rest, each PC can make up to two downtime moves. */
export const downtimeMoveCount = 2

/** The dice a short rest's clearing moves roll. */
export function downtimeRoll(tier = 1) {
  return `1d4+${tier}`
}

/** Whether a move rolls before it can be made: a short rest's clearing ones, made on yourself. */
export function needsRoll(move: DowntimeMove, rest: Rest) {
  return rest === 'shortRest' && !move.ally && (move.key === 'wounds' || move.key === 'stress' || move.key === 'armor')
}

/** A track cleared by an amount, or all of it on a long rest; what it cleared. */
function clear(current = 0, rest: Rest, amount = 0) {
  const left = rest === 'longRest' ? 0 : Math.max(current - amount, 0)
  return { left, cleared: current - left }
}

/** Whether the character carries a Premium Bedroll: during downtime, it clears a Stress. */
export function hasBedroll(data: CharacterData) {
  return (data.inventory ?? []).some((item) => item.name?.trim().toLowerCase() === 'premium bedroll')
}

/**
 * Finishes a rest: makes the chosen moves on the character, the Premium Bedroll's Stress and a
 * Beastbound companion's (it clears the Stress the character's moves clear), then clears the uses
 * the rest brings back. Moves made on an ally change nothing here.
 */
export function finishRest(data: CharacterData, rest: Rest, moves: DowntimeMove[], hopeMaximum = 6) {
  let stressCleared = 0
  for (const move of moves) {
    if (move.ally) {
      continue
    }
    switch (move.key) {
      case 'wounds': {
        data.hp = { ...data.hp, current: clear(data.hp?.current, rest, move.amount).left }
        break
      }
      case 'stress': {
        const { left, cleared } = clear(data.stress?.current, rest, move.amount)
        data.stress = { ...data.stress, current: left }
        stressCleared += cleared
        break
      }
      case 'armor': {
        if (data.armor) {
          data.armor.marked = clear(data.armor.marked, rest, move.amount).left
        }
        break
      }
      case 'prepare': {
        data.hope = Math.min((data.hope ?? 0) + (move.together ? 2 : 1), hopeMaximum)
        break
      }
      case 'project': {
        const project = (data.projects ?? []).find((entry) => entry.id === move.project)
        if (project) {
          const advanced = (project.current ?? 0) + (move.advance ?? 1)
          project.current = project.maximum ? Math.min(advanced, project.maximum) : advanced
        }
        break
      }
    }
  }
  if (hasBedroll(data) && data.stress?.current) {
    data.stress = { ...data.stress, current: data.stress.current - 1 }
  }
  if (stressCleared && data.companion?.stress?.current) {
    data.companion.stress.current = Math.max(data.companion.stress.current - stressCleared, 0)
  }
  reset(data, rest)
}

/**
 * The features, loadout cards and items whose text names downtime or a rest, for reference: read
 * from the view, which carries their Markdown (views/transforms/character.json).
 */
export function downtimeFeatures(view: any): { name?: string, html?: string }[] {
  const mentions = (text?: string) => /downtime|during a (short |long )?rest|at the start of a rest/i.test(text ?? '')
  return [
    ...trackedFeatures(view).filter((feature) => mentions(feature.text)).map((feature: any) => ({ name: feature.name, html: feature.textHTML ?? feature.text })),
    ...((view.domainCards ?? []) as any[]).filter((card) => !card.vault && mentions(card.descr)).map((card) => ({ name: card.name, html: card.descrHTML })),
    ...((view.inventory ?? []) as any[]).filter((item) => mentions(item.descr)).map((item) => ({ name: item.name, html: item.descrHTML }))
  ]
}

// EQUIPMENT

type Weapon = NonNullable<CharacterData['weapons']>[number]

/** At most two weapons carried besides the active ones. */
export const inventoryWeaponLimit = 2

/** The hands the Active Weapons may take: a character's maximum burden. */
export const burdenLimit = 2

/** The hands the Active Weapons take: two for a two-handed weapon, one for any other. */
export function burden(data: CharacterData) {
  return (data.weapons ?? [])
    .filter((weapon) => weapon.equipped)
    .reduce((hands, weapon) => hands + (weapon.burden === 'twoHanded' ? 2 : 1), 0)
}

/** Whether the character ignores burden: the Warrior's Combat Training, a multiclass's too. */
export function ignoresBurden(data: CharacterData) {
  return trackedFeatures(data).some((feature) => feature.name?.trim().toLowerCase() === 'combat training')
}

/**
 * Equips a weapon in its category's slot, unequipping what it displaces: the other weapon of the
 * same category and, unless the character ignores burden, the secondary for a two-handed primary
 * or a two-handed primary for a secondary.
 */
export function equip(data: CharacterData, index: number) {
  const weapons = data.weapons ?? []
  const weapon = weapons[index]
  if (!weapon) {
    return
  }
  const free = ignoresBurden(data)
  for (const [other, entry] of weapons.entries()) {
    if (other === index || !entry.equipped) {
      continue
    }
    if (displaces(weapon, entry, free) || displaces(entry, weapon, free)) {
      entry.equipped = false
    }
  }
  weapon.equipped = true
}

function displaces(weapon: Weapon, other: Weapon, ignoringBurden: boolean) {
  if (weapon.category === other.category) {
    return true
  }
  // a two-handed primary takes both hands
  return !ignoringBurden && weapon.category === 'primary' && weapon.burden === 'twoHanded' && other.category === 'secondary'
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

/**
 * The advancement options in the printed sheet's words, the tiers they open at and their slots in
 * a tier; `double` takes both of a level's advancements.
 */
export const advancements = [
  { key: 'traits', label: 'Gain a +1 bonus to two unmarked character traits and mark them.', slots: 3, from: 2 },
  { key: 'hp', label: 'Permanently gain one Hit Point slot.', slots: 2, from: 2 },
  { key: 'stress', label: 'Permanently gain one Stress slot.', slots: 2, from: 2 },
  { key: 'experiences', label: 'Permanently gain a +1 bonus to two Experiences.', slots: 1, from: 2 },
  { key: 'domainCard', label: 'Choose an additional domain card of your level or lower from a domain you have access to.', slots: 1, from: 2 },
  { key: 'evasion', label: 'Permanently gain a +1 bonus to your Evasion.', slots: 1, from: 2 },
  { key: 'subclass', label: 'Take an upgraded subclass card. Then cross out the multiclass option for this tier.', slots: 1, from: 3 },
  { key: 'proficiency', label: 'Increase your Proficiency by +1.', slots: 2, from: 3, double: true },
  { key: 'multiclass', label: 'Multiclass: Choose an additional class for your character, then cross out an unused “Take an upgraded subclass card” and the other multiclass option on this sheet.', slots: 2, from: 3, double: true }
] as const

/** The Beastbound companion's level-up options in the SRD's words, with their slots. */
export const companionUpgrades = [
  { key: 'intelligent', slots: 3, text: 'Your companion gains a permanent +1 bonus to a Companion Experience of your choice.' },
  { key: 'lightInTheDark', slots: 1, text: 'Use this as an additional Hope slot your character can mark.' },
  { key: 'creatureComfort', slots: 1, text: 'Once per rest, when you take time during a quiet moment to give your companion love and attention, you can gain a Hope or you can both clear a Stress.' },
  { key: 'armored', slots: 1, text: 'When your companion takes damage, you can mark one of your Armor Slots instead of marking one of their Stress.' },
  { key: 'vicious', slots: 3, text: 'Increase your companion\'s damage dice or range by one step (d6 to d8, Close to Far, etc.).' },
  { key: 'resilient', slots: 3, text: 'Your companion gains an additional Stress slot.' },
  { key: 'bonded', slots: 1, text: 'When you mark your last Hit Point, your companion rushes to your side to comfort you. Roll a number of d6s equal to the unmarked Stress slots they have and mark them. If any roll a 6, your companion helps you up. Clear your last Hit Point and return to the scene.' },
  { key: 'aware', slots: 1, text: 'Your companion gains a permanent +2 bonus to their Evasion.' }
] as const

/** The tiers that advance, with their levels and what their first level brings by itself. */
export const advancementTiers = [
  { tier: 2, first: 2, last: 4, achievement: 'At level 2, gain an additional Experience at +2 and gain a +1 bonus to your Proficiency.' },
  { tier: 3, first: 5, last: 7, achievement: 'At level 5, gain an additional Experience at +2 and clear all marks on character traits. Then gain a +1 bonus to your Proficiency.' },
  { tier: 4, first: 8, last: 10, achievement: 'At level 8, gain an additional Experience at +2 and clear all marks on character traits. Then gain a +1 bonus to your Proficiency.' }
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
