<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Character } from './character'
  import { change } from './change'
  import { report } from './notice.svelte'
  import { applyDuality, dualityOutcome } from './rules'

  // An action roll: the Duality Dice, rolled through the SDK so the sheet gets the result, then
  // what its outcome gives — a Hope, a Stress cleared, the GM's Fear. Shaped like RollLink, which
  // the styles know; the address is what a long-press or a copied link opens.
  let { character, formula, label, type = 'check', hopeMaximum, children }: {
    character: Character, formula: string, label?: string, type?: EPRollType, hopeMaximum?: number, children: Snippet
  } = $props()

  const href = $derived(`/roll/${encodeURIComponent(formula)}${label ? `/${encodeURIComponent(label)}` : ''}`)

  let rolling = $state(false)

  async function roll(event: MouseEvent) {
    event.preventDefault()
    if (rolling) {
      return
    }
    rolling = true
    try {
      // null when the roller closed before the dice stopped: nothing to give
      const outcome = dualityOutcome(await EP.roll(formula, { label, type }).catch(() => null))
      if (outcome === 'fear') {
        await EP.adjustResource('fear', 1).catch((error) => report(`The GM's Fear wasn't added: ${error.message}`))
      } else if (outcome) {
        change(character, (data) => applyDuality(data, outcome, hopeMaximum))
      }
    } finally {
      rolling = false
    }
  }
</script>

<a {href} title={label ? `Roll ${label}` : undefined} aria-busy={rolling} onclick={roll}>{@render children()}</a>
