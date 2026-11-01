<script lang="ts">
  import type { Character, CharacterSnapshot } from '../lib/character'
  import { change, set } from '../lib/change'
  import { field } from '../lib/field'
  import { label, t } from '../lib/labels.svelte'
  import { addFromLibrary, copyKeys } from '../lib/library'
  import { ask } from '../lib/confirm.svelte'
  import { burden, burdenLimit, equip, ignoresBurden, inventoryWeaponLimit } from '../lib/rules'
  import Markdown from '../lib/Markdown.svelte'
  import Pips from '../lib/Pips.svelte'
  import Reference from '../lib/Reference.svelte'
  import RemoveButton from '../lib/RemoveButton.svelte'

  let { character, snapshot }: { character: Character, snapshot: CharacterSnapshot } = $props()

  const data = $derived(snapshot.model.data)
  // weapons and items with their model `path` and Markdown (the transforms)
  const view = $derived(snapshot.view.data)
  const weapons = $derived<any[]>(view.weapons ?? [])
  const carried = $derived(weapons.filter((weapon) => !weapon.equipped).length)
  const hands = $derived(burden(data))

  async function chooseArmor() {
    // the new armor comes without marked slots
    if (data.armor?.marked && !(await ask(`${data.armor.name} has ${data.armor.marked} marked Armor Slots. Replace it?`, 'Replace'))) {
      return
    }
    addFromLibrary(character, 'data.armor', 'Armor', copyKeys.Armor, false)
  }

  const coins = [
    { unit: 'handfuls', label: 'Gold.Handfuls', boxes: 9 },
    { unit: 'bags', label: 'Gold.Bags', boxes: 9 },
    { unit: 'chests', label: 'Gold.Chest', boxes: 1 }
  ] as const
</script>

