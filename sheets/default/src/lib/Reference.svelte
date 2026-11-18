<script lang="ts">
  // A copy's name, linked to its library entry when it has one; the link opens it the way the
  // app does (EP.open), in a browser too.
  let { entry }: { entry?: { name?: string, reference?: string } } = $props()

  function onclick(event: MouseEvent) {
    event.preventDefault()
    EP.open(entry!.reference!)
  }
</script>

{#if entry?.reference}<a href={entry.reference} {onclick}>{entry.name ?? ''}</a>{:else}{entry?.name ?? ''}{/if}
