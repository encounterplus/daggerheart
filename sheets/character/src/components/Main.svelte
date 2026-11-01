<script lang="ts">
  import type { Character, CharacterSnapshot } from '../lib/character'
  import { change, set } from '../lib/change'
  import { field } from '../lib/field'
  import { label, t } from '../lib/labels.svelte'
  import { actionRoll, damageRoll, reset, signed } from '../lib/rules'
  import Markdown from '../lib/Markdown.svelte'
  import Pips from '../lib/Pips.svelte'
  import Reference from '../lib/Reference.svelte'
  import RemoveButton from '../lib/RemoveButton.svelte'
  import RollLink from '../lib/RollLink.svelte'

  let { character, snapshot }: { character: Character, snapshot: CharacterSnapshot } = $props()

  const data = $derived(snapshot.model.data)
  const view = $derived(snapshot.view.data)
  const proficiency = $derived(data.proficiency ?? 1)

  /** The Active Weapons: the equipped ones, primary first. */
  const active = $derived(((view.weapons ?? []) as any[])
    .filter((weapon) => weapon.equipped)
    .sort((a, b) => (a.category === 'secondary' ? 1 : 0) - (b.category === 'secondary' ? 1 : 0)))

  const conditions = ['hidden', 'restrained', 'vulnerable'] as const

  let condition = $state('')

  function addCondition(event: SubmitEvent) {
    event.preventDefault()
    const name = condition.trim()
    if (name && !(data.otherConditions ?? []).includes(name)) {
      set(character, 'data.otherConditions', [...(data.otherConditions ?? []), name])
    }
    condition = ''
  }

  function removeCondition(name: string) {
    set(character, 'data.otherConditions', (data.otherConditions ?? []).filter((entry) => entry !== name))
  }

  /** A weapon's or armor's properties under its name, as in the Inventory: the set ones, `·` between. */
  function properties(...values: (string | undefined)[]) {
    return values.filter(Boolean).join(' · ')
  }

  /** The modifier a trait gives an attack: the character's, in a Beastform its bonus too. */
  function traitModifier(trait?: string) {
    return trait ? (data.traits as Record<string, number> | undefined)?.[trait] ?? 0 : 0
  }

  const resets = [
    { event: 'scene', title: 'End Scene', hint: 'Clears uses spent "once per scene"' },
    { event: 'shortRest', title: 'Short Rest', hint: 'Clears uses spent "once per rest" and "once per short rest"' },
    { event: 'longRest', title: 'Long Rest', hint: 'Clears uses spent "once per rest" and "once per long rest"' },
    { event: 'session', title: 'End Session', hint: 'Clears uses spent "once per session"' }
  ] as const
</script>

