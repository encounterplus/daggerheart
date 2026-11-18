<script lang="ts">
  import type { Character } from './character'
  import { set } from './change'
  import { placesTokens, usageLimit } from './rules'
  import Markdown from './Markdown.svelte'
  import { t } from './labels'

  // A feature or domain card as the character carries it: its text, and the tokens on it and
  // its spent use when its text places tokens or names a usage limit (or some are already set).
  interface Props {
    character: Character
    /** The view's copy: `textHTML` (or `descrHTML`) from the transforms. */
    feature: Record<string, any>
    /** Its model path, which `tokens` and `used` are written under. */
    path: string
    /** Where it comes from: `Brawler`, `Hope Feature`. */
    source?: string
    /** The text field: `text` on features, `descr` on domain cards. */
    textKey?: 'text' | 'descr'
    children?: import('svelte').Snippet
  }

  let { character, feature, path, source, textKey = 'text', children }: Props = $props()

  const text = $derived<string | undefined>(feature[textKey])
  const limit = $derived(usageLimit(text))
  const tokens = $derived(placesTokens(text) || (feature.tokens ?? 0) > 0)

  const limits = { scene: 'UsageLimit.Scene', rest: 'UsageLimit.Rest', shortRest: 'UsageLimit.ShortRest', longRest: 'UsageLimit.LongRest', session: 'UsageLimit.Session' }
</script>

<article class="feature-card" class:used={feature.used}>
  <header>
    <strong>{feature.name ?? ''}</strong>
    {#if source}<small>{source}</small>{/if}
  </header>
  {@render children?.()}
  <Markdown html={feature[`${textKey}HTML`]} />
  {#if tokens || limit || feature.used}
    <footer>
      {#if tokens}
        <div class="tokens">
          <span>{t('Character.Tokens')}</span>
          <button class="outline" aria-label={t('Character.RemoveToken')} disabled={!feature.tokens} onclick={() => set(character, `${path}.tokens`, Math.max((feature.tokens ?? 0) - 1, 0))}>−</button>
          <strong>{feature.tokens ?? 0}</strong>
          <button class="outline" aria-label={t('Character.AddToken')} onclick={() => set(character, `${path}.tokens`, (feature.tokens ?? 0) + 1)}>+</button>
        </div>
      {/if}
      {#if limit || feature.used}
        <label class="used">
          <input type="checkbox" use:EP.field={{ store: character, path: `${path}.used` }}>
          {t('Character.Used')}{limit ? ` (${t(limits[limit])})` : ''}
        </label>
      {/if}
    </footer>
  {/if}
</article>
