<script lang="ts">
  import type { Character, CharacterSnapshot } from '../lib/character'
  import { t } from '../lib/labels'
  import Reference from '../lib/Reference.svelte'

  let { character, snapshot }: { character: Character, snapshot: CharacterSnapshot } = $props()

  // the template's footer.html: token, source and location, tags
  const view = $derived(snapshot.view as Record<string, any>)
  const token = $derived(character.resolvePath(view.token as string | undefined))

  /** The app formats source and location as a Markdown link, `[SRD v2.0](/source/srd-2-0)`; plain text stays a name. */
  function link(markdown: string | undefined) {
    const match = /^\[(.*)\]\(([^)]*)\)$/.exec(markdown ?? '')
    return match ? { name: match[1], reference: match[2] } : { name: markdown }
  }
  const source = $derived(link(view.sourceFormatted))
  const location = $derived(link(view.locationFormatted || t('Common.System')))
</script>

<footer>
  <div class="source">
    {#if token}
      <a href={token} target="_blank"><img src={token} alt={t('Character.Token')}></a>
    {/if}
    <div>
      <p>
        {#if view.sourceFormatted}<strong>{t('Common.Source')}:</strong> <Reference entry={source} /><br>{/if}
        <strong>{t('Common.Location')}:</strong> <Reference entry={location} />
      </p>
    </div>
  </div>

  {#if view.tags?.length}
    <div class="tags">
      {#each view.tags as tag}
        <span class="tag">{tag}</span>
      {/each}
    </div>
  {/if}
</footer>