<section class="panel">
  <h3>Active Weapons</h3>
  <!-- the dice of a damage roll, as on the printed sheet's Active Weapons -->
  <div class="proficiency">
    <span class="label">{t('Common.Proficiency')}</span>
    <Pips value={proficiency} boxes={6} shape="round" label={t('Common.Proficiency')} onchange={(count) => set(character, 'data.proficiency', Math.max(count, 1))} />
  </div>
  {#if view.beastform?.name}
    <!-- a Beastform can't use weapons: its attack instead -->
    {@const attack = view.beastform.attack ?? {}}
    {@const trait = attack.trait ?? view.beastform.trait}
    <div class="weapon">
      <div class="name"><strong><Reference entry={view.beastform} /></strong></div>
      <small>{properties(t('Entity.Beastform'), label('Range', attack.range), attack.damage ? label('Damage', attack.damageType) : '')}</small>
      <div class="rolls">
        <RollLink formula={actionRoll(traitModifier(trait) + (view.beastform.traitModifier ?? 0))} label={attack.name || view.beastform.name}>{label('Trait', trait)} {signed(traitModifier(trait) + (view.beastform.traitModifier ?? 0))}</RollLink>
        {#if attack.damage}
          <RollLink formula={damageRoll(attack.damage, proficiency)} label={`${view.beastform.name} damage`}>{damageRoll(attack.damage, proficiency)}</RollLink>
        {/if}
      </div>
    </div>
  {:else}
    {#each active as weapon (weapon.path)}
      <div class="weapon">
        <div class="name"><strong><Reference entry={weapon} /></strong></div>
        <small>{properties(label('WeaponCategory', weapon.category), label('WeaponBurden', weapon.burden), label('Range', weapon.range), weapon.damage ? label('Damage', weapon.damageType) : '')}</small>
        {#if weapon.feature?.name}
          <div class="feature"><strong>{weapon.feature.name}:</strong> <Markdown html={weapon.featureHTML} /></div>
        {/if}
        <div class="rolls">
          <RollLink formula={actionRoll(traitModifier(weapon.trait))} label={weapon.name}>{label('Trait', weapon.trait)} {signed(traitModifier(weapon.trait))}</RollLink>
          {#if weapon.damage}
            <RollLink formula={damageRoll(weapon.damage, proficiency)} label={`${weapon.name} damage`}>{damageRoll(weapon.damage, proficiency)}</RollLink>
          {/if}
        </div>
      </div>
    {:else}
      <p class="empty">No weapon equipped: equip one on the Inventory tab.</p>
    {/each}
  {/if}
</section>

<section class="panel">
  <h3>{t('Character.ActiveArmor')}</h3>
  {#if view.armor?.name}
    <div class="active-armor">
      <div class="name"><strong><Reference entry={view.armor} /></strong></div>
      <small>{properties(label('Tier', view.armor.tier), `${t('Armor.BaseThresholds')} ${view.armor.thresholds?.major ?? '-'} / ${view.armor.thresholds?.severe ?? '-'}`, `${t('Armor.BaseScore')} ${view.armor.score ?? 0}`)}</small>
      {#if view.armor.feature?.name}
        <div class="feature"><strong>{view.armor.feature.name}:</strong> <Markdown html={view.armor.feature.textHTML} /></div>
      {/if}
    </div>
  {:else}
    <p class="empty">Unarmored: Armor Score 0, Major threshold your level, Severe twice your level. Equip armor on the Inventory tab.</p>
  {/if}
</section>

<section class="panel">
  <h3>{t('Character.Experiences')}</h3>
  <!-- spend a Hope to add one to a roll -->
  {#each data.experiences ?? [] as experience (experience.id)}
    <div class="row experience">
      <input type="text" aria-label="Experience" placeholder="Experience" use:field={{ store: character, path: `data.experiences[${experience.id}].name` }}>
      <input type="number" class="modifier" aria-label="Modifier" use:field={{ store: character, path: `data.experiences[${experience.id}].modifier` }}>
      <RemoveButton name={experience.name} onremove={() => character.remove(`data.experiences[${experience.id}]`).catch(() => {})} />
    </div>
  {/each}
  <div class="actions">
    <button class="outline" onclick={() => character.insert('data.experiences', { name: '', modifier: 2 }).catch(() => {})}>Add Experience</button>
  </div>
</section>

<section class="panel">
  <h3>{t('Character.Conditions')}</h3>
  <div class="conditions">
    {#each conditions as name}
      <label>
        <input type="checkbox" role="switch" use:field={{ store: character, path: `data.conditions.${name}` }}>
        {t(`Condition.${name[0].toUpperCase()}${name.slice(1)}`)}
      </label>
    {/each}
  </div>
  <div class="tags">
    {#each data.otherConditions ?? [] as name}
      <button class="tag" title="Remove" onclick={() => removeCondition(name)}>{name} ×</button>
    {/each}
  </div>
  <form class="row" onsubmit={addCondition}>
    <input type="text" placeholder={t('Character.OtherConditions')} bind:value={condition}>
    <button class="outline" type="submit">Add</button>
  </form>
</section>

<!-- uses come back as the features' and cards' texts say; HP, Stress, Hope and armor are the
     downtime moves the player chooses -->
<section class="panel resets">
  {#each resets as { event, title, hint }}
    <button class="outline" title={hint} onclick={() => change(character, (draft) => reset(draft, event))}>{title}</button>
  {/each}
</section>
