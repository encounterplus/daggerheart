<script lang="ts">
  import type { Character, CharacterSnapshot } from '../lib/character'
  import { t } from '../lib/labels'
  import Markdown from '../lib/Markdown.svelte'
  import RemoveButton from '../lib/RemoveButton.svelte'

  let { character, snapshot }: { character: Character, snapshot: CharacterSnapshot } = $props()

  // the description and notes as the app renders them (the transforms)
  const view = $derived(snapshot.view as Record<string, any>)

  const appearance = ['clothes', 'eyes', 'body', 'skin', 'attitude'] as const
</script>

<section class="panel">
  <h3>{t('Character.Description')}</h3>
  <div class="grid-fields">
    <label>{t('Character.Pronouns')} <input type="text" use:EP.field={{ store: character, path: 'data.pronouns' }}></label>
    <label>{t('Character.Player')} <input type="text" use:EP.field={{ store: character, path: 'data.player' }}></label>
    {#each appearance as key}
      <label>{t(`Appearance.${key[0].toUpperCase()}${key.slice(1)}`)} <input type="text" use:EP.field={{ store: character, path: `data.appearance.${key}` }}></label>
    {/each}
    <!-- Avoid Death: a Hope Die at or below the level crosses out a Hope slot -->
    <label>{t('Character.Scars')} <input type="number" min="0" max="6" use:EP.field={{ store: character, path: 'data.scars' }}></label>
  </div>
</section>

<div class="background-columns">
  <section class="panel">
    <h3>{t('Class.BackgroundQuestions')}</h3>
    <p class="hint">{t('Class.BackgroundQuestionsHint')}</p>
    <textarea rows="8" aria-label={t('Class.BackgroundQuestions')} use:EP.field={{ store: character, path: 'data.background' }}></textarea>
  </section>
  <section class="panel">
    <h3>{t('Class.Connections')}</h3>
    <p class="hint">{t('Class.ConnectionsHint')}</p>
    <textarea rows="8" aria-label={t('Class.Connections')} use:EP.field={{ store: character, path: 'data.connections' }}></textarea>
  </section>
</div>

<!-- what the Work on a Project downtime move advances (components/Downtime) -->
<section class="panel projects">
  <div class="panel-header">
    <h3>{t('Character.Projects')}</h3>
    <div class="actions">
      <button class="outline add" onclick={() => character.insert('data.projects', { name: '', current: 0, maximum: 4 }).catch(() => {})}>Add Project</button>
    </div>
  </div>
  <p class="hint">{t('Character.ProjectsHint')}</p>
  {#each view.data.projects ?? [] as project (project.id)}
    <div class="project">
      <div class="row">
        <input type="text" aria-label={t('Common.Name')} placeholder={t('Common.Name')} use:EP.field={{ store: character, path: `data.projects[${project.id}].name` }}>
        <input type="number" class="modifier" min="0" aria-label={t('Common.Current')} title={t('Common.Current')} use:EP.field={{ store: character, path: `data.projects[${project.id}].current` }}>
        <span class="of">/</span>
        <input type="number" class="modifier" min="0" aria-label={t('Common.Maximum')} title={t('Common.Maximum')} use:EP.field={{ store: character, path: `data.projects[${project.id}].maximum` }}>
        <RemoveButton name={project.name} onremove={() => character.remove(`data.projects[${project.id}]`).catch(() => {})} />
      </div>
      {#if project.maximum && (project.current ?? 0) >= project.maximum}
        <p class="note done">Complete</p>
      {/if}
      <textarea rows="2" aria-label={t('Common.Description')} placeholder={t('Common.Description')} use:EP.field={{ store: character, path: `data.projects[${project.id}].text` }}></textarea>
    </div>
  {:else}
    <p class="empty">No projects yet.</p>
  {/each}
</section>

<!-- the player's freeform notes, across the page -->
<section class="panel journal">
  <h3>{t('Character.Journal')}</h3>
  <p class="hint">{t('Character.JournalHint')}</p>
  <textarea rows="14" aria-label={t('Character.Journal')} use:EP.field={{ store: character, path: 'data.journal' }}></textarea>
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
