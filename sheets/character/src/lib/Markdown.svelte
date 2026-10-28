<script lang="ts">
  // HTML the app rendered from Markdown (the transforms' `md`), shown as it is. Its dice links,
  // `/roll/<dice>/<name>`, roll through the SDK, so they work in a browser too; other links open
  // as links do.
  let { html }: { html?: string } = $props()

  function onclick(event: MouseEvent) {
    const link = (event.target as Element | null)?.closest?.('a[href^="/roll/"]')
    if (!link) {
      return
    }
    event.preventDefault()
    const [dice, label] = (link.getAttribute('href') ?? '').slice('/roll/'.length).split('/').map(decodeURIComponent)
    EP.roll(dice, label ? { label } : {}).catch((error) => console.warn('roll:', error.message))
  }
</script>

{#if html}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="markdown" {onclick}>{@html html}</div>
{/if}
