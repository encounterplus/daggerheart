<script lang="ts">
  import { character } from './lib/character'
  import { applyEnvironment } from './lib/environment'
  import { loadLabels, t } from './lib/labels.svelte'
  import { section, openSection } from './lib/section.svelte'
  import Header from './components/Header.svelte'
  import Vitals from './components/Vitals.svelte'
  import Traits from './components/Traits.svelte'
  import Main from './components/Main.svelte'
  import Features from './components/Features.svelte'
  import DomainCards from './components/DomainCards.svelte'
  import Inventory from './components/Inventory.svelte'
  import Background from './components/Background.svelte'
  import Footer from './components/Footer.svelte'
  import Status from './components/Status.svelte'
  import ConfirmDialog from './lib/ConfirmDialog.svelte'

  // the sheet renders from the store's snapshots; inputs write through `field` and the store
  if (character) {
    loadLabels(character)
    applyEnvironment(character)
  }

  const sections = $derived([
    { id: 'main', title: t('Character.Main'), component: Main },
    { id: 'features', title: t('Common.Features'), component: Features },
    { id: 'cards', title: t('Entity.DomainCard.many'), component: DomainCards },
    { id: 'inventory', title: t('Character.Inventory'), component: Inventory },
    { id: 'background', title: 'Background', component: Background }
  ])

  /** The open section; one remembered from an earlier sheet that no longer exists opens Main. */
  const open = $derived(sections.some(({ id }) => id === section.open) ? section.open : 'main')

  $effect(() => {
    document.title = $character?.model.name || 'Character'
  })
</script>

{#if character && $character}
  <!-- `sheet` tells it from the GM card (views/character.html), which shares `#character` (default.css) -->
  <main id="character" class="container-fluid sheet">
    <div class="sheet-header">
      <Header {character} snapshot={$character} />
      <Traits {character} snapshot={$character} />
      <Vitals {character} snapshot={$character} />
    </div>

    <div class="tab-bar band-tabs" role="tablist">
      {#each sections as { id, title }}
        <button role="tab" id="tab-{id}" aria-controls={id} aria-selected={open === id} onclick={() => openSection(id)}>{title}</button>
      {/each}
    </div>

    {#each sections as { id, component: Section }}
      <div {id} role="tabpanel" aria-labelledby="tab-{id}" hidden={open !== id}>
        <Section {character} snapshot={$character} />
      </div>
    {/each}

    <hr>
    <Footer {character} snapshot={$character} />
  </main>
  <Status {character} snapshot={$character} />
  <ConfirmDialog />
{:else}
  <main class="container">
    <p>No character: the sheet's address needs <code>?id=&lt;character-id&gt;</code>.</p>
  </main>
{/if}
