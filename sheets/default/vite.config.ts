import { defineConfig, type Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// The app's web server (the beta app on this Mac by default). `npm run dev` serves the sheet
// itself and forwards everything else there: the SDK, the system's files, content and the API.
const server = process.env.EP_SERVER ?? 'http://localhost:8080'

// The system's shared styles are linked from index.html and served by the app through the proxy,
// so Vite never sees them. Watch them and hot-swap the matching <link> when one changes.
function systemStyles(): Plugin {
  const dir = fileURLToPath(new URL('../../styles', import.meta.url))
  return {
    name: 'system-styles',
    apply: 'serve',
    configureServer(dev) {
      dev.watcher.add(dir)
      dev.watcher.on('change', (file) => {
        if (path.dirname(file) !== dir || !file.endsWith('.css')) return
        const url = `/systems/daggerheart/styles/${path.basename(file)}`
        dev.environments.client.hot.send({
          type: 'update',
          updates: [{ type: 'css-update', path: url, acceptedPath: url, timestamp: Date.now() }]
        })
      })
    }
  }
}

export default defineConfig({
  plugins: [svelte(), systemStyles()],
  // the sheet is served at /sheets/default/ in the app and in a browser: relative addresses only
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  define: {
    __EP_SERVER__: JSON.stringify(server)
  },
  server: {
    proxy: Object.fromEntries(['/systems', '/modules', '/campaigns', '/api', '/_app'].map((path) => [path, server]))
  }
})
