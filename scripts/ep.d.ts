/*
 * Types of the Encounter+ sheet SDK, scripts/ep.js (experimental).
 *
 * ep.js is a classic script that sets `window.EP`: a sheet loads it with a `<script>` tag from
 * the system (from the app, `/_app/js/ep.js`, once embedded) and never bundles it. These are
 * global declarations for a sheet's TypeScript: list this file in the sheet's tsconfig
 * `include`. Keep it in step with ep.js. ep-ui.js adds nothing to `EP` (it sets the picker), so
 * it needs no types.
 */

/** An entity as the web API returns it: app-owned fields beside the system's `data`. */
interface EPEntity<Data = Record<string, any>> {
  id: string
  name: string
  kind: string
  type?: string
  reference?: string
  image?: string
  token?: string
  descr?: string
  notes?: string
  modified?: string
  data: Data
  [key: string]: unknown
}

/** `connecting` until the app has the store subscribed, `disconnected` after a close. */
type EPStatus = 'connecting' | 'connected' | 'disconnected'

/**
 * The store's state at one moment, immutable: `model` is the entity with this view's waiting
 * changes applied, `view` the model with the app's computed values laid over it.
 */
interface EPSnapshot<Data = Record<string, any>> {
  readonly model: EPEntity<Data>
  readonly view: EPEntity<any>
  /** Batches not yet acknowledged by the app. */
  readonly pending: number
  readonly status: EPStatus
}

/** One operation of a batch; paths are rooted at the entity (`data.weapons[2].broken`). */
interface EPOp {
  op: 'set' | 'remove' | 'insert' | 'move' | 'test' | 'embed'
  path: string
  value?: unknown
  index?: number
  ref?: string
  keys?: string[]
}

/** Why the app (or the client check) refused an operation. */
interface EPIssue {
  message: string
  code?: string
  /** The operation's position in its batch. */
  index?: number
  path?: string
}

/** A refused write: what a write's promise rejects with. */
interface EPError extends Error {
  errors: EPIssue[]
  ops: EPOp[]
}

/** A library entry, as `EP.query` and `EP.pick` give it. */
interface EPEntry {
  id: string
  name: string
  kind: string
  reference: string
  source?: string
}

/** The view's environment, from the first state. */
interface EPEnvironment {
  dataURL?: string
  systemURL?: string
  baseURL?: string
  theme?: string
  [key: string]: unknown
}

/** `state`: the app sent the entity. */
interface EPStateDetail {
  /** Batch ids this state acknowledges. */
  acknowledged: string[]
  /** Whether the entity changed (its `modified` aside). */
  changed: boolean
  /** Where the view changed: objects key by key, values and lists whole. */
  paths: string[]
}

/** `error`: a write was refused. */
interface EPErrorDetail {
  errors: EPIssue[]
  ops: EPOp[]
}

/**
 * A store of one entity — `EP.entity`, `EP.entities.get(id)`. It follows the store contract
 * (`subscribe` calls back at once and after every change), so Svelte reads it as `$hero` and
 * React with `useSyncExternalStore(store.subscribe, () => store.snapshot)`.
 *
 * Events: `change`, `state` (`EPStateDetail`), `error` (`EPErrorDetail`), `schema`, `deleted`.
 */
interface EPEntityStore<Data = Record<string, any>> extends EventTarget {
  readonly id: string
  readonly snapshot: EPSnapshot<Data>
  readonly model: EPEntity<Data>
  readonly view: EPEntity<any>
  readonly status: EPStatus
  /** Whether any state is known yet. */
  readonly hasState: boolean
  /** The view's environment, once the first state has arrived. */
  readonly env: EPEnvironment | null

  /** A value by path: from the model, or from the view with a `view.` prefix. */
  get(path: string): any
  /** A content path (an image, a file) as the page reaches it, like the templates' `resolvePath`. */
  resolvePath<Path extends string | null | undefined>(path: Path): Path

