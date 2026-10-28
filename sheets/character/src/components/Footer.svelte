<script lang="ts">
  import type { Character, CharacterSnapshot } from '../lib/character'
  import { t } from '../lib/labels.svelte'

  let { character, snapshot }: { character: Character, snapshot: CharacterSnapshot } = $props()

  // the template's footer.html: token, source and location, tags
  const view = $derived(snapshot.view as Record<string, any>)
  const token = $derived(character.resolvePath(view.token as string | undefined))
</script>

<footer>
  <div class="source">
    {#if token}
      <a href={token} target="_blank"><img src={token} alt="token"></a>
    {/if}
    <div>
      <p>
        {#if view.sourceFormatted}<strong>{t('Common.Source')}:</strong> {view.sourceFormatted}<br>{/if}
        <strong>{t('Common.Location')}:</strong> {view.locationFormatted || 'System'}
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
