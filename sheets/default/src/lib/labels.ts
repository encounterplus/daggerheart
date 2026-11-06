// The system's texts, which come with the first state: main.ts mounts the sheet once it has the
// entity, so these never give keys.

export const { t, label } = EP

/** A weapon's or armor's properties under its name on Main: the set ones, `·` between. */
export function properties(...values: (string | undefined)[]) {
  return values.filter(Boolean).join(' · ')
}
