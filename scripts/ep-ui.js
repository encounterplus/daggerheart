/*
 * ep-ui.js — UI over the Encounter+ sheet SDK (experimental).
 *
 * The SDK, ep.js, draws nothing of its own. This script adds the UI it can offer, and loads after
 * it, for browsers: a search dialog for `EP.pick`, which has no library list there, set as the
 * SDK's picker; and a banner at the bottom right showing each `EP.roll`'s result, which no dice
 * roller shows there, set as its `onRoll`. A view that wants its own look leaves the script out and
 * passes its own to `EP.configure`, or lists entries with `EP.query`. In the app `EP.pick` is the
 * app's library list and rolls show in its dice roller, whatever is loaded.
 *
 * During development the working copy lives in the Dragonbane system (`scripts/ep-ui.js`), beside
 * ep.js; it moves into the app bundle, `/_app/js/ep-ui.js`, with it.
 */
(() => {
  'use strict'

  const EP = window.EP
  if (!EP) {
    console.warn('ep-ui.js: load ep.js first')
    return
  }

  // MARK: Picking in a browser

  /**
   * A plain search dialog over `EP.query`, for browsers, which have no library list. Resolves
   * with the entry picked, in a list, or an empty one when it is closed.
   */
  function pickInDialog({ entity }) {
    return new Promise((resolve) => {
      const dialog = document.createElement('dialog')
      dialog.className = 'ep-pick'
      dialog.innerHTML = '<article><header><input type="search" autocomplete="off"></header><ul></ul><footer><button type="button" class="secondary">Cancel</button></footer></article>'
      const input = dialog.querySelector('input')
      const list = dialog.querySelector('ul')
      input.placeholder = `Search ${EP.t(entity)}`
      let picked = []
      let searching = 0

      async function search() {
        const current = ++searching
        const entries = await EP.query({ entity, search: input.value, limit: 50 }).catch(() => [])
        if (current !== searching) {
          return
        }
        list.replaceChildren(...entries.map((entry) => {
          const item = document.createElement('li')
          const link = document.createElement('a')
          link.href = '#'
          link.textContent = entry.source ? `${entry.name} (${entry.source})` : entry.name
          link.addEventListener('click', (event) => {
            event.preventDefault()
            picked = [entry]
            dialog.close()
          })
          item.append(link)
          return item
        }))
      }

      let delay = null
      input.addEventListener('input', () => {
        clearTimeout(delay)
        delay = setTimeout(search, 200)
      })
      dialog.querySelector('button').addEventListener('click', () => dialog.close())
      dialog.addEventListener('close', () => {
        dialog.remove()
        resolve(picked)
      })

      document.body.append(dialog)
      dialog.showModal()
      search()
    })
  }

  // MARK: Roll results in a browser

  /** How long a result stays, and how many stay at once. */
  const rollTimeout = 6000
  const rollLimit = 4

  // the page's Pico colours where it has them, plain ones elsewhere; `all: unset` keeps a page's
  // button styles off the cards
  const rollStyles = `
    .ep-rolls {
      position: fixed;
      right: calc(1rem + env(safe-area-inset-right, 0px));
      bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
      z-index: 1000;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.5rem;
      pointer-events: none;
    }
    .ep-roll {
      all: unset;
      box-sizing: border-box;
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      column-gap: 1rem;
      min-width: 11rem;
      max-width: min(20rem, calc(100vw - 2rem));
      padding: 0.5rem 0.9rem;
      border-radius: 0.5rem;
      background: var(--pico-card-background-color, #fff);
      color: var(--pico-color, #222);
      box-shadow: 0 0.25rem 1rem rgb(0 0 0 / 25%);
      font: inherit;
      cursor: pointer;
      pointer-events: auto;
      animation: ep-roll-in 150ms ease-out;
    }
    .ep-roll:focus-visible {
      outline: 2px solid var(--pico-primary, #1b594d);
      outline-offset: 2px;
    }
    .ep-roll.leaving {
      opacity: 0;
      transition: opacity 150ms ease-in;
    }
    .ep-roll-name {
      overflow: hidden;
      font-weight: bold;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ep-roll-detail {
      grid-column: 1;
      font-size: 0.8em;
      opacity: 0.7;
    }
    .ep-roll-result {
      grid-row: 1 / span 2;
      grid-column: 2;
      font-size: 2em;
      font-weight: bold;
      line-height: 1;
    }
    @keyframes ep-roll-in {
      from { opacity: 0; transform: translateY(0.5rem); }
    }
    @media (prefers-reduced-motion: reduce) {
      .ep-roll { animation: none; }
      .ep-roll.leaving { transition: none; }
    }
  `

  let rollStack = null

  /** The banner's stack, added to the page on the first roll; a live region, so results are read out. */
  function rollStackElement() {
    if (rollStack?.isConnected) {
      return rollStack
    }
    const style = document.createElement('style')
    style.textContent = rollStyles
    document.head.append(style)
    rollStack = document.createElement('div')
    rollStack.className = 'ep-rolls'
    rollStack.setAttribute('role', 'status')
    rollStack.setAttribute('aria-live', 'polite')
    document.body.append(rollStack)
    return rollStack
  }

  /** Shows a roll's result at the bottom right: the label, the dice, the result; a tap dismisses it. */
  function showRoll({ name, formula, result, detail }) {
    const stack = rollStackElement()
    const card = document.createElement('button')
    card.type = 'button'
    card.className = 'ep-roll'
    card.title = 'Dismiss'

    const label = document.createElement('span')
    label.className = 'ep-roll-name'
    label.textContent = name || formula
    const value = document.createElement('span')
    value.className = 'ep-roll-result'
    value.textContent = result ?? '?'
    const dice = document.createElement('span')
    dice.className = 'ep-roll-detail'
    dice.textContent = detail ? `${formula} ${detail}` : formula
    card.append(label, value, dice)

    let timer = null
    function dismiss() {
      clearTimeout(timer)
      card.classList.add('leaving')
      setTimeout(() => card.remove(), 150)
    }
    card.addEventListener('click', dismiss)
    timer = setTimeout(dismiss, rollTimeout)

    stack.append(card)
    while (stack.children.length > rollLimit) {
      stack.firstElementChild.remove()
    }
  }

  // MARK: Entry point

  EP.configure({ picker: pickInDialog, onRoll: showRoll })
})()