<section class="panel">
  <div class="panel-header">
    <h3>{t('Entity.Weapon.many')}</h3>
    <div class="actions">
      <button class="outline" onclick={() => addFromLibrary(character, 'data.weapons', 'Weapon', copyKeys.Weapon)}>Add weapon</button>
    </div>
  </div>
  <!-- equipping swaps out what it displaces: swapping outside a rest or calm marks a Stress -->
  <div class="table-responsive">
    <table class="weapons">
      <thead>
        <tr>
          <th>{t('Common.Name')}</th>
          <th>{t('Common.Trait')}</th>
          <th>{t('Common.Range')}</th>
          <th>{t('Common.Damage')}</th>
          <th>{t('Weapon.Burden')}</th>
          <th>Active</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each weapons as weapon, index (weapon.path)}
          <tr class:equipped={weapon.equipped}>
            <td>
              <strong><Reference entry={weapon} /></strong>
              <small>{label('WeaponCategory', weapon.category)}{weapon.tier ? ` · ${label('Tier', weapon.tier)}` : ''}</small>
              {#if weapon.feature?.name}<div class="feature"><em>{weapon.feature.name}:</em> <Markdown html={weapon.featureHTML} /></div>{/if}
            </td>
            <td>{label('Trait', weapon.trait)}</td>
            <td>{label('Range', weapon.range)}</td>
            <td>{weapon.damage ?? ''} {label('Damage', weapon.damageType)}</td>
            <td>{label('WeaponBurden', weapon.burden)}</td>
            <td>
              <input type="checkbox" role="switch" aria-label="Active" checked={Boolean(weapon.equipped)}
                onchange={(event) => event.currentTarget.checked
                  ? change(character, (draft) => equip(draft, index))
                  : set(character, `${weapon.path}.equipped`, false)}>
            </td>
            <td><RemoveButton name={weapon.name} onremove={() => character.remove(weapon.path).catch(() => {})} /></td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if carried > inventoryWeaponLimit}
    <p class="warning">A character carries at most {inventoryWeaponLimit} Inventory Weapons besides the active ones ({carried} now).</p>
  {/if}
  {#if hands > burdenLimit && !ignoresBurden(data)}
    <p class="warning">The Active Weapons take {hands} hands; a character has {burdenLimit}.</p>
  {/if}
</section>

<section class="panel">
  <div class="panel-header">
    <h3>{t('Entity.Armor')}</h3>
    <div class="actions">
      <button class="outline" onclick={chooseArmor}>{data.armor?.name ? 'Change armor' : 'Choose armor'}</button>
    </div>
  </div>
  <!-- one armor at a time, the Active Armor: removing or replacing it clears its marked slots;
       taken off (not in danger or under pressure), it keeps them but gives no protection -->
  <div class="table-responsive">
    <table class="equipment">
      <thead>
        <tr>
          <th>{t('Common.Name')}</th>
          <th>{t('Armor.BaseThresholds')}</th>
          <th>{t('Armor.BaseScore')}</th>
          <th>{t('Character.Marked')}</th>
          <th>Active</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#if view.armor?.name}
          <tr class:equipped={!view.armor.unequipped}>
            <td>
              <strong><Reference entry={view.armor} /></strong>
              {#if view.armor.tier}<small>{label('Tier', view.armor.tier)}</small>{/if}
              {#if view.armor.feature?.name}<div class="feature"><em>{view.armor.feature.name}:</em> <Markdown html={view.armor.feature.textHTML} /></div>{/if}
            </td>
            <td>{view.armor.thresholds?.major ?? '-'} / {view.armor.thresholds?.severe ?? '-'}</td>
            <td>{view.armor.score ?? 0}</td>
            <td>{view.armor.marked ?? 0}</td>
            <td>
              <input type="checkbox" role="switch" aria-label="Active" checked={!view.armor.unequipped}
                onchange={(event) => set(character, 'data.armor.unequipped', !event.currentTarget.checked)}>
            </td>
            <td><RemoveButton name={view.armor.name} onremove={() => character.remove('data.armor').catch(() => {})} /></td>
          </tr>
        {:else}
          <tr><td colspan="6" class="empty">Unarmored: Armor Score 0, Major threshold your level, Severe twice your level.</td></tr>
        {/if}
      </tbody>
    </table>
  </div>
</section>

<section class="panel">
  <div class="panel-header">
    <h3>{t('Character.Inventory')}</h3>
    <div class="actions">
      <button class="outline" onclick={() => addFromLibrary(character, 'data.inventory', 'Item', copyKeys.Item)}>Add item</button>
    </div>
  </div>
  <!-- the gold first, in its own box, the items under it -->
  <div class="gold">
    <h4>{t('Character.Gold')}</h4>
    <div class="coins">
      {#each coins as coin}
        <div class="coin {coin.unit}">
          <Pips value={data.gold?.[coin.unit]} boxes={coin.boxes} label={t(coin.label)} onchange={(count) => set(character, `data.gold.${coin.unit}`, count)} />
          <span class="label">{t(coin.label)}</span>
        </div>
      {/each}
    </div>
  </div>
  <!-- as the weapons: the name with its rarity and description, then the quantity; names are
       edited in the item's form -->
  <div class="table-responsive">
    <table class="items">
      <thead>
        <tr>
          <th>{t('Common.Name')}</th>
          <th>{t('Common.QuantityShort')}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each view.inventory ?? [] as item (item.path)}
          <tr>
            <td>
              <strong><Reference entry={item} /></strong>
              {#if item.rarity}<small>{label('Rarity', item.rarity)}</small>{/if}
              <Markdown html={item.descrHTML} />
            </td>
            <td>
              <!-- library copies come without a quantity: one -->
              <input type="number" class="quantity" min="0" placeholder="1" aria-label={t('Common.Quantity')} use:field={{ store: character, path: `${item.path}.quantity` }}>
            </td>
            <td><RemoveButton name={item.name} onremove={() => character.remove(item.path).catch(() => {})} /></td>
          </tr>
        {:else}
          <tr><td colspan="3" class="empty">Nothing carried.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</section>
