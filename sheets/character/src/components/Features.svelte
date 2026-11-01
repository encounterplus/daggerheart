<script lang="ts">
  import type { Character, CharacterSnapshot } from '../lib/character'
  import { field } from '../lib/field'
  import { label, t } from '../lib/labels.svelte'
  import FeatureCard from '../lib/FeatureCard.svelte'
  import ClassModules from './ClassModules.svelte'

  let { character, snapshot }: { character: Character, snapshot: CharacterSnapshot } = $props()

  // the copies' feature lists, each item with `textHTML` and its model `path` (the transforms)
  const view = $derived(snapshot.view.data)

  const ranks = ['foundation', 'specialization', 'mastery'] as const

  /** A subclass's features up to its rank; no rank is the foundation. */
  function unlocked(subclass: any): any[] {
    const rank = ranks.indexOf(subclass?.rank ?? 'foundation')
    return [
      ...(subclass?.foundations ?? []),
      ...(rank >= 1 ? subclass?.specializations ?? [] : []),
      ...(rank >= 2 ? subclass?.masteries ?? [] : [])
    ]
  }

  /** The heritage cards and the transformation, which sit beside the loadout. */
  const heritage = $derived([
    { entry: view.ancestry, kind: 'Entity.Ancestry' },
    { entry: view.community, kind: 'Entity.Community' },
    { entry: view.transformation, kind: 'Entity.Transformation' }
  ].filter(({ entry }) => entry?.name))
</script>

<!-- the class and subclass features, then the heritage and the class's own modules; side by side from a tablet (default.css) -->
<div class="feature-columns">
  <div class="column">
    {#if view.class?.name}
      <section class="panel">
        <h3>{view.class.name}</h3>
        {#if view.class.hopeFeature?.name}
          <FeatureCard {character} feature={view.class.hopeFeature} path="data.class.hopeFeature" source={t('Class.HopeFeature')} />
        {/if}
        {#each view.class.features ?? [] as feature (feature.path)}
          <FeatureCard {character} {feature} path={feature.path} source={t('Common.Class')} />
        {/each}
      </section>
    {/if}

    {#each [{ subclass: view.subclass, path: 'data.subclass' }, { subclass: view.multiclass?.subclass, path: 'data.multiclass.subclass' }] as { subclass, path }}
      {#if subclass?.name}
        <section class="panel">
          <div class="panel-header">
            <h3>{subclass.name}</h3>
            <!-- the last card taken unlocks its features and those before it -->
            <select aria-label="Rank" use:field={{ store: character, path: `${path}.rank` }}>
              {#each ranks as rank}<option value={rank}>{label('SubclassRank', rank)}</option>{/each}
            </select>
          </div>
          {#if subclass.spellcastTrait}<p class="note">{t('Subclass.SpellcastTrait')}: {label('Trait', subclass.spellcastTrait)}</p>{/if}
          {#each unlocked(subclass) as feature (feature.path)}
            <FeatureCard {character} {feature} path={feature.path} source={t('Entity.Subclass')} />
          {/each}
        </section>
      {/if}
    {/each}

    {#if view.multiclass?.class?.name}
      <section class="panel">
        <h3>{view.multiclass.class.name} <small>{t('Character.Multiclass')}</small></h3>
        {#each view.multiclass.class.features ?? [] as feature (feature.path)}
          <FeatureCard {character} {feature} path={feature.path} source={t('Common.Class')} />
        {/each}
      </section>
    {/if}
  </div>

  <div class="column">
    {#if heritage.length}
      <section class="panel">
        <h3>{t('Character.Heritage')}</h3>
        {#each heritage as { entry, kind }}
          {#each entry.features ?? [] as feature (feature.path)}
            <FeatureCard {character} {feature} path={feature.path} source={`${entry.name} · ${t(kind)}`} />
          {/each}
        {/each}
      </section>
    {/if}

    <ClassModules {character} {snapshot} />
  </div>
</div>
