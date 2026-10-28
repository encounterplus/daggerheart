<script lang="ts">
  import type { Character, CharacterSnapshot } from '../lib/character'
  import { t } from '../lib/labels.svelte'
  import { actionRoll, signed, traits } from '../lib/rules'
  import RollLink from '../lib/RollLink.svelte'

  let { snapshot }: { character: Character, snapshot: CharacterSnapshot } = $props()

  const data = $derived(snapshot.model.data)
  const marked = $derived(new Set(data.markedTraits ?? []))

  /** The label key of a trait: `Trait.Agility`. */
  function key(trait: string) {
    return `Trait.${trait[0].toUpperCase()}${trait.slice(1)}`
  }
</script>

<!-- each trait rolls the Duality Dice with its modifier; a dot marks a trait raised this tier -->
<div class="traits">
  {#each traits as trait}
    <div class="trait" class:marked={marked.has(trait)}>
      <div class="label">{t(key(trait))}</div>
      <div class="value">
        <RollLink formula={actionRoll(data.traits?.[trait])} label={t(key(trait))}>{signed(data.traits?.[trait])}</RollLink>
      </div>
    </div>
  {/each}
</div>
