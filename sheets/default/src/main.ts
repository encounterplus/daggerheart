import { mount } from 'svelte'
import App from './App.svelte'
import { character } from './lib/character'
import { linkTheme } from './lib/environment'

// `npm run dev` serves the sheet from Vite: the SDK's web socket goes to the app's server
if (import.meta.env.DEV) {
  EP.configure({ server: __EP_SERVER__ })
}

const target = document.getElementById('app')!

/** Says why there is no sheet. */
function explain(message: string) {
  const main = target.appendChild(document.createElement('main'))
  main.className = 'container'
  main.appendChild(document.createElement('p')).textContent = message
}

// the sheet mounts with the entity and the system's labels: in the app from its first frame, which
// is handed the first state, in a browser when the subscription answers
if (character) {
  character.connect().then(
    (store) => {
      linkTheme(store)
      mount(App, { target, props: { character: store } })
    },
    (error) => explain(`No character: ${error.message}`)
  )
} else {
  explain('No character: the sheet\'s address needs ?id=<character-id>.')
}
