<script lang="ts">
  import type { Character, CharacterSnapshot } from '../lib/character'
  import { set } from '../lib/change'
  import { t } from '../lib/labels.svelte'
  import Pips from '../lib/Pips.svelte'

  let { character, snapshot }: { character: Character, snapshot: CharacterSnapshot } = $props()

  const data = $derived(snapshot.model.data)
  // Evasion and the Armor Score: views/transforms/character.json
  const view = $derived(snapshot.view.data)
</script>

<!-- the sheet header lays these out as its own (default.css: .vitals is `display: contents`) -->
<div class="vitals">
  <div class="defense">
    <div class="shield">
      <div class="value">{view.evasion ?? ''}</div>
      <div class="label">{t('Common.Evasion')}</div>
    </div>
    <div class="divider" aria-hidden="true"></div>
    <div class="shield armor">
      <div class="value">{view.armorScore ?? 0}</div>
      <div class="label">{t('Entity.Armor')}</div>
    </div>
    <div class="armor-slots">
      <!-- <div class="label">Armor Slots <small>{data.armor?.marked ?? 0} / {view.armorScore ?? 0}</small></div> -->
      {#if data.armor?.unequipped}
        <!-- its marked slots stay with it until it's back on -->
        <p class="empty">{data.armor.name} taken off.</p>
      {:else if data.armor && view.armorScore}
        <Pips value={data.armor.marked} boxes={view.armorScore} label="Armor Slots" onchange={(count) => set(character, 'data.armor.marked', count)} />
      {:else}
        <p class="empty">{data.armor?.name ? 'No Armor Slots.' : 'No armor equipped.'}</p>
      {/if}
    </div>
  </div>
  <!-- the rule between the defense and the traits, when they share a row (default.css) -->
  <div class="defense-divider" aria-hidden="true"></div>
</div>
