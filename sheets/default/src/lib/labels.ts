// The system's texts, which come with the first state: main.ts mounts the sheet once it has the
// entity, so these never give keys.

export const { t, label } = EP

/**
 * A text with its `{name}` placeholders filled in: `tf('Common.RollName', { name: 'Agility' })`.
 * A placeholder without a value stays as written.
 */
export function tf(key: string, values: Record<string, string | number>) {
  return t(key).replace(/\{(\w+)\}/g, (match, name) => (name in values ? String(values[name]) : match))
}

/** A weapon's or armor's properties under its name on Main: the set ones, `·` between. */
export function properties(...values: (string | undefined)[]) {
  return values.filter(Boolean).join(' · ')
}
