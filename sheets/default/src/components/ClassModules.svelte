<script lang="ts">
  import type { Character, CharacterSnapshot } from '../lib/character'
  import { set } from '../lib/change'
  import { label, t } from '../lib/labels'
  import { addFromLibrary, copyKeys } from '../lib/library'
  import { actionRoll, companionUpgrades, damageRoll, signed } from '../lib/rules'
  import FeatureCard from '../lib/FeatureCard.svelte'
  import Markdown from '../lib/Markdown.svelte'
  import Pips from '../lib/Pips.svelte'
  import Reference from '../lib/Reference.svelte'
  import RemoveButton from '../lib/RemoveButton.svelte'
  import RollLink from '../lib/RollLink.svelte'

  let { character, snapshot }: { character: Character, snapshot: CharacterSnapshot } = $props()

  const data = $derived(snapshot.model.data)
  const view = $derived(snapshot.view.data)

  /** Whether the character's class (or multiclass) or subclass has a name, as the SRD's. */
  function has(name: string) {
    return [view.class?.name, view.multiclass?.class?.name, view.subclass?.name, view.multiclass?.subclass?.name]
      .some((entry) => entry?.toLowerCase() === name.toLowerCase())
  }

  // each module shows for the classes that use it, or once it holds anything
  const beastform = $derived(has('Druid') || Boolean(data.beastform?.name))
  const companion = $derived(has('Beastbound') || Boolean(data.companion))
  const stances = $derived(has('Martial Artist') || Boolean(data.stances?.known?.length))
  const patron = $derived(has('Warlock') || Boolean(data.patron))
  const strangePatterns = $derived(has('Wizard') || data.strangePattern !== undefined)

  function upgradeLabel(key: string) {
    return t(`CompanionUpgrade.${key[0].toUpperCase()}${key.slice(1)}`)
  }

  function chooseBeastform() {
    addFromLibrary(character, 'data.beastform', 'Beastform', copyKeys.Beastform, false)
  }
</script>

