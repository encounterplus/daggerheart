<script lang="ts">
  // Removes a list entry once the user confirms it (lib/confirm).
  import { ask } from './confirm.svelte'

  let { name, onremove }: { name?: string, onremove: () => void } = $props()

  async function onclick() {
    if (await ask(`Remove ${name || 'this entry'}?`, 'Remove')) {
      onremove()
    }
  }
</script>

<!-- the icon: Lucide's trash-2 (ISC) -->
<button class="remove" aria-label="Remove" title="Remove" {onclick}>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    <line x1="10" x2="10" y1="11" y2="17" />
    <line x1="14" x2="14" y1="11" y2="17" />
  </svg>
</button>
