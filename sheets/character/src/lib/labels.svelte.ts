// The system's texts, which the SDK loads once the first state brings their address. `t` and
// `label` read `loaded`, so whatever renders them renders again when they arrive.

const labels = $state({ loaded: false })

/** Follows a store's states until the labels have loaded. */
export function loadLabels(store: EPEntityStore) {
  store.addEventListener('state', () => {
    if (!labels.loaded) {
      EP.labels().then((loaded) => {
        labels.loaded = labels.loaded || Boolean(loaded)
      })
    }
  })
}

/** The system's text for a key; the key until the labels load. */
export function t(key: string): string {
  void labels.loaded
  return EP.t(key)
}

/** The label of an enum key. */
export function label(name: string, value: unknown): string {
  void labels.loaded
  return EP.label(name, value)
}
