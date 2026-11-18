<script lang="ts">
  // A count drawn across checkboxes, as `EP.bind`'s `data-count`: the first `value` are ticked;
  // ticking one sets the count to it, unticking the last ticked lowers it by one. Boxes past
  // `max` are disabled, the last `crossed` of them crossed out (Hope slots lost to scars);
  // `dividers` rules them apart, as the printed Hope track.
  interface Props {
    value?: number
    boxes: number
    max?: number
    crossed?: number
    shape?: 'square' | 'round' | 'diamond'
    label?: string
    dividers?: boolean
    onchange: (count: number) => void
  }

  let { value = 0, boxes, max, crossed = 0, shape = 'square', label, dividers = false, onchange }: Props = $props()
</script>

<div class="pips {shape}">
  {#each { length: boxes } as _, index}
    {#if dividers && index}<span class="divider" aria-hidden="true"></span>{/if}
    <input
      type="checkbox"
      class:crossed={index >= boxes - crossed}
      checked={index < value}
      disabled={max !== undefined && index >= max}
      aria-label={label ? `${label} ${index + 1}` : undefined}
      onchange={(event) => {
        // Svelte writes `checked` only when `index < value` flips, so a box that keeps its state
        // (unticking the 2nd of 5 sets the count to 2) would be left as the browser toggled it:
        // put it back to what was drawn and let the new count redraw it.
        event.currentTarget.checked = index < value
        onchange(index + 1 === value ? index : index + 1)
      }}
    >
  {/each}
</div>
