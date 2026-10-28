<script lang="ts">
  import type { Character, CharacterSnapshot } from '../lib/character'
  import { change, set } from '../lib/change'
  import { field } from '../lib/field'
  import { label, t } from '../lib/labels.svelte'
  import { addFromLibrary, copyKeys } from '../lib/library'
  import { ask } from '../lib/confirm.svelte'
  import { addGold, equip, inventoryWeaponLimit } from '../lib/rules'
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

  async function chooseArmor() {
    // the marked slots stay with the armor they were marked on
    if (data.armor?.marked && !(await ask(`${data.armor.name} has ${data.armor.marked} marked Armor Slots. Replace it?`, 'Replace'))) {
      return
    }
    addFromLibrary(character, 'data.armor', 'Armor', copyKeys.Armor, false)
  }

  const coins = [
    { unit: 'handfuls', label: 'Gold.Handfuls', boxes: 9 },
    { unit: 'bags', label: 'Gold.Bags', boxes: 9 },
    { unit: 'chests', label: 'Gold.Chests', boxes: 1 }
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
</section>

<section class="panel">
  <div class="panel-header">
    <h3>{t('Character.ActiveArmor')}</h3>
    <div class="actions">
      <button class="outline" onclick={chooseArmor}>{data.armor?.name ? 'Change armor' : 'Choose armor'}</button>
      {#if data.armor?.name}<RemoveButton name={data.armor.name} onremove={() => character.remove('data.armor').catch(() => {})} />{/if}
    </div>
  </div>
  {#if view.armor?.name}
    <p>
      <strong><Reference entry={view.armor} /></strong>
      · {t('Armor.BaseThresholds')} {view.armor.thresholds?.major ?? '-'} / {view.armor.thresholds?.severe ?? '-'}
      · {t('Armor.BaseScore')} {view.armor.score ?? 0}
    </p>
    {#if view.armor.feature?.name}<div class="feature"><em>{view.armor.feature.name}:</em> <Markdown html={view.armor.feature.textHTML} /></div>{/if}
  {:else}
    <p class="empty">Unarmored: Armor Score 0, Major threshold your level, Severe twice your level.</p>
  {/if}
</section>

<section class="panel">
  <h3>{t('Character.Gold')}</h3>
  <!-- the tenth mark in a category clears it and marks one in the next -->
  <div class="gold">
    {#each coins as coin}
      <div class="coin">
        <span class="label">{t(coin.label)}</span>
        <Pips value={data.gold?.[coin.unit]} boxes={coin.boxes} shape="round" label={t(coin.label)} onchange={(count) => set(character, `data.gold.${coin.unit}`, count)} />
        <button class="outline" aria-label="Add one" onclick={() => change(character, (draft) => addGold(draft, coin.unit))}>+</button>
      </div>
    {/each}
  </div>
</section>

<section class="panel">
  <div class="panel-header">
    <h3>{t('Character.Inventory')}</h3>
    <div class="actions">
      <button class="outline" onclick={() => character.insert('data.inventory', { name: '', quantity: 1 }).catch(() => {})}>Add item</button>
    </div>
  </div>
  {#each view.inventory ?? [] as item (item.path)}
    <div class="item">
      <div class="row">
        <input type="text" aria-label={t('Common.Name')} placeholder={t('Common.Name')} use:field={{ store: character, path: `${item.path}.name` }}>
        <input type="number" class="modifier" min="0" aria-label={t('Common.Quantity')} title={t('Common.Quantity')} use:field={{ store: character, path: `${item.path}.quantity` }}>
        <RemoveButton name={item.name} onremove={() => character.remove(item.path).catch(() => {})} />
      </div>
      <Markdown html={item.textHTML} />
    </div>
  {:else}
    <p class="empty">Nothing carried.</p>
  {/each}
</section>
