// The view theme's stylesheet, styles/themes/<theme>.css, as views/partials/base.html links it for
// the templates. The SDK sets `data-view-theme` and links the app's extra stylesheets; which file a
// theme means is this system's to say.

/** Links the view theme's stylesheet; main.ts calls it once the store has the environment. */
export function linkTheme(store: EPEntityStore) {
  const { theme, systemURL = '/systems/daggerheart/' } = store.env ?? {}
  if (theme) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `${systemURL}styles/themes/${theme}.css`
    document.head.append(link)
  }
}
