<script lang="ts">
  import type { Character, CharacterSnapshot } from '../lib/character'
  import { set } from '../lib/change'
  import { t } from '../lib/labels'
  import Markdown from '../lib/Markdown.svelte'
  import Pips from '../lib/Pips.svelte'

  let { character, snapshot }: { character: Character, snapshot: CharacterSnapshot } = $props()

  const data = $derived(snapshot.model.data)
  // the Hope maximum: views/transforms/character.json
  const view = $derived(snapshot.view.data)

  /** Hope slots: six, and the companion's Light in the Dark; scars cross out the last ones. */
  const hopeSlots = $derived(6 + (data.companion?.upgrades?.lightInTheDark ?? 0))

  const hopeFeature = $derived(view.class?.hopeFeature)
</script>

<section class="box hope">
  <h3>{t('Common.Hope')} <small>{data.hope ?? 0} / {view.hopeMaximum ?? 6}</small></h3>
  <div class="track">
    <Pips value={data.hope} max={view.hopeMaximum} crossed={data.scars ?? 0} boxes={hopeSlots} shape="diamond" dividers label={t('Common.Hope')} onchange={(count) => set(character, 'data.hope', count)} />
  </div>
  <p class="note">Spend a Hope to use an Experience or help an ally.</p>
  {#if hopeFeature?.name}
    <div class="feature"><strong><em>{hopeFeature.name}:</em></strong> <Markdown html={hopeFeature.textHTML} /></div>
  {/if}
</section>
