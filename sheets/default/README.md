# Character sheet

The Daggerheart character sheet, written in Svelte 5 over the Encounter+ sheet SDK
(`/_app/js/ep.js`, typed by `../../cache/ep.d.ts`, which the app writes when it loads the system). Opened for a character at
`/sheets/default/?id=<character-id>`, in the app and in a browser; the GM card
(`views/character.html`) links to it.

This folder is the sheet's own Node project. The app serves only the build, `dist/`
(`sheet.json`), so `dist/` is committed and the system needs no Node; `node_modules/` is not.

```sh
npm install        # once
npm run build      # dist/
npm run watch      # rebuilds dist/ on every change; reload the sheet to see it
npm run dev        # Vite with live reload, forwarding to the app's web server
npm run check      # svelte-check: types, including the model's from cache/schemas/character.d.ts
```

`npm run dev` serves the sheet at `http://localhost:5173/?id=<character-id>` and forwards the SDK,
system files, content and the API to the app's web server, `EP_SERVER` (default
`http://localhost:8080`, the beta app on this Mac); the SDK's web socket goes there directly.

- `src/lib/` — the store (`character.ts`), labels, `Pips`, `FeatureCard`, and the rules the sheet applies (`rules.ts`: tiers, rolls,
  usage limits and resets, the downtime moves, equipping, the loadout, gold, leveling up).
- `src/components/` — the header (traits, vitals) and the tabs.

Inputs write model paths (`data.hp.current`); displays read the view (`view.data.evasion`), where
`views/transforms/character.json` adds the derived values and the Markdown. The app checks every
write against `schemas/character.json`. The styles are the system's, `styles/default.css` (12).
