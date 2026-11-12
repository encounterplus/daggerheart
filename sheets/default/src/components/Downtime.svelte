<script lang="ts">
  import type { Character, CharacterSnapshot } from '../lib/character'
  import { change, set } from '../lib/change'
  import { tick } from 'svelte'
  import { downtime } from '../lib/downtime.svelte'
  import { t, tf } from '../lib/labels'
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
    { key: 'shortRest', title: 'Downtime.ShortRest', hint: 'Downtime.ShortRestHint' },
    { key: 'longRest', title: 'Downtime.LongRest', hint: 'Downtime.LongRestHint' }
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
    const name = downtimeMoves.find((move) => move.key === key)?.[at]
    return name ? t(name) : ''
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
    const what = move.key === 'wounds' ? 'HitPoints' : 'ArmorSlots'
    return rest === 'longRest'
      ? tf(`Downtime.AllyClearsAll${what}`, { move: title(move.key) })
      : tf(`Downtime.AllyClears${what}`, { move: title(move.key), amount: move.amount ?? downtimeRoll(tier) })
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
      <button class="dismiss" aria-label={t('Common.Close')} onclick={close}>
        <!-- Lucide's x (ISC) -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
      </button>
    </header>

    {#if finished}
      <section class="finished">
        <h3>{tf('Downtime.RestFinished', { rest: t(rests.find((entry) => entry.key === finished?.rest)?.title ?? '') })}</h3>
        <p class="note">{t(finished.rest === 'longRest' ? 'Downtime.LongRestFinishedNote' : 'Downtime.ShortRestFinishedNote')}</p>
        {#each finished.reminders as text}
          <p class="reminder">{text}</p>
        {/each}
        <button onclick={close}>{t('Common.Done')}</button>
      </section>
    {:else}
      <div class="rests" role="radiogroup" aria-label={t('Downtime.Rest')}>
        {#each rests as entry}
          <button role="radio" aria-checked={rest === entry.key} class:outline={rest !== entry.key} onclick={() => chooseRest(entry.key)}>{t(entry.title)}</button>
        {/each}
      </div>
      <p class="note">{t(rests.find((entry) => entry.key === rest)?.hint ?? '')} {t('Downtime.ThreeShortRests')}</p>

      {#if cards.length > loadout.length}
        <!-- before the moves, cards move between the loadout and the vault for free -->
        <section>
          <h3>{t('Character.Loadout')} <small class:over={loadout.length > loadoutLimit}>{loadout.length} / {loadoutLimit}</small></h3>
          <p class="note">{t('Downtime.SwapCards')}</p>
          <ul class="swaps">
            {#each cards as card (card.id)}
              <li class:vault={card.vault}>
                <span>{card.name}</span>
                {#if card.vault}
                  <button class="outline" disabled={loadout.length >= loadoutLimit} onclick={() => change(character, (draft) => moveToLoadout(draft, card.id, false))}>{t('Character.ToLoadout')}</button>
                {:else}
                  <button class="outline" onclick={() => set(character, `data.domainCards[${card.id}].vault`, true)}>{t('Character.ToVault')}</button>
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      {/if}

      <section>
        <h3>{t('Downtime.Moves')} <small class:over={moves.length > limit}>{moves.length} / {limit}</small></h3>
        {#each moves as move, index}
          {@const info = downtimeMoves.find((entry) => entry.key === move.key)}
          <div class="move">
            <div class="move-title">
              <strong>{title(move.key)}</strong>
              <button class="remove" aria-label={tf('Common.RemoveName', { name: title(move.key) })} title={t('Common.Remove')} onclick={() => moves.splice(index, 1)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
              </button>
            </div>

            {#if info?.ally}
              <div class="targets" role="radiogroup" aria-label={t('Downtime.OnWhom')}>
                <label><input type="radio" name="target-{index}" checked={!move.ally} onchange={() => (move.ally = false)}> {t('Downtime.Yourself')}</label>
                <label><input type="radio" name="target-{index}" checked={move.ally} onchange={() => (move.ally = true)}> {t('Downtime.AnAlly')}</label>
              </div>
            {/if}

            {#if move.key === 'prepare'}
              <label><input type="checkbox" role="switch" bind:checked={move.together}> {t('Downtime.WithTheParty')}</label>
              <p class="note">{t('Common.Hope')} {data.hope ?? 0} / {view.hopeMaximum ?? 6}</p>
            {:else if move.key === 'project'}
              {#if projects.length}
                <div class="row">
                  <select aria-label={t('Character.Project')} bind:value={move.project}>
                    {#each projects as project (project.id)}
                      <option value={project.id}>{project.name || t('Common.Unnamed')} ({project.current ?? 0}{project.maximum ? ` / ${project.maximum}` : ''})</option>
                    {/each}
                  </select>
                  <label class="advance">{t('Downtime.Advance')} <input type="number" min="0" bind:value={move.advance}></label>
                </div>
                <p class="note">{t('Downtime.ProjectNote')}</p>
              {:else}
                <p class="note warning">{t('Downtime.NoProjects')}</p>
              {/if}
            {:else if rest === 'shortRest'}
              <div class="amounts">
                <button class="outline roll" onclick={() => roll(move)}>{tf('Common.RollName', { name: downtimeRoll(tier) })}</button>
                {#each amounts as amount}
                  <button class:outline={move.amount !== amount} aria-pressed={move.amount === amount} onclick={() => (move.amount = amount)}>{amount}</button>
                {/each}
              </div>
            {/if}

            {#if move.ally}
              <p class="note">{t('Downtime.AllyClearsOnOwnSheet')}</p>
            {:else if move.key === 'wounds'}
              <p class="note">{tf('Downtime.HitPointsMarked', { count: data.hp?.current ?? 0 })}</p>
            {:else if move.key === 'stress'}
              <p class="note">{tf('Downtime.StressMarked', { count: data.stress?.current ?? 0 })}{#if data.companion?.stress?.current}{t('Downtime.CompanionClearsToo')}{/if}</p>
            {:else if move.key === 'armor'}
              <p class="note">{tf('Downtime.ArmorSlotsMarked', { count: data.armor?.marked ?? 0 })}</p>
            {/if}
          </div>
        {/each}

        <div class="choices">
          {#each downtimeMoves as entry}
            {#if entry[rest]}
              <button class="outline" disabled={moves.length >= limit} title={t(entry.text)} onclick={() => add(entry.key)}>+ {t(entry[rest] ?? '')}</button>
            {/if}
          {/each}
        </div>
        <div class="extra">
          <span class="note">{t('Downtime.ExtraMoves')}</span>
          <button class="outline" aria-label={t('Downtime.FewerExtraMoves')} disabled={!extra} onclick={() => (extra -= 1)}>−</button>
          <span>{extra}</span>
          <button class="outline" aria-label={t('Downtime.MoreExtraMoves')} onclick={() => (extra += 1)}>+</button>
        </div>
        {#if hasBedroll(data)}
          <p class="note">{t('Downtime.PremiumBedroll')}</p>
        {/if}
      </section>

      {#if features.length}
        <section>
          <h3>{t('Downtime.YourFeatures')}</h3>
          {#each features as feature}
            <details class="reference">
              <summary>{feature.name}</summary>
              <Markdown html={feature.html} />
            </details>
          {/each}
        </section>
      {/if}

      <footer>
        <button disabled={!ready || moves.length > limit} onclick={finish}>{tf('Downtime.FinishRest', { rest: t(rests.find((entry) => entry.key === rest)?.title ?? '') })}</button>
        <!-- the other resets: uses spent "once per scene" or "once per session" -->
        <div class="resets">
          <button class="outline" title={t('Downtime.EndSceneHint')} onclick={() => change(character, (draft) => reset(draft, 'scene'))}>{t('Downtime.EndScene')}</button>
          <button class="outline" title={t('Downtime.EndSessionHint')} onclick={() => change(character, (draft) => reset(draft, 'session'))}>{t('Downtime.EndSession')}</button>
        </div>
      </footer>
    {/if}
  </article>
</dialog>
