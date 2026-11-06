// A message the sheet itself shows in the status line (components/Status), beside the app's
// refusals: a rule the sheet applies saying no, such as a full loadout.

export const notice = $state<{ message: string | null }>({ message: null })

let timer: ReturnType<typeof setTimeout> | undefined

export function report(message: string) {
  notice.message = message
  clearTimeout(timer)
  timer = setTimeout(() => (notice.message = null), 6000)
}
