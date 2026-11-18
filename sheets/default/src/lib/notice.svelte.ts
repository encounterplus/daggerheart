// Messages the sheet itself shows in the status line (components/Status), beside the app's
// refusals: a rule the sheet applies saying no, such as a full loadout, and what it is busy with,
// such as a roll waiting for its dice.

export const notice = $state<{ message: string | null }>({ message: null })

let timer: ReturnType<typeof setTimeout> | undefined

export function report(message: string) {
  notice.message = message
  clearTimeout(timer)
  timer = setTimeout(() => (notice.message = null), 6000)
}

/** What the sheet is waiting on, `Rolling Agility…`; shown while nothing more pressing is. */
export const activity = $state<{ message: string | null }>({ message: null })

/** Shows `message` until the work is done; a later one replaces it, and its end clears only its own. */
export async function during<T>(message: string, work: () => Promise<T>): Promise<T> {
  activity.message = message
  try {
    return await work()
  } finally {
    if (activity.message === message) {
      activity.message = null
    }
  }
}
