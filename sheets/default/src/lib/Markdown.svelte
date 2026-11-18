<script lang="ts">
  // HTML the app rendered from Markdown (the transforms' `md`), shown as it is. Its dice links are
  // the SDK's and the app's to roll, in a browser too.
  let { html }: { html?: string } = $props()
</script>

{#if html}
  <div class="markdown">{@html html}</div>
{/if}
