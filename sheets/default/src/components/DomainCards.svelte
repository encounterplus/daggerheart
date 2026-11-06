<script lang="ts">
  import type { Character, CharacterSnapshot } from '../lib/character'
  import { change, set } from '../lib/change'
  import { label, t } from '../lib/labels'
  import { addFromLibrary, copyKeys } from '../lib/library'
  import { loadoutLimit, moveToLoadout } from '../lib/rules'
  import FeatureCard from '../lib/FeatureCard.svelte'
  import Reference from '../lib/Reference.svelte'
  import RemoveButton from '../lib/RemoveButton.svelte'

  let { character, snapshot }: { character: Character, snapshot: CharacterSnapshot } = $props()

  // each card with `descrHTML` (the transforms), addressed by its id
  const cards = $derived<any[]>(snapshot.view.data.domainCards ?? [])
  const loadout = $derived(cards.filter((card) => !card.vault))
  const vault = $derived(cards.filter((card) => card.vault))
  const full = $derived(loadout.length >= loadoutLimit)

  function path(card: any) {
    return `data.domainCards[${card.id}]`
  }
</script>

{#snippet card(entry: any)}
  <FeatureCard {character} feature={entry} path={path(entry)} textKey="descr" source={`${label('Domain', entry.domain)} ${entry.level ?? ''} · ${label('DomainCardType', entry.type)}${entry.recall ? ` · Recall ${entry.recall}` : ''}`}>
    <div class="card-actions">
      {#if entry.reference}<Reference entry={{ name: 'Open card', reference: entry.reference }} />{/if}
      {#if entry.vault}
        <!-- free at the start of a rest; otherwise mark Stress equal to its Recall Cost -->
        <button class="outline" disabled={full} onclick={() => change(character, (draft) => moveToLoadout(draft, entry.id, false))}>To loadout</button>
        {#if entry.recall}
          <button class="outline" disabled={full} onclick={() => change(character, (draft) => moveToLoadout(draft, entry.id, true))}>Recall ({entry.recall} Stress)</button>
        {/if}
      {:else}
        <button class="outline" onclick={() => set(character, `${path(entry)}.vault`, true)}>To vault</button>
      {/if}
      <RemoveButton name={entry.name} onremove={() => character.remove(path(entry)).catch(() => {})} />
    </div>
  </FeatureCard>
{/snippet}

<section class="panel">
  <div class="panel-header">
    <h3>{t('Character.Loadout')} <small class:over={loadout.length > loadoutLimit}>{loadout.length} / {loadoutLimit}</small></h3>
    <div class="actions">
      <!-- a card gained at level-up can go straight into the loadout -->
      <button class="outline" onclick={() => addFromLibrary(character, 'data.domainCards', 'DomainCard', copyKeys.DomainCard)}>Add card</button>
    </div>
  </div>
  <div class="cards">
    {#each loadout as entry (entry.id)}
      {@render card(entry)}
    {:else}
      <p class="empty">No cards in the loadout.</p>
    {/each}
  </div>
</section>

{#if vault.length}
  <section class="panel">
    <h3>{t('Character.Vault')} <small>{vault.length}</small></h3>
    <div class="cards">
      {#each vault as entry (entry.id)}
        {@render card(entry)}
      {/each}
    </div>
  </section>
{/if}