{#if beastform}
  <section class="panel">
    <div class="panel-header">
      <h3>{t('Entity.Beastform')}</h3>
      <div class="actions">
        <!-- marking a Stress to transform is the player's; Evolution spends 3 Hope instead -->
        <button class="outline" onclick={chooseBeastform}>{view.beastform?.name ? 'Change form' : 'Transform'}</button>
        {#if view.beastform?.name}
          <button class="outline" onclick={() => character.remove('data.beastform')}>Drop out</button>
        {/if}
      </div>
    </div>
    {#if view.beastform?.name}
      <p>
        <strong><Reference entry={view.beastform} /></strong>
        · {label('Trait', view.beastform.trait)} {signed(view.beastform.traitModifier ?? 0)}
        · {t('Common.Evasion')} {signed(view.beastform.evasionModifier ?? 0)}
        {#if view.beastform.advantages?.length}
          · {t('Beastform.GainAdvantageOn')} {view.beastform.advantages.map((advantage: string) => label('BeastformAdvantage', advantage)).join(', ')}
        {/if}
      </p>
      {#each view.beastform.features ?? [] as feature (feature.path)}
        <FeatureCard {character} {feature} path={feature.path} source={view.beastform.name} />
      {/each}
    {:else}
      <p class="empty">Not transformed.</p>
    {/if}
  </section>
{/if}

{#if companion}
  {@const attack = data.companion?.attack ?? {}}
  <section class="panel companion">
    <h3>{t('Character.Companion')}</h3>
    <div class="grid-fields">
      <label>{t('Common.Name')} <input type="text" use:EP.field={{ store: character, path: 'data.companion.name' }}></label>
      <label>{t('Common.Evasion')} <input type="number" use:EP.field={{ store: character, path: 'data.companion.evasion' }}></label>
    </div>
    <!-- as the character's Stress (Health): the companion marks one for any damage, and its last
         drops it out of the scene; three slots and the Resilient upgrades' (views/transforms) -->
    <div class="track stress">
      <div class="label">{t('Common.Stress')} <small>{data.companion?.stress?.current ?? 0} / {view.companion?.stressMaximum ?? 3}</small></div>
      <Pips value={data.companion?.stress?.current} max={view.companion?.stressMaximum ?? 3} boxes={6} label="Companion Stress" onchange={(count) => set(character, 'data.companion.stress.current', count)} />
    </div>
    <div class="grid-fields">
      <label>{t('Common.Attack')} <input type="text" use:EP.field={{ store: character, path: 'data.companion.attack.name' }}></label>
      <label>{t('Common.Damage')} <input type="text" placeholder="d6" use:EP.field={{ store: character, path: 'data.companion.attack.damage' }}></label>
      <label>{t('Common.Range')}
        <select use:EP.field={{ store: character, path: 'data.companion.attack.range' }}>
          <option value=""></option>
          {#each ['melee', 'veryClose', 'close', 'far', 'veryFar'] as range}<option value={range}>{label('Range', range)}</option>{/each}
        </select>
      </label>
    </div>
    {#if attack.damage}
      <!-- its damage uses the character's Proficiency -->
      <p>{t('Common.Damage')}: <RollLink formula={damageRoll(attack.damage, data.proficiency ?? 1)} label={`${data.companion?.name || t('Character.Companion')} damage`}>{damageRoll(attack.damage, data.proficiency ?? 1)}</RollLink></p>
    {/if}
    <h4>{t('Character.Experiences')}</h4>
    {#each data.companion?.experiences ?? [] as experience (experience.id)}
      <div class="row experience">
        <input type="text" aria-label="Experience" use:EP.field={{ store: character, path: `data.companion.experiences[${experience.id}].name` }}>
        <input type="number" class="modifier" aria-label="Modifier" use:EP.field={{ store: character, path: `data.companion.experiences[${experience.id}].modifier` }}>
        <RemoveButton name={experience.name} onremove={() => character.remove(`data.companion.experiences[${experience.id}]`)} />
      </div>
    {/each}
    <div class="actions">
      <button class="outline" onclick={() => character.insert('data.companion.experiences', { name: '', modifier: 2 })}>Add Experience</button>
    </div>
    <h4>{t('Character.CompanionUpgrades')}</h4>
    <!-- as the Advancement tab's options: the boxes, then the name and what it does -->
    <div class="upgrades">
      {#each companionUpgrades as upgrade}
        <div class="upgrade">
          <Pips value={data.companion?.upgrades?.[upgrade.key]} boxes={upgrade.slots} label={upgradeLabel(upgrade.key)} onchange={(count) => set(character, `data.companion.upgrades.${upgrade.key}`, count)} />
          <span><strong>{upgradeLabel(upgrade.key)}:</strong> {upgrade.text}</span>
        </div>
      {/each}
    </div>
  </section>
{/if}

{#if stances}
  <section class="panel">
    <h3>{t('Character.MartialStances')}</h3>
    <div class="grid-fields">
      <label>{t('Character.ActiveStance')}
        <select use:EP.field={{ store: character, path: 'data.stances.active' }}>
          <option value=""></option>
          {#each data.stances?.known ?? [] as stance}<option value={stance.name}>{stance.name}</option>{/each}
        </select>
      </label>
    </div>
    <div class="track focus">
      <div class="label">{t('Character.Focus')}</div>
      <Pips value={data.stances?.focus} boxes={6} shape="diamond" dividers label={t('Character.Focus')} onchange={(count) => set(character, 'data.stances.focus', count)} />
    </div>
    <!-- stances are written in the form (Main → Class Modules) -->
    {#each view.stances?.known ?? [] as stance (stance.path)}
      <FeatureCard {character} feature={stance} path={stance.path} source={stance.name === data.stances?.active ? 'Active' : undefined} />
    {/each}
  </section>
{/if}

{#if patron}
  <section class="panel">
    <h3>{t('Character.Patron')}</h3>
    <div class="grid-fields">
      <label>{t('Common.Name')} <input type="text" use:EP.field={{ store: character, path: 'data.patron.name' }}></label>
      <label>{t('Character.Spheres')} <input type="text" use:EP.field={{ store: character, path: 'data.patron.spheres' }}></label>
      <label>{t('Character.Favor')} <input type="number" min="0" use:EP.field={{ store: character, path: 'data.patron.favor' }}></label>
    </div>
  </section>
{/if}

{#if strangePatterns}
  <section class="panel strange-patterns">
    <h3>{t('Character.StrangePatterns')}</h3>
    <!-- rolling it on a Duality Die gains a Hope or clears a Stress; the number marked across twelve
         slots, as the companion's Stress; none is 1–12's nothing, so unmarking the last removes it -->
    <div class="track">
      <div class="label">Number <small>{data.strangePattern ?? '–'}</small></div>
      <Pips value={data.strangePattern} boxes={12} label={t('Character.StrangePatterns')} onchange={(count) => count ? set(character, 'data.strangePattern', count) : character.remove('data.strangePattern')} />
    </div>
  </section>
{/if}

<section class="panel">
  <h3>{t('Character.Resources')}</h3>
  <!-- trackers the schema has no field for: Prayer Dice, a Rally Die, a target Marked for Death -->
  {#each view.resources ?? [] as resource (resource.id)}
    <div class="resource">
      <div class="row">
        <input type="text" aria-label={t('Common.Name')} placeholder={t('Common.Name')} use:EP.field={{ store: character, path: `data.resources[${resource.id}].name` }}>
        <input type="number" class="modifier" min="0" aria-label={t('Common.Current')} title={t('Common.Current')} use:EP.field={{ store: character, path: `data.resources[${resource.id}].current` }}>
        <input type="number" class="modifier" min="0" aria-label={t('Common.Maximum')} title={t('Common.Maximum')} use:EP.field={{ store: character, path: `data.resources[${resource.id}].maximum` }}>
        <input type="text" class="modifier" aria-label={t('Character.Die')} placeholder="d6" use:EP.field={{ store: character, path: `data.resources[${resource.id}].die` }}>
        {#if resource.die}<RollLink formula={resource.die} label={resource.name}>Roll</RollLink>{/if}
        <RemoveButton name={resource.name} onremove={() => character.remove(`data.resources[${resource.id}]`)} />
      </div>
      <Markdown html={resource.textHTML} />
    </div>
  {/each}
  <div class="actions">
    <button class="outline" onclick={() => character.insert('data.resources', { name: '', current: 0 })}>Add Resource</button>
  </div>
</section>
