import { mount } from 'svelte'
import App from './App.svelte'

// `npm run dev` serves the sheet from Vite: the SDK's web socket goes to the app's server
if (import.meta.env.DEV) {
  EP.configure({ server: __EP_SERVER__ })
}

mount(App, { target: document.getElementById('app')! })
