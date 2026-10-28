<script lang="ts">
  import type { Character, CharacterSnapshot } from '../lib/character'
  import { field } from '../lib/field'
  import { t } from '../lib/labels.svelte'
  import Markdown from '../lib/Markdown.svelte'

  let { character, snapshot }: { character: Character, snapshot: CharacterSnapshot } = $props()

  // the description and notes as the app renders them (the transforms)
  const view = $derived(snapshot.view as Record<string, any>)

  const appearance = ['clothes', 'eyes', 'body', 'skin', 'attitude'] as const
</script>

<section class="panel">
  <h3>{t('Character.Story')}</h3>
  <div class="grid-fields">
    <label>{t('Character.Pronouns')} <input type="text" use:field={{ store: character, path: 'data.pronouns' }}></label>
    <label>{t('Character.Player')} <input type="text" use:field={{ store: character, path: 'data.player' }}></label>
    {#each appearance as key}
      <label>{t(`Appearance.${key[0].toUpperCase()}${key.slice(1)}`)} <input type="text" use:field={{ store: character, path: `data.appearance.${key}` }}></label>
    {/each}
  </div>
  <label class="text">{t('Class.BackgroundQuestions')}
    <textarea rows="6" use:field={{ store: character, path: 'data.background' }}></textarea>
  </label>
  <label class="text">{t('Class.Connections')}
    <textarea rows="4" use:field={{ store: character, path: 'data.connections' }}></textarea>
  </label>
</section>

{#if view.descrHTML || view.notesHTML}
  <section class="panel">
    <!-- the entity's own description and notes: written in the app -->
    <Markdown html={view.descrHTML} />
    {#if view.notesHTML}
      <h3>{t('Common.Notes')}</h3>
      <Markdown html={view.notesHTML} />
    {/if}
  </section>
{/if}
