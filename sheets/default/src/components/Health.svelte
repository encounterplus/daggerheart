<script lang="ts">
  import type { Character, CharacterSnapshot } from '../lib/character'
  import { set } from '../lib/change'
  import { t, tf } from '../lib/labels'
  import Pips from '../lib/Pips.svelte'

  let { character, snapshot }: { character: Character, snapshot: CharacterSnapshot } = $props()

  const data = $derived(snapshot.model.data)
  // the thresholds: views/transforms/character.json
  const view = $derived(snapshot.view.data)

  /** HP and Stress slots go up to 12; the maximum's are open. */
  const slots = 12
</script>

<section class="box health">
  <h3>{t('Character.DamageAndHealth')}</h3>
  <!-- marked HP by damage: below Major 1, from Major 2, from Severe 3 -->
  <div class="thresholds">
    <div class="severity"><strong>{t('Character.MinorDamage')}</strong><small>{tf('Character.MarkHP', { count: 1 })}</small></div>
    <div class="threshold" title={t('Common.MajorThreshold')}>{view.thresholds?.major ?? ''}</div>
    <div class="severity"><strong>{t('Character.MajorDamage')}</strong><small>{tf('Character.MarkHP', { count: 2 })}</small></div>
    <div class="threshold" title={t('Common.SevereThreshold')}>{view.thresholds?.severe ?? ''}</div>
    <div class="severity"><strong>{t('Character.SevereDamage')}</strong><small>{tf('Character.MarkHP', { count: 3 })}</small></div>
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
