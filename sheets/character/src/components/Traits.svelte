<script lang="ts">
  import type { Character, CharacterSnapshot } from '../lib/character'
  import { set } from '../lib/change'
  import { t } from '../lib/labels.svelte'
  import { actionRoll, signed, traits } from '../lib/rules'
  import RollLink from '../lib/RollLink.svelte'

  let { character, snapshot }: { character: Character, snapshot: CharacterSnapshot } = $props()

  const data = $derived(snapshot.model.data)
  const marked = $derived(new Set(data.markedTraits ?? []))

  /** What each trait is rolled for, as the character sheet lists them. */
  const verbs: Record<string, string[]> = {
    agility: ['Sprint', 'Leap', 'Maneuver'],
    strength: ['Lift', 'Smash', 'Grapple'],
    finesse: ['Control', 'Hide', 'Tinker'],
    instinct: ['Perceive', 'Sense', 'Navigate'],
    presence: ['Charm', 'Perform', 'Deceive'],
    knowledge: ['Recall', 'Analyze', 'Comprehend']
  }

  /** The label key of a trait: `Trait.Agility`. */
  function key(trait: string) {
    return `Trait.${trait[0].toUpperCase()}${trait.slice(1)}`
  }

  /** Marks a trait raised this tier, or clears it; a tier achievement clears them all (rules). */
  function toggleMarked(trait: string) {
    const current = new Set(marked)
    if (!current.delete(trait as any)) current.add(trait as any)
    set(character, 'data.markedTraits', traits.filter((entry) => current.has(entry)))
  }
</script>

<!-- each trait rolls the Duality Dice with its modifier; the circle by its name marks a trait raised
     this tier, toggled by clicking the name; a dashed rule between two traits (default.css) -->
<div class="traits">
  {#each traits as trait, index}
    {#if index}<div class="divider" aria-hidden="true"></div>{/if}
    <div class="trait shield" class:marked={marked.has(trait)}>
      <button type="button" class="label" aria-pressed={marked.has(trait)} onclick={() => toggleMarked(trait)}>{t(key(trait))}</button>
      <div class="value">
        <RollLink formula={actionRoll(data.traits?.[trait])} label={t(key(trait))}>{signed(data.traits?.[trait])}</RollLink>
      </div>
      <div class="verbs">{#each verbs[trait] ?? [] as verb}<span>{verb}</span>{/each}</div>
    </div>
  {/each}
</div>
