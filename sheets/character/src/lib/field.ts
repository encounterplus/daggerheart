import type { Action } from 'svelte/action'

export interface FieldOptions {
  store: EPEntityStore
  /** The model path the input shows and writes: `data.hp.current`. */
  path: string
}

/**
 * Binds an input to a model path, the way `EP.bind`'s `data-bind` does: shows the value,
 * writes it on `change` (checkboxes as booleans, number inputs as numbers, an emptied input
 * removes the key), and leaves an input that is being edited alone until it loses focus.
 * A refused write puts the stored value back.
 *
 *   <input type="number" use:field={{ store: character, path: 'data.hp.current' }}>
 */
export const field: Action<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, FieldOptions> = (node, options) => {
  let current = options

  const isCheckbox = node instanceof HTMLInputElement && (node.type === 'checkbox' || node.type === 'radio')

  function render(force = false) {
    if (!force && !isCheckbox && document.activeElement === node) {
      return
    }
    const value = current.store.get(current.path)
    if (isCheckbox) {
      (node as HTMLInputElement).checked = Boolean(value)
    } else {
      const text = value === undefined || value === null ? '' : String(value)
      if (node.value !== text) {
        node.value = text
      }
    }
  }

  function read(): unknown {
    if (isCheckbox) {
      return (node as HTMLInputElement).checked
    }
    if (node.value === '') {
      return null
    }
    return node instanceof HTMLInputElement && node.type === 'number' ? Number(node.value) : node.value
  }

  function onChange() {
    current.store.set(current.path, read()).catch(() => render(true))
  }

  function onBlur() {
    render(true)
  }

  node.addEventListener('change', onChange)
  node.addEventListener('blur', onBlur)
  let unsubscribe = current.store.subscribe(() => render())

  return {
    update(next) {
      if (next.store !== current.store) {
        unsubscribe()
        current = next
        unsubscribe = current.store.subscribe(() => render())
      } else {
        current = next
        render()
      }
    },
    destroy() {
      node.removeEventListener('change', onChange)
      node.removeEventListener('blur', onBlur)
      unsubscribe()
    }
  }
}