  /** Calls `fn` now and after every change, and follows the entity. Returns the function that stops it. */
  subscribe(fn: (snapshot: EPSnapshot<Data>) => void): () => void
  connect(): Promise<this>
  disconnect(): void

  // Writes resolve when the app has applied them and reject with an `EPError` when refused.
  // Only `data.…` paths can be written.
  set(path: string, value: unknown): Promise<void>
  remove(path: string): Promise<void>
  insert(path: string, value: unknown, index?: number): Promise<void>
  move(path: string, index: number): Promise<void>
  /** Adds a copy of a library entry, with the listed keys of its data, to a list or a reference field. */
  embed(path: string, entry: EPEntry | string, keys?: string[], index?: number): Promise<void>
  /** Changes `data` in one batch: change the copy `fn` gets (or return a new one). */
  update(fn: (data: Data) => Data | void): Promise<void>
  apply(ops: EPOp[]): Promise<void>

  addEventListener(type: 'state', listener: (event: CustomEvent<EPStateDetail>) => void, options?: boolean | AddEventListenerOptions): void
  addEventListener(type: 'error', listener: (event: CustomEvent<EPErrorDetail>) => void, options?: boolean | AddEventListenerOptions): void
  addEventListener(type: 'change' | 'schema' | 'deleted', listener: (event: Event) => void, options?: boolean | AddEventListenerOptions): void
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void
}

/** What `EP.bind` returns. */
interface EPBinding {
  render(): void
  /** Whether a bound element shows a path (`data.…`, view paths without their prefix). */
  shows(path: string): boolean
  unbind(): void
}

/** Lets the user pick library entries in a browser; an empty list when cancelled. */
type EPPicker = (options: { entity: string, multiple: boolean }) => Promise<EPEntry[]>

/** A roll as the app rolled it: `detail` is the dice, `[14]`. */
interface EPRoll {
  name?: string
  formula: string
  result?: number
  detail?: string
}

interface EPSDK {
  /** The protocol version. */
  readonly version: number
  readonly Error: new (errors: EPIssue[], ops?: EPOp[]) => EPError

  /**
   * `server`: the app's web server, for a view served from elsewhere (a dev server). `picker`:
   * what `pick` does in a browser (ep-ui.js sets a search dialog). `onRoll`: called with each
   * roll's result in a browser (ep-ui.js shows a banner).
   */
  configure(options: { server?: string | null, picker?: EPPicker | null, onRoll?: ((roll: EPRoll) => void) | null }): void

  /** The entity the view shows — `<html data-entity-id>` or `?id=` — or `null`. */
  readonly entity: EPEntityStore | null
  entities: { get(id: string): EPEntityStore }

  /** Binds `data-bind`, `data-text`, `data-count`, `data-bar` elements to a store. */
  bind(root: ParentNode, store: EPEntityStore): EPBinding
  /** Renders regions of a server-rendered page again. */
  refresh(selector?: string): Promise<void>

  /**
   * Rolls dice: the app's roller in the app (resolves `null`), the shared log in a browser
   * (resolves with the result, after `onRoll`; rejects when the app could not roll it).
   */
  roll(formula: string, options?: { label?: string }): Promise<EPRoll | null>
  /** Library entries of a kind (and the kinds extending it), by name. */
  query(options: { entity: string, search?: string, limit?: number }): Promise<EPEntry[]>
  /**
   * Lets the user pick library entries: native in the app, the configured picker in a browser;
   * rejects in a browser without one.
   */
  pick(options: { entity: string, multiple?: false }): Promise<EPEntry | null>
  pick(options: { entity: string, multiple: true }): Promise<EPEntry[]>

  /** The system's text for a key; the key until the labels load. */
  t(key: string): string
  /** The label of an enum key — `EP.label('Kin', 'elf')`. */
  label(name: string, value: unknown): string
  /** Resolves once the system's labels have loaded, which the first state starts. */
  labels(): Promise<unknown>

  /** Opens a reference the way a link to it would. */
  open(reference: string): void
}

declare const EP: EPSDK

interface Window {
  EP: EPSDK
}
