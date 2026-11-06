// A question the sheet asks before a change it can't take back, answered in ConfirmDialog: the
// page's own dialog, since the app's web view may not show the browser's `confirm`.

export const question = $state<{ message: string, action: string, resolve: ((ok: boolean) => void) | null }>({
  message: '',
  action: '',
  resolve: null
})

/** Asks; true when the user takes the action. A question still open is answered no. */
export function ask(message: string, action = 'OK'): Promise<boolean> {
  question.resolve?.(false)
  return new Promise((resolve) => {
    question.message = message
    question.action = action
    question.resolve = resolve
  })
}

export function answer(ok: boolean) {
  const resolve = question.resolve
  question.resolve = null
  resolve?.(ok)
}
