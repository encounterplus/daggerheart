<script lang="ts">
  import type { Character, CharacterSnapshot } from '../lib/character'
  import { label, t } from '../lib/labels.svelte'
  import Reference from '../lib/Reference.svelte'

  let { character, snapshot }: { character: Character, snapshot: CharacterSnapshot } = $props()

  const model = $derived(snapshot.model)
  const view = $derived(snapshot.view.data)
  const portrait = $derived(character.resolvePath(model.image))

  /** The class's two domains and the multiclass's one. */
  const domains = $derived([...(view.class?.domains ?? []), view.multiclass?.domain]
    .filter(Boolean)
    .map((domain) => label('Domain', domain)))

  const heritage = $derived([view.ancestry, view.community, view.transformation].filter((entry) => entry?.name))
</script>

<header class="sheet-title">
  {#if portrait}<img class="portrait" alt="portrait" src={portrait}>{/if}
  <div>
    <hgroup>
      <h1 class="title">{model.name ?? ''}</h1>
      <p class="subtitle">
        {t('Common.Level')} {view.level ?? 1}
        {#if view.class?.name}<Reference entry={view.class} />{/if}
        {#if view.subclass?.name}(<Reference entry={view.subclass} />){/if}
        {#if view.multiclass?.class?.name} / <Reference entry={view.multiclass.class} />
          {#if view.multiclass.subclass?.name}(<Reference entry={view.multiclass.subclass} />){/if}
        {/if}
      </p>
    </hgroup>
    <p class="heritage">
      {#each heritage as entry}<span><Reference {entry} /></span>{/each}
      {#if view.pronouns}<span>{view.pronouns}</span>{/if}
      {#if domains.length}<span>{domains.join(' & ')}</span>{/if}
    </p>
  </div>
</header>
