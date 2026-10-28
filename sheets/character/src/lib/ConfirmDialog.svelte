<script lang="ts">
  // The sheet's one confirmation dialog (lib/confirm): open while a question waits; Escape or a
  // tap beside it answers no.
  import { question, answer } from './confirm.svelte'

  let dialog: HTMLDialogElement

  $effect(() => {
    if (question.resolve && !dialog.open) {
      dialog.showModal()
    } else if (!question.resolve && dialog.open) {
      dialog.close()
    }
  })

  function onclick(event: MouseEvent) {
    if (event.target === dialog) {
      answer(false)
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog class="confirm" bind:this={dialog} oncancel={() => answer(false)} {onclick}>
  <article>
    <p>{question.message}</p>
    <footer>
      <button class="secondary outline" onclick={() => answer(false)}>Cancel</button>
      <button class="danger" onclick={() => answer(true)}>{question.action}</button>
    </footer>
  </article>
</dialog>
