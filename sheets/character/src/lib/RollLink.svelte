<script lang="ts">
  import type { Snippet } from 'svelte'

  // A dice link: `/roll/<dice>/<name>` like the app's own, rolled through the SDK so it works in
  // a browser too (as Markdown.svelte does for rendered text).
  let { formula, label, children }: { formula: string, label?: string, children: Snippet } = $props()

  const href = $derived(`/roll/${encodeURIComponent(formula)}${label ? `/${encodeURIComponent(label)}` : ''}`)

  function onclick(event: MouseEvent) {
    event.preventDefault()
    // the result shows in the app's roller, or ep-ui.js's banner in a browser
    EP.roll(formula, label ? { label } : {}).catch((error) => console.warn('roll:', error.message))
  }
</script>

<a {href} {onclick} title={label ? `Roll ${label}` : undefined}>{@render children()}</a>
