// The view's environment applied to the page as views/partials/base.html does for the templates:
// the view theme (`data-view-theme` and its stylesheet, styles/themes/<theme>.css) and the app's
// extra stylesheets. A static page learns the environment from the first state, not a template.

let applied = false

/** Applies the environment once a store has it: on its first state. */
export function applyEnvironment(store: EPEntityStore) {
  const apply = () => {
    const env = store.env
    if (applied || !env) {
      return
    }
    applied = true

    const systemURL = env.systemURL ?? '/systems/daggerheart/'
    if (env.theme) {
      document.documentElement.dataset.viewTheme = env.theme
      link(`${systemURL}styles/themes/${env.theme}.css`)
    }
    for (const href of (env.styles as string[] | undefined) ?? []) {
      link(href)
    }
  }
  apply()
  store.addEventListener('state', apply)
}

function link(href: string) {
  const element = document.createElement('link')
  element.rel = 'stylesheet'
  element.type = 'text/css'
  element.href = href
  document.head.append(element)
}
