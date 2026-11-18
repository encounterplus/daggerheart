<script lang="ts">
  import type { Snippet } from 'svelte'
  import { tf } from './labels'

  // A dice link, `/roll/<dice>/<name>`, as the app writes them: the app rolls it, in the dice
  // roller, and the SDK does in a browser, with the result in ep-ui.js's banner.
  let { formula, label, children }: { formula: string, label?: string, children: Snippet } = $props()

  const href = $derived(`/roll/${encodeURIComponent(formula)}${label ? `/${encodeURIComponent(label)}` : ''}`)
</script>

<a {href} title={label ? tf('Common.RollName', { name: label }) : undefined}>{@render children()}</a>
