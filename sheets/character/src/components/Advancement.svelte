<script lang="ts">
  import type { Character, CharacterSnapshot } from '../lib/character'
  import { change, set } from '../lib/change'
  import { ask } from '../lib/confirm.svelte'
  import { field } from '../lib/field'
  import { t } from '../lib/labels.svelte'
  import { advancements, isTierAchievement, levelUp, newExperience, tier, traits } from '../lib/rules'
  import Pips from '../lib/Pips.svelte'

  let { character, snapshot }: { character: Character, snapshot: CharacterSnapshot } = $props()

  const data = $derived(snapshot.model.data)
  const level = $derived(data.level ?? 1)
  const current = $derived(tier(level))

  /** The tiers reached, newest first: their advancements, two a level. */
  const tiers = $derived([4, 3, 2].filter((entry) => entry <= current).map((entry) => {
    const key = `tier${entry}` as 'tier2' | 'tier3' | 'tier4'
    const marked = advancements.reduce((sum, option) => sum + (data.advancements?.[key]?.[option.key] ?? 0), 0)
    // levels gained in the tier: 2–4, 5–7, 8–10
    const first = entry === 2 ? 2 : entry === 3 ? 5 : 8
    const levels = Math.min(level, first + 2) - first + 1
    return { key, tier: entry, marked, allowed: levels * 2 }
  }))

  async function onLevelUp() {
    const next = level + 1
    const achievement = isTierAchievement(next)
    const message = achievement
      ? `Level up to ${next}: a new tier. You gain +1 Proficiency and a new Experience at +2${next >= 5 ? ', and your marked traits clear' : ''}. Then choose two advancements and a domain card.`
      : `Level up to ${next}? Then choose two advancements and a domain card.`
    if (!(await ask(message, 'Level up'))) {
      return
    }
    change(character, levelUp)
    if (achievement) {
      character.insert('data.experiences', { ...newExperience }).catch(() => {})
    }
  }

  function toggleMarked(trait: string, marked: boolean) {
    const current = new Set(data.markedTraits ?? [])
    if (marked) {
      current.add(trait as any)
    } else {
      current.delete(trait as any)
    }
    set(character, 'data.markedTraits', traits.filter((entry) => current.has(entry)))
  }

  function traitLabel(trait: string) {
    return t(`Trait.${trait[0].toUpperCase()}${trait.slice(1)}`)
  }
</script>

<section class="panel">
  <div class="panel-header">
    <h3>{t('Character.Advancement')} <small>{t('Common.Level')} {level} · {t(`Tier.Tier${current}`)}</small></h3>
    <div class="actions">
      <button class="outline" disabled={level >= 10} onclick={onLevelUp}>Level up</button>
    </div>
  </div>

  <!-- raised traits stay marked until the next tier achievement clears them -->
  <div class="marked-traits">
    <span class="label">{t('Character.MarkedTraits')}</span>
    {#each traits as trait}
      <label>
        <input type="checkbox" checked={(data.markedTraits ?? []).includes(trait)} onchange={(event) => toggleMarked(trait, event.currentTarget.checked)}>
        {traitLabel(trait)}
      </label>
    {/each}
  </div>

  {#each tiers as entry (entry.key)}
    <div class="advancements">
      <h4>{t(`Tier.Tier${entry.tier}`)} <small class:over={entry.marked > entry.allowed}>{entry.marked} / {entry.allowed}</small></h4>
      {#each advancements.filter((option) => option.from <= entry.tier) as option}
        <div class="advancement">
          <Pips value={data.advancements?.[entry.key]?.[option.key]} boxes={option.slots} label={option.label} onchange={(count) => set(character, `data.advancements.${entry.key}.${option.key}`, count)} />
          <span>{option.label}</span>
        </div>
      {/each}
    </div>
  {:else}
    <p class="empty">Advancements open at level 2.</p>
  {/each}

  <div class="grid-fields">
    <!-- Avoid Death: a Hope Die at or below the level crosses out a Hope slot -->
    <label>{t('Character.Scars')} <input type="number" min="0" max="6" use:field={{ store: character, path: 'data.scars' }}></label>
  </div>
</section>
