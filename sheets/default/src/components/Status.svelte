<script lang="ts">
  import type { Character, CharacterSnapshot } from '../lib/character'
  import { notice } from '../lib/notice.svelte'

  let { character, snapshot }: { character: Character, snapshot: CharacterSnapshot } = $props()

  /** The last refusal, shown until a few seconds pass. */
  let refusal = $state<string | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined

  $effect(() => {
    const onError = (event: CustomEvent<EPErrorDetail>) => {
      refusal = event.detail.errors.map((error) => error.message).join('; ')
      clearTimeout(timer)
      timer = setTimeout(() => (refusal = null), 6000)
    }
    character.addEventListener('error', onError)
    return () => {
      character.removeEventListener('error', onError as EventListener)
      clearTimeout(timer)
    }
  })
</script>

{#if refusal}
  <p class="status refused" role="alert">Not saved: {refusal}</p>
{:else if notice.message}
  <!-- a rule the sheet applies said no (lib/notice) -->
  <p class="status refused" role="alert">{notice.message}</p>
{:else if snapshot.status !== 'connected'}
  <p class="status">{snapshot.status === 'connecting' ? 'Connecting…' : 'Disconnected — trying again'}</p>
{/if}

<style>
  .status {
    position: fixed;
    bottom: 0.75rem;
    left: 50%;
    transform: translateX(-50%);
    margin: 0;
    padding: 0.25rem 0.75rem;
    border-radius: 0.5rem;
    background: rgb(0 0 0 / 0.7);
    color: white;
    font-size: 0.85rem;
    z-index: 100;
  }

  .refused {
    background: rgb(160 30 30 / 0.85);
  }
</style>
