<script lang="ts">
  import type { Character, CharacterSnapshot } from '../lib/character'
  import { downtime } from '../lib/downtime.svelte'
  import { label, t } from '../lib/labels'
  import Reference from '../lib/Reference.svelte'

  let { character, snapshot }: { character: Character, snapshot: CharacterSnapshot } = $props()

  const model = $derived(snapshot.model)
  const view = $derived(snapshot.view.data)
  const portrait = $derived(character.resolvePath(model.image))

  /** The class's two domains and the multiclass's one. */
  const domainKeys = $derived([...(view.class?.domains ?? []), view.multiclass?.domain].filter(Boolean))
  const domains = $derived(domainKeys.map((domain) => label('Domain', domain)))

  const heritage = $derived([view.ancestry, view.community, view.transformation].filter((entry) => entry?.name))
</script>

<header class="sheet-title">
  {#if portrait}<img class="portrait" alt="portrait" src={portrait}>{/if}
  <!-- the name, then the domains' icons in a column of their own, on the plate (default.css) -->
  <div class="plate">
    <div class="name">
      <hgroup>
        <h1 class="title">{model.name ?? ''}</h1>
        <p class="subtitle">
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
    {#if domainKeys.length}
      <div class="domains">
        {#each domainKeys as domain, index}
          <span class="domain-icon" data-domain={domain} role="img" aria-label={domains[index]} title={domains[index]}></span>
        {/each}
      </div>
    {/if}
  </div>
  <!-- rests and downtime moves, in a panel from the right (components/Downtime) -->
  <button class="downtime-button" aria-label={t('Character.Downtime')} title={t('Character.Downtime')} onclick={() => (downtime.open = true)}>
    <!-- the icon: Lucide's tent (ISC) -->
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3.5 21 14 3" />
      <path d="M20.5 21 10 3" />
      <path d="M15.5 21 12 15l-3.5 6" />
      <path d="M2 21h20" />
    </svg>
  </button>
  <!-- the level on a shield in the corner, as the printed sheet's -->
  <div class="level shield">
    <div class="value">{view.level ?? 1}</div>
    <div class="label">{t('Common.Level')}</div>
  </div>
</header>
