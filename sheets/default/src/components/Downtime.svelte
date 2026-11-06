<script lang="ts">
  import type { Character, CharacterSnapshot } from '../lib/character'
  import { change, set } from '../lib/change'
  import { tick } from 'svelte'
  import { downtime } from '../lib/downtime.svelte'
  import { t } from '../lib/labels'
  import { downtimeFeatures, downtimeMoveCount, downtimeMoves, downtimeRoll, finishRest, hasBedroll, loadoutLimit, moveToLoadout, needsRoll, reset } from '../lib/rules'
  import type { DowntimeMove, DowntimeMoveKey, Rest } from '../lib/rules'
  import Markdown from '../lib/Markdown.svelte'

  // A rest, in a panel from the right: the rest, the free loadout swaps, the downtime moves chosen
  // and made at once when the rest finishes (lib/rules finishRest). Moves on an ally are reminders.
  let { character, snapshot }: { character: Character, snapshot: CharacterSnapshot } = $props()

  const data = $derived(snapshot.model.data)
  const view = $derived(snapshot.view.data as Record<string, any>)
  const tier = $derived<number>(view.tier ?? 1)
  const projects = $derived<any[]>(view.projects ?? [])
  const cards = $derived<any[]>(view.domainCards ?? [])
  const loadout = $derived(cards.filter((card) => !card.vault))
  const features = $derived(downtimeFeatures(view))

  const rests = [
    { key: 'shortRest', title: 'Short Rest', hint: 'About an hour to catch your breath. Clear 1d4 + Tier with each move.' },
    { key: 'longRest', title: 'Long Rest', hint: 'Making camp for several hours. Clear everything with each move.' }
  ] as const

  let rest = $state<Rest>('shortRest')
  let moves = $state<DowntimeMove[]>([])
  /** Moves beyond two: Celestial Trance, Timekeeper's Pendant, a Safe Haven… */
  let extra = $state(0)
  /** What's left for the allies once the rest finished: shown until the panel closes. */
  let finished = $state<{ rest: Rest, reminders: string[] } | null>(null)

  const limit = $derived(downtimeMoveCount + extra)
  const ready = $derived(moves.every((move) => (!needsRoll(move, rest) || move.amount) && (move.key !== 'project' || move.project)))

  let dialog: HTMLDialogElement
  /** Sliding out: the dialog closes once its animations end (default.css). */
  let closing = $state(false)

  $effect(() => {
    if (downtime.open && !dialog.open) {
      dialog.showModal()
    }
  })

  async function close() {
    if (closing) {
      return
    }
    closing = true
    await tick()
    await Promise.all(dialog.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => {})))
    dialog.close()
  }

  /** Closed, however: by close() or by the browser (a second Escape can't be cancelled). */
  function onclose() {
    closing = false
    downtime.open = false
    finished = null
  }

  function oncancel(event: Event) {
    event.preventDefault()
    close()
  }

  function onclick(event: MouseEvent) {
    if (event.target === dialog) {
      close()
    }
  }

  function title(key: DowntimeMoveKey, at: Rest = rest) {
    return downtimeMoves.find((move) => move.key === key)?.[at] ?? ''
  }

  function chooseRest(key: Rest) {
    rest = key
    // a project is a long rest's move; a short rest's amounts are rolled again
    moves = moves.filter((move) => key === 'longRest' || move.key !== 'project').map(({ amount, ...move }) => move)
  }

  function add(key: DowntimeMoveKey) {
    moves.push(key === 'project' ? { key, project: projects[0]?.id, advance: 1 } : { key })
  }

  /** The 1d4 + Tier results: one to four over the Tier. */
  const amounts = $derived([1, 2, 3, 4].map((roll) => roll + tier))

  async function roll(move: DowntimeMove) {
    // the player taps the amount when there is no result: the roller was closed first
    const result = await EP.roll(downtimeRoll(tier), { label: title(move.key) }).catch(() => null)
    if (result?.result && amounts.includes(result.result)) {
      move.amount = result.result
    }
  }

  /** What a move made on an ally leaves for them to clear on their own sheet. */
  function reminder(move: DowntimeMove) {
    const what = move.key === 'wounds' ? 'Hit Points' : 'Armor Slots'
    const amount = rest === 'longRest' ? 'all their' : move.amount ?? downtimeRoll(tier)
    return `${title(move.key)}: your ally clears ${amount} ${what}.`
  }

  function finish() {
    const chosen = $state.snapshot(moves)
    change(character, (draft) => finishRest(draft, rest, chosen, view.hopeMaximum))
    finished = { rest, reminders: chosen.filter((move) => move.ally).map(reminder) }
    moves = []
    extra = 0
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<dialog class="downtime" class:closing bind:this={dialog} {oncancel} {onclose} {onclick} aria-labelledby="downtime-title">
  <article class="panel">
    <header>
      <h2 id="downtime-title">{t('Character.Downtime')}</h2>
      <!-- not Pico's `.close`, which brings its own icon and margins -->
      <button class="dismiss" aria-label="Close" onclick={close}>
        <!-- Lucide's x (ISC) -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
      </button>
    </header>

    {#if finished}
      <section class="finished">
        <h3>{rests.find((entry) => entry.key === finished?.rest)?.title} finished</h3>
        <p class="note">Your moves are made, and the uses that come back with {finished.rest === 'longRest' ? 'a long rest' : 'a short rest'} are cleared.</p>
        {#each finished.reminders as text}
          <p class="reminder">{text}</p>
        {/each}
        <button onclick={close}>Done</button>
      </section>
    {:else}
      <div class="rests" role="radiogroup" aria-label="Rest">
        {#each rests as entry}
          <button role="radio" aria-checked={rest === entry.key} class:outline={rest !== entry.key} onclick={() => chooseRest(entry.key)}>{entry.title}</button>
        {/each}
      </div>
      <p class="note">{rests.find((entry) => entry.key === rest)?.hint} After three short rests in a row, the next must be a long rest.</p>

      {#if cards.length > loadout.length}
        <!-- before the moves, cards move between the loadout and the vault for free -->
        <section>
          <h3>{t('Character.Loadout')} <small class:over={loadout.length > loadoutLimit}>{loadout.length} / {loadoutLimit}</small></h3>
          <p class="note">Swap cards between your loadout and vault for free.</p>
          <ul class="swaps">
            {#each cards as card (card.id)}
              <li class:vault={card.vault}>
                <span>{card.name}</span>
                {#if card.vault}
                  <button class="outline" disabled={loadout.length >= loadoutLimit} onclick={() => change(character, (draft) => moveToLoadout(draft, card.id, false))}>To loadout</button>
                {:else}
                  <button class="outline" onclick={() => set(character, `data.domainCards[${card.id}].vault`, true)}>To vault</button>
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      <section>
        <h3>Moves <small class:over={moves.length > limit}>{moves.length} / {limit}</small></h3>
        {#each moves as move, index}
          {@const info = downtimeMoves.find((entry) => entry.key === move.key)}
          <div class="move">
            <div class="move-title">
              <strong>{title(move.key)}</strong>
              <button class="remove" aria-label="Remove {title(move.key)}" title="Remove" onclick={() => moves.splice(index, 1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            </div>

            {#if info?.ally}
              <div class="targets" role="radiogroup" aria-label="On whom">
                <label><input type="radio" name="target-{index}" checked={!move.ally} onchange={() => (move.ally = false)}> Yourself</label>
                <label><input type="radio" name="target-{index}" checked={move.ally} onchange={() => (move.ally = true)}> An ally</label>
              </div>
            {/if}

            {#if move.key === 'prepare'}
              <label><input type="checkbox" role="switch" bind:checked={move.together}> With the party: 2 Hope each</label>
              <p class="note">Hope {data.hope ?? 0} / {view.hopeMaximum ?? 6}</p>
            {:else if move.key === 'project'}
              {#if projects.length}
                <div class="row">
                  <select aria-label={t('Character.Project')} bind:value={move.project}>
                    {#each projects as project (project.id)}
                      <option value={project.id}>{project.name || 'Unnamed'} ({project.current ?? 0}{project.maximum ? ` / ${project.maximum}` : ''})</option>
                    {/each}
                  </select>
                  <label class="advance">Advance <input type="number" min="0" bind:value={move.advance}></label>
                </div>
                <p class="note">The GM says whether it advances on its own or with an action roll.</p>
              {:else}
                <p class="note warning">No projects yet: add one on the Story tab.</p>
              {/if}
            {:else if rest === 'shortRest'}
              <div class="amounts">
                <button class="outline roll" onclick={() => roll(move)}>Roll {downtimeRoll(tier)}</button>
                {#each amounts as amount}
                  <button class:outline={move.amount !== amount} aria-pressed={move.amount === amount} onclick={() => (move.amount = amount)}>{amount}</button>
                {/each}
              </div>
            {/if}

            {#if move.ally}
              <p class="note">Your ally clears it on their own sheet.</p>
            {:else if move.key === 'wounds'}
              <p class="note">{data.hp?.current ?? 0} Hit Points marked</p>
            {:else if move.key === 'stress'}
              <p class="note">{data.stress?.current ?? 0} Stress marked{#if data.companion?.stress?.current}; your companion clears as many{/if}</p>
            {:else if move.key === 'armor'}
              <p class="note">{data.armor?.marked ?? 0} Armor Slots marked</p>
            {/if}
          </div>
        {/each}

        <div class="choices">
          {#each downtimeMoves as entry}
            {#if entry[rest]}
              <button class="outline" disabled={moves.length >= limit} title={entry.text} onclick={() => add(entry.key)}>+ {entry[rest]}</button>
            {/if}
          {/each}
        </div>
        <div class="extra">
          <span class="note">Extra moves (a feature, item or place grants them)</span>
          <button class="outline" aria-label="One fewer extra move" disabled={!extra} onclick={() => (extra -= 1)}>−</button>
          <span>{extra}</span>
          <button class="outline" aria-label="One more extra move" onclick={() => (extra += 1)}>+</button>
        </div>
        {#if hasBedroll(data)}
          <p class="note">Premium Bedroll: you clear a Stress too.</p>
        {/if}
      </section>

      {#if features.length}
        <section>
          <h3>Your Features</h3>
          {#each features as feature}
            <details class="reference">
              <summary>{feature.name}</summary>
              <Markdown html={feature.html} />
            </details>
          {/each}
        </section>
      {/if}

      <footer>
        <button disabled={!ready || moves.length > limit} onclick={finish}>Finish {rests.find((entry) => entry.key === rest)?.title}</button>
        <!-- the other resets: uses spent "once per scene" or "once per session" -->
        <div class="resets">
          <button class="outline" title={'Clears uses spent "once per scene"'} onclick={() => change(character, (draft) => reset(draft, 'scene'))}>End Scene</button>
          <button class="outline" title={'Clears uses spent "once per session"'} onclick={() => change(character, (draft) => reset(draft, 'session'))}>End Session</button>
        </div>
      </footer>
    {/if}
  </article>
</dialog>
