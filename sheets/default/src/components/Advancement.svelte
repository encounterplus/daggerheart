<script lang="ts">
  import type { Character, CharacterSnapshot } from '../lib/character'
  import { change, set } from '../lib/change'
  import { t } from '../lib/labels'
  import { advancements, advancementTiers, isTierAchievement, levelUp, newExperience, tier } from '../lib/rules'
  import Pips from '../lib/Pips.svelte'

  let { character, snapshot }: { character: Character, snapshot: CharacterSnapshot } = $props()

  const data = $derived(snapshot.model.data)
  const level = $derived(data.level ?? 1)
  const current = $derived(tier(level))

  /**
   * The three tiers side by side, as the printed sheet's, reached or not. A tier may take options
   * left in an earlier one, so the advancements are counted together: two a level past the first.
   */
  const tiers = $derived(advancementTiers.map((entry) => ({
    ...entry,
    key: `tier${entry.tier}` as 'tier2' | 'tier3' | 'tier4',
    reached: level >= entry.first
  })))
  const marked = $derived(tiers.reduce((sum, entry) =>
    sum + advancements.reduce((count, option) => count + (data.advancements?.[entry.key]?.[option.key] ?? 0), 0), 0))
  const allowed = $derived((level - 1) * 2)

  async function onLevelUp() {
    const next = level + 1
    const achievement = isTierAchievement(next)
    const message = achievement
      ? `Level up to ${next}: a new tier. You gain +1 Proficiency and a new Experience at +2${next >= 5 ? ', and your marked traits clear' : ''}. Then choose two advancements and a domain card.`
      : `Level up to ${next}? Then choose two advancements and a domain card.`
    if (!(await EP.confirm(message, { action: 'Level up' }))) {
      return
    }
    change(character, levelUp)
    if (achievement) {
      character.insert('data.experiences', { ...newExperience })
    }
  }

  /** The domain card option names its tier's highest level, but in the last tier. */
  function optionLabel(option: (typeof advancements)[number], entry: (typeof tiers)[number]) {
    return option.key === 'domainCard' && entry.tier < 4 ? `${option.label.slice(0, -1)} (up to level ${entry.last}).` : option.label
  }
</script>

<section class="panel">
  <div class="panel-header">
    <h3>{t('Character.Advancement')} <small>{t('Common.Level')} {level} · {t(`Tier.Tier${current}`)} · <span class:over={marked > allowed}>{marked} / {allowed}</span></small></h3>
    <div class="actions">
      <button class="outline" disabled={level >= 10} onclick={onLevelUp}>Level up</button>
    </div>
  </div>

  <!-- the printed sheet's three columns; a tier not reached yet faded, its boxes closed -->
  <div class="advancement-tiers">
    {#each tiers as entry (entry.key)}
      <div class="advancements" class:locked={!entry.reached}>
        <h4>{t(`TierLevels.Tier${entry.tier}`)}</h4>
        <p class="achievement">{entry.achievement}</p>
        <p class="note">Choose two options from the list below{entry.tier > 2 ? ' or any from the previous tier' : ''} and mark them.</p>
        <div class="options">
          {#each advancements.filter((option) => option.from <= entry.tier) as option}
            <div class="advancement" class:double={'double' in option}>
              <Pips value={data.advancements?.[entry.key]?.[option.key]} boxes={option.slots} max={entry.reached ? undefined : 0} label={option.label} onchange={(count) => set(character, `data.advancements.${entry.key}.${option.key}`, count)} />
              <span>{optionLabel(option, entry)}</span>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</section>
