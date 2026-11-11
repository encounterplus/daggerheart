<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { Character } from './character'
  import { change } from './change'
  import { during, report } from './notice.svelte'
  import { actionRoll, applyDuality, dualityOutcome } from './rules'

  // An action roll: the Duality Dice, rolled through the SDK so the sheet gets the result, then
  // what its outcome gives — a Hope, a Stress cleared, the GM's Fear. A tap rolls it; its menu
  // (ep-ui.js: a right-click or a long press) offers what the app lists — the system's advantage
  // and disadvantage (config.json `dice.options`), the GM's roll in the other mode — and the
  // choice reaches it as an `ep-roll` event with the formula to roll, which it rolls as it does
  // a tap, outcome and all. Shaped like RollLink, which the styles know. While the dice are out,
  // the status line says so (components/Status), not the link: a spinner beside it was too much.
  let { character, modifier = 0, label, type = 'check', hopeMaximum, children }: {
    character: Character, modifier?: number, label?: string, type?: EPRollType, hopeMaximum?: number, children: Snippet
  } = $props()

  const href = $derived(`/roll/${encodeURIComponent(actionRoll(modifier))}${label ? `/${encodeURIComponent(label)}` : ''}`)

  let link: HTMLAnchorElement
  let rolling = false // one roll at a time per link; not drawn

  async function roll(formula = actionRoll(modifier), mode?: EPRollEventDetail['mode']) {
    if (rolling) {
      return
    }
    rolling = true
    try {
      // null when the roller closed before the dice stopped: nothing to give
      const result = await during(label ? `Rolling ${label}…` : 'Rolling…', () => EP.roll(formula, { label, type, mode }).catch(() => null))
      const outcome = dualityOutcome(result)
      if (outcome === 'fear') {
        await EP.adjustResource('fear', 1).catch((error) => report(`The GM's Fear wasn't added: ${error.message}`))
      } else if (outcome) {
        change(character, (data) => applyDuality(data, outcome, hopeMaximum))
      }
    } finally {
      rolling = false
    }
  }

  function onclick(event: MouseEvent) {
    event.preventDefault()
    roll()
  }

  // the menu's choice: this link rolls its formula, so the outcome is applied as a tap's is
  $effect(() => {
    const onMenuRoll = (event: Event) => {
      event.preventDefault()
      const { formula, mode } = (event as CustomEvent<EPRollEventDetail>).detail
      roll(formula, mode)
    }
    link.addEventListener('ep-roll', onMenuRoll)
    return () => link.removeEventListener('ep-roll', onMenuRoll)
  })
</script>

<a bind:this={link} {href} title={label ? `Roll ${label}` : undefined} {onclick}>{@render children()}</a>
