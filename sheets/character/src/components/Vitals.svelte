<script lang="ts">
  import type { Character, CharacterSnapshot } from '../lib/character'
  import { set } from '../lib/change'
  import { t } from '../lib/labels.svelte'
  import Pips from '../lib/Pips.svelte'

  let { character, snapshot }: { character: Character, snapshot: CharacterSnapshot } = $props()

  const data = $derived(snapshot.model.data)
  // Evasion, Armor Score, thresholds and the Hope maximum: views/transforms/character.json
  const view = $derived(snapshot.view.data)

  /** HP and Stress slots go up to 12; the maximum's are open. */
  const slots = 12

  /** Hope slots: six, and the companion's Light in the Dark; scars cross out the last ones. */
  const hopeSlots = $derived(6 + (data.companion?.upgrades?.lightInTheDark ?? 0))
</script>

<div class="vitals">
  <div class="defense">
    <div class="stat">
      <div class="label">{t('Common.Evasion')}</div>
      <div class="value">{view.evasion ?? ''}</div>
    </div>
    <div class="stat armor">
      <div class="label">{t('Character.ArmorScore')}</div>
      <div class="value">{view.armorScore ?? 0}</div>
      {#if data.armor && view.armorScore}
        <Pips value={data.armor.marked} boxes={view.armorScore} label="Armor Slots" onchange={(count) => set(character, 'data.armor.marked', count)} />
      {/if}
    </div>
    <!-- marked HP by damage: below Major 1, from Major 2, from Severe 3 -->
    <div class="stat thresholds">
      <div class="label">{t('Common.Thresholds')}</div>
      <div class="value">
        <span title="Minor: mark 1 HP">1</span>
        <strong>{view.thresholds?.major ?? ''}</strong>
        <span title="Major: mark 2 HP">2</span>
        <strong>{view.thresholds?.severe ?? ''}</strong>
        <span title="Severe: mark 3 HP">3</span>
      </div>
    </div>
    <div class="stat">
      <div class="label">{t('Common.Proficiency')}</div>
      <Pips value={data.proficiency ?? 1} boxes={6} shape="round" label={t('Common.Proficiency')} onchange={(count) => set(character, 'data.proficiency', Math.max(count, 1))} />
    </div>
  </div>

  <div class="tracks">
    <div class="track">
      <div class="label">{t('Common.HP')} <small>{data.hp?.current ?? 0} / {data.hp?.maximum ?? 0}</small></div>
      <Pips value={data.hp?.current} max={data.hp?.maximum} boxes={slots} label={t('Common.HitPoints')} onchange={(count) => set(character, 'data.hp.current', count)} />
    </div>
    <div class="track">
      <div class="label">{t('Common.Stress')} <small>{data.stress?.current ?? 0} / {data.stress?.maximum ?? 0}</small></div>
      <Pips value={data.stress?.current} max={data.stress?.maximum} boxes={slots} label={t('Common.Stress')} onchange={(count) => set(character, 'data.stress.current', count)} />
    </div>
    <div class="track hope">
      <div class="label">{t('Common.Hope')} <small>{data.hope ?? 0} / {view.hopeMaximum ?? 6}</small></div>
      <Pips value={data.hope} max={view.hopeMaximum} crossed={data.scars ?? 0} boxes={hopeSlots} shape="diamond" label={t('Common.Hope')} onchange={(count) => set(character, 'data.hope', count)} />
    </div>
  </div>
</div>
