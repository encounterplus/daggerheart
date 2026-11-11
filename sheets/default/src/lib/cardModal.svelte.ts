// The domain card shown in the card dialog (components/CardModal), by its id in data.domainCards:
// a card's "Open card" sets it, closing the dialog clears it.

export const cardModal = $state<{ id: string | null }>({ id: null })
