<script lang="ts">
  import type { Character, CharacterSnapshot } from '../lib/character'
  import { set } from '../lib/change'
  import { t } from '../lib/labels.svelte'
  import Markdown from '../lib/Markdown.svelte'
  import Pips from '../lib/Pips.svelte'

  let { character, snapshot }: { character: Character, snapshot: CharacterSnapshot } = $props()

  const data = $derived(snapshot.model.data)
  // Evasion, Armor Score, thresholds and the Hope maximum: views/transforms/character.json
  const view = $derived(snapshot.view.data)

  /** HP and Stress slots go up to 12; the maximum's are open. */
  const slots = 12

  /** Hope slots: six, and the companion's Light in the Dark; scars cross out the last ones. */
  const hopeSlots = $derived(6 + (data.companion?.upgrades?.lightInTheDark ?? 0))

  const hopeFeature = $derived(view.class?.hopeFeature)
</script>

<!-- the sheet header lays these out as its own (default.css: .vitals is `display: contents`) -->
<div class="vitals">
  <div class="defense">
    <div class="shield">
      <div class="value">{view.evasion ?? ''}</div>
      <div class="label">{t('Common.Evasion')}</div>
    </div>
    <div class="shield armor">
      <div class="value">{view.armorScore ?? 0}</div>
      <div class="label">{t('Character.ArmorScore')}</div>
    </div>
    <div class="armor-slots">
      <div class="label">Armor Slots <small>{data.armor?.marked ?? 0} / {view.armorScore ?? 0}</small></div>
      {#if data.armor && view.armorScore}
        <Pips value={data.armor.marked} boxes={view.armorScore} label="Armor Slots" onchange={(count) => set(character, 'data.armor.marked', count)} />
      {:else}
        <p class="empty">{data.armor?.name ? 'No Armor Slots.' : 'No armor equipped.'}</p>
      {/if}
    </div>
  </div>

  <section class="box health">
    <h3>{t('Character.DamageAndHealth')}</h3>
    <!-- marked HP by damage: below Major 1, from Major 2, from Severe 3 -->
    <div class="thresholds">
      <div class="severity"><strong>Minor Damage</strong><small>Mark 1 HP</small></div>
      <div class="threshold" title={t('Common.MajorThreshold')}>{view.thresholds?.major ?? ''}</div>
      <div class="severity"><strong>Major Damage</strong><small>Mark 2 HP</small></div>
      <div class="threshold" title={t('Common.SevereThreshold')}>{view.thresholds?.severe ?? ''}</div>
      <div class="severity"><strong>Severe Damage</strong><small>Mark 3 HP</small></div>
    </div>
    <div class="track hp">
      <div class="label">{t('Common.HP')} <small>{data.hp?.current ?? 0} / {data.hp?.maximum ?? 0}</small></div>
      <Pips value={data.hp?.current} max={data.hp?.maximum} boxes={slots} label={t('Common.HitPoints')} onchange={(count) => set(character, 'data.hp.current', count)} />
    </div>
    <div class="track stress">
      <div class="label">{t('Common.Stress')} <small>{data.stress?.current ?? 0} / {data.stress?.maximum ?? 0}</small></div>
      <Pips value={data.stress?.current} max={data.stress?.maximum} boxes={slots} label={t('Common.Stress')} onchange={(count) => set(character, 'data.stress.current', count)} />
    </div>
  </section>

  <section class="box hope">
    <h3>{t('Common.Hope')} <small>{data.hope ?? 0} / {view.hopeMaximum ?? 6}</small></h3>
    <div class="track">
      <Pips value={data.hope} max={view.hopeMaximum} crossed={data.scars ?? 0} boxes={hopeSlots} shape="diamond" label={t('Common.Hope')} onchange={(count) => set(character, 'data.hope', count)} />
    </div>
    <p class="note">Spend a Hope to use an Experience or help an ally.</p>
    {#if hopeFeature?.name}
      <div class="feature"><strong><em>{hopeFeature.name}:</em></strong> <Markdown html={hopeFeature.textHTML} /></div>
    {/if}
  </section>
</div>
