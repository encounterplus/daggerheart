<script lang="ts">
  import type { Character, CharacterSnapshot } from '../lib/character'
  import { cardModal } from '../lib/cardModal.svelte'
  import { label } from '../lib/labels'
  import Markdown from '../lib/Markdown.svelte'

  // A domain card as the printed card, in the dialog the ancestry view shows its card in
  // (views/ancestry.html, views/domain-card.html; dialog.card-modal in default.css). The text is
  // the character's copy; the image, which copies don't keep, its library entry's.
  let { character, snapshot }: { character: Character, snapshot: CharacterSnapshot } = $props()

  const systemURL = $derived(character.env?.systemURL ?? '/systems/daggerheart/')
  const card = $derived<any>((snapshot.view.data.domainCards ?? []).find((entry: any) => entry.id === cardModal.id))

  /** Library images by reference; `null` for an entry without one. */
  const images = $state<Record<string, string | null>>({})

  $effect(() => {
    const { reference, name } = card ?? {}
    if (reference && name && !(reference in images)) {
      images[reference] = null
      EP.query({ entity: 'DomainCard', where: { name }, limit: 20 })
        .then(({ entries }) => (images[reference] = entries.find((entry) => entry.reference === reference)?.image ?? null))
        .catch(() => {})
    }
  })

  const image = $derived((card?.reference && images[card.reference]) || `${systemURL}images/empty.png`)

  let dialog: HTMLDialogElement

  $effect(() => {
    if (card && !dialog.open) {
      dialog.showModal()
    } else if (!card && dialog.open) {
      // removed from the sheet while shown
      dialog.close()
    }
  })

  /** A tap on the backdrop hits the dialog itself, a tap on the card doesn't. */
  function onclick(event: MouseEvent) {
    if (event.target === dialog) {
      dialog.close()
    }
  }
</script>

<dialog class="card-modal" bind:this={dialog} {onclick} onclose={() => (cardModal.id = null)} aria-labelledby="card-modal-title">
  {#if card}
    <div class="modal-content">
      <div class="modal-header">
        <form method="dialog">
          <button class="modal-close" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </form>
        <h2 id="card-modal-title" class="modal-title">{card.name ?? ''}</h2>
      </div>

      <div class="card domain-card domain-{card.domain}">
        <img class="card-image" src={image} alt="" />

        <div class="card-header">
          <div class="card-banner">
            <img src="{systemURL}images/banners/banner-{card.domain}.webp" alt="" />
            <span class="card-level">{card.level ?? ''}</span>
          </div>
          <div class="card-recall">
            <img src="{systemURL}images/cost.webp" alt="" />
            <span>{card.recall ?? ''}</span>
          </div>
        </div>

        <div class="card-spacer"></div>

        <div class="card-content">
          <div class="card-divider">
            <img src="{systemURL}images/dividers/domain-divider-{card.domain}.png" alt="" />
            <span class="card-type">{label('DomainCardType', card.type)}</span>
          </div>

          <div class="card-text">
            <h2 class="card-title">{card.name ?? ''}</h2>
            {#if card.descrHTML}
              <div class="card-body"><Markdown html={card.descrHTML} /></div>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {/if}
</dialog>
