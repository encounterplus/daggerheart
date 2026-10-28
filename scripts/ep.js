/*
 * ep.js — the Encounter+ sheet SDK (experimental).
 *
 * A view that loads it can follow an entity and change it, in the app's web views and in a
 * browser alike. The same API serves a Stencil template that binds a few values and a sheet
 * written in a client framework. It draws nothing of its own: `EP.bind` wires markup the view
 * already has, and the UI the SDK offers — a pick dialog for browsers — is a second script,
 * `ep-ui.js`, loaded after this one.
 *
 *   const hero = EP.entity                       // the entity this view shows
 *   hero.subscribe(({ model, view, pending, status }) => …)   // store contract, connects
 *   hero.get('data.hp.current'); hero.get('view.data.damageBonusStr'); hero.get('name')
 *   await hero.set('data.hp.current', 7)
 *   await hero.update((data) => { data.hp.current = data.hp.maximum; data.rest.round = false })
 *   EP.bind(document, hero)                      // data-bind, data-text, data-count, data-bar
 *   const axe = await EP.pick({ entity: 'Item' })  // the library: native in the app, the configured picker in a browser
 *   await hero.embed('data.weapons', axe, ['skill', 'damage'])   // a copy of the entry, checked by the app
 *   EP.roll('1d20', { label: 'Awareness' }); EP.t('Common.HitPoints'); EP.label('Kin', 'elf')
 *   EP.open('/item/broadsword'); hero.resolvePath(hero.get('image'))   // an image path, as the page reaches it
 *
 * Paths are rooted at the entity as the web API returns it: `name`, `data.hp.current`. List items
 * are `[2]` by position, or `[id]` in lists with ids. A `view.` prefix reads the view — the entity
 * with the values the app computes (transforms, modifiers) laid over it — so a computed value is
 * `view.data.<key>`. Only `data.…` can be written. Inputs bind to model paths; displays read the
 * view.
 *
 * The store contract: `subscribe(fn)` calls `fn` at once and after every change with an
 * immutable snapshot `{ model, view, pending, status }` and returns the function that stops it;
 * `snapshot` is the current one, the same object until something changes. That is all Svelte
 * (`$hero`), React (`useSyncExternalStore(hero.subscribe, () => hero.snapshot)`), Solid and Vue
 * need. The store is also an EventTarget: `change` (the snapshot changed), `state` (the app sent
 * the entity: `detail { acknowledged, changed, paths }`), `error` (`detail { errors, ops }`) and
 * `deleted`.
 *
 * Writes go to the app as batches of operations, which it checks against the entity type's model
 * schema. The view shows them at once and keeps them until the app acknowledges them, laid over
 * every state it sends meanwhile. Once the entity type's runtime schema has loaded (its address
 * comes with the first state), a write the app would refuse is refused before it is sent, with
 * the app's codes and paths. One batch is with the app at a time; a `set` of a path while an
 * earlier `set` of it is still waiting replaces the waiting value. A refused batch is dropped: its
 * promise rejects with an `EP.Error` (`errors`: `message`, `code`, the operation's `index` and
 * `path`), and the store dispatches `error`.
 *
 * The protocol: `subscribeEntity { id, api }`, `updateEntity { id, batch, ops }` and
 * `unsubscribeEntity { id }` out; `entityUpdated { id, model, derived, ack }`, `entityDeleted`
 * and `requestFailed { message, errors }` in. A roll in a browser is `createMessage { type:
 * 'command', content: '/roll …', creature }`, answered with `messageCreated` and the logged roll. In the app's web views they go out through the
 * app's message handler (`webkit.messageHandlers.API`) and come in as `encounterplus:message`
 * events on the window, the app's event as their `detail`; in a browser, both ways through a web
 * socket to the app's web server. That is the whole contract: a sheet can speak it without this
 * SDK. The app sends state in order, so the last one received is the current one.
 *
 * During development the working copy lives in the Dragonbane system (`scripts/ep.js`); it moves
 * into the app bundle, `/_app/js/ep.js`, once the SDK is embedded. No game rules belong here.
 */
(() => {
  'use strict'

  if (window.EP) {
    return
  }

  const API = 1

  // MARK: Paths

  /**
   * Splits a path into its keys and selectors: `data.weapons[0].broken` is `data`, `weapons`,
   * `[0]`, `broken`.
   */
  function parsePath(path) {
    if (typeof path !== 'string') {
      throw new Error(`not a path: ${path}`)
    }
    const first = /^[^.\[\]]+/.exec(path)
    if (!first) {
      throw new Error(`not a path: ${path}`)
    }
    const result = [{ key: first[0] }]
    const pattern = /\.([^.\[\]]+)|\[([^\[\]]+)\]/g
    pattern.lastIndex = first[0].length
    let position = first[0].length
    let match
    while ((match = pattern.exec(path)) !== null) {
      if (match.index !== position) {
        throw new Error(`not a path: ${path}`)
      }
      result.push(match[1] !== undefined ? { key: match[1] } : { selector: match[2] })
      position = pattern.lastIndex
    }
    if (position !== path.length) {
      throw new Error(`not a path: ${path}`)
    }
    return result
  }

  /** Throws unless the path can be written: only `data.…` can. */
  function writable(path) {
    if (typeof path !== 'string' || !(path.startsWith('data.') || path.startsWith('data['))) {
      throw new EPError([{ code: 'notWritable', path: String(path), message: `${path}: only data paths can be written` }])
    }
    return path
  }

  /** The position of the item a selector names: an item's `id`, or else a position. */
  function itemIndex(list, selector) {
    const byId = list.findIndex((item) => isObject(item) && item.id === selector)
    if (byId >= 0) {
      return byId
    }
    if (/^\d+$/.test(selector)) {
      const index = Number(selector)
      return index < list.length ? index : -1
    }
    return -1
  }

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
  }

  function valueAt(root, path) {
    let node = root
    for (const segment of path) {
      if (segment.key !== undefined) {
        node = isObject(node) ? node[segment.key] : undefined
      } else {
        if (!Array.isArray(node)) {
          return undefined
        }
        const index = itemIndex(node, segment.selector)
        node = index < 0 ? undefined : node[index]
      }
    }
    return node
  }

  function clone(value) {
    return value === undefined ? undefined : structuredClone(value)
  }

  function freeze(value) {
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.freeze(value)
      for (const child of Object.values(value)) {
        freeze(child)
      }
    }
    return value
  }

  /** Deep equality of JSON values, whatever the order of their keys. */
  function isSame(lhs, rhs) {
    if (lhs === rhs) {
      return true
    }
    if (lhs === null || rhs === null || typeof lhs !== 'object' || typeof rhs !== 'object' || Array.isArray(lhs) !== Array.isArray(rhs)) {
      return false
    }
    if (Array.isArray(lhs)) {
      return lhs.length === rhs.length && lhs.every((item, index) => isSame(item, rhs[index]))
    }
    const keys = Object.keys(lhs)
    return keys.length === Object.keys(rhs).length && keys.every((key) => Object.hasOwn(rhs, key) && isSame(lhs[key], rhs[key]))
  }

  /**
   * The paths at which two views differ: an object's keys are compared one by one, anything else
   * (a value, a list) is reported whole — `data.hp.current`, `data.weapons`, `name`.
   */
  function changedPaths(before, after, prefix = '', result = []) {
    if (isSame(before, after)) {
      return result
    }
    if (isObject(before) && isObject(after)) {
      for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
        changedPaths(before[key], after[key], prefix ? `${prefix}.${key}` : key, result)
      }
    } else {
      result.push(prefix)
    }
    return result
  }

  /**
   * `base` with `overlay` laid over it: objects merge key by key, anything else in `overlay`
   * replaces, and a `null` removes the key — how the app's computed values become the view.
   */
  function laidOver(base, overlay) {
    if (!isObject(base) || !isObject(overlay)) {
      return clone(overlay)
    }
    const result = { ...base }
    for (const [key, value] of Object.entries(overlay)) {
      if (value === null) {
        delete result[key]
      } else {
        result[key] = laidOver(base[key], value)
      }
    }
    return result
  }

  /**
   * The operations that turn `before` into `after`, for `update(fn)`: objects key by key, items
   * of a list of objects that kept its length one by one (by `id` where both have the same one),
   * and anything else — a value, a list that changed length, a list of values — set whole.
   */
  function diff(before, after, path, ops = []) {
    if (isSame(before, after)) {
      return ops
    }
    if (isObject(before) && isObject(after)) {
      for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (after[key] === undefined) {
          if (before[key] !== undefined) {
            ops.push({ op: 'remove', path: `${path}.${key}` })
          }
        } else {
          diff(before[key], after[key], `${path}.${key}`, ops)
        }
      }
      return ops
    }
    if (Array.isArray(before) && Array.isArray(after) && before.length === after.length && before.every(isObject) && after.every(isObject)) {
      before.forEach((item, index) => {
        const id = typeof item.id === 'string' && item.id !== '' && after[index].id === item.id ? item.id : null
        diff(item, after[index], `${path}[${id ?? index}]`, ops)
      })
      return ops
    }
    ops.push({ op: 'set', path, value: after === undefined ? null : clone(after) })
    return ops
  }

  // MARK: Local apply

  /**
   * Applies an operation to a copy of the entity, the way the app will, so the view shows it at
   * once. There is no schema here: the app's answer is what counts, and an operation that doesn't
   * fit the local copy is skipped.
   */
  function applyLocally(entity, op) {
    if (op.op === 'test') {
      return
    }
    if (op.op === 'embed') {
      // the app copies the entry; until it answers, the copy shows its name and reference
      const copy = { name: op._name, reference: op.ref }
      const target = valueAt(entity, parsePath(op.path))
      if (Array.isArray(target)) {
        applyLocally(entity, op.index === undefined ? { op: 'insert', path: op.path, value: copy } : { op: 'insert', path: op.path, value: copy, index: op.index })
      } else if (isObject(target)) {
        applyLocally(entity, { op: 'set', path: op.path, value: copy })
      }
      return
    }
    const path = parsePath(op.path)

    // walks to the container of the last segment, creating objects for keys on the way
    const create = op.op === 'set' || op.op === 'insert'
    const steps = op.op === 'insert' ? path : path.slice(0, -1)
    let node = entity
    for (const [position, segment] of steps.entries()) {
      if (segment.key !== undefined) {
        if (!isObject(node)) {
          return
        }
        if (node[segment.key] === undefined || node[segment.key] === null) {
          if (!create) {
            return
          }
          node[segment.key] = position === steps.length - 1 && op.op === 'insert' ? [] : {}
        }
        node = node[segment.key]
      } else {
        if (!Array.isArray(node)) {
          return
        }
        const index = itemIndex(node, segment.selector)
        if (index < 0) {
          return
        }
        node = node[index]
      }
    }

    if (op.op === 'insert') {
      if (Array.isArray(node)) {
        node.splice(op.index ?? node.length, 0, clone(op.value))
      }
      return
    }

    const last = path[path.length - 1]
    if (last.key !== undefined) {
      if (!isObject(node)) {
        return
      }
      if (op.op === 'remove' || op.value === null || op.value === undefined) {
        delete node[last.key]
      } else {
        node[last.key] = clone(op.value)
      }
      return
    }

    if (!Array.isArray(node)) {
      return
    }
    const index = itemIndex(node, last.selector)
    if (index < 0) {
      return
    }
    if (op.op === 'move') {
      const [item] = node.splice(index, 1)
      node.splice(op.index, 0, item)
    } else if (op.op === 'remove' || op.value === null || op.value === undefined) {
      node.splice(index, 1)
    } else {
      node[index] = clone(op.value)
    }
  }

  // MARK: Errors

  /** A refused request: `errors` holds the app's reasons, `ops` the batch when it was one. */
  class EPError extends Error {
    constructor(errors, ops) {
      super(errors.map((error) => error.message).join('\n') || 'refused')
      this.name = 'EP.Error'
      this.errors = errors
      this.ops = ops
    }
  }

  // MARK: Transport

  const settings = {
    /** The app's web server, for a view served from elsewhere; else the page's own server. */
    server: null,
    /** Lets the user pick library entries in a browser, which has no library list; see `EP.pick`. */
    picker: null,
    /** Shown each roll's result in a browser, where no dice roller shows it; see `EP.roll`. */
    onRoll: null
  }

  let counter = 0

  function nextId(prefix) {
    counter += 1
    return `${prefix}${Date.now().toString(36)}-${counter}`
  }

  /** The app's message handler, in its web views; looked up each time, as the app may add it late. */
  function messageHandler() {
    return window.webkit?.messageHandlers?.API ?? null
  }

  /** Requests waiting for their answer, by request id: `{ resolve, reject, ops }`. */
  const waiting = new Map()

  let socket = null

  /**
   * The web socket to the app's web server, opened on first use. When it closes, waiting
   * requests fail and stores following their entity subscribe again.
   */
  function openSocket() {
    if (socket) {
      return socket
    }
    const base = new URL(settings.server ?? location.href)
    const webSocket = new WebSocket(`${base.protocol === 'https:' ? 'wss' : 'ws'}://${base.host}`)
    socket = new Promise((resolve, reject) => {
      webSocket.addEventListener('open', () => resolve(webSocket), { once: true })
      webSocket.addEventListener('error', () => reject(new Error('ep.js: no connection to the app')), { once: true })
    })
    socket.catch(() => {
      socket = null
    })

    webSocket.addEventListener('message', (event) => {
      try {
        EP._receive(JSON.parse(event.data))
      } catch (error) {
        console.warn('ep.js: unreadable event', error)
      }
    })

    webSocket.addEventListener('close', () => {
      socket = null
      for (const store of stores.values()) {
        store._disconnected()
      }
      for (const request of [...waiting.values()]) {
        request.reject(new EPError([{ message: 'the connection to the app closed' }], request.ops))
      }
      waiting.clear()
      // a subscription ends with its socket
      setTimeout(() => {
        for (const store of stores.values()) {
          store._resubscribe()
        }
      }, 2000)
    })
    return socket
  }

  /** Sends an event; answers arrive through `EP._receive`. */
  async function send(event) {
    const handler = messageHandler()
    if (handler) {
      await handler.postMessage(JSON.stringify(event))
      return
    }
    if (!settings.server && location.protocol !== 'http:' && location.protocol !== 'https:') {
      throw new Error('ep.js: no connection to the app in this view')
    }
    const webSocket = await openSocket()
    webSocket.send(JSON.stringify(event))
  }

  /**
   * Sends a request and waits for the event answering it — one with its id as `responseId` —
   * or, for a batch, until the store settles it. `requestFailed` rejects with an `EP.Error`.
   */
  function request(name, data, { ops, timeout: wait = 10000 } = {}) {
    const requestId = nextId('r')
    const answer = new Promise((resolve, reject) => {
      // a request the user answers, such as a pick, waits as long as it takes
      const timeout = wait === null ? null : setTimeout(() => {
        waiting.get(requestId)?.reject(new EPError([{ message: 'no answer from the app' }], ops))
      }, wait)
      waiting.set(requestId, {
        resolve: (event) => {
          clearTimeout(timeout)
          waiting.delete(requestId)
          resolve(event)
        },
        reject: (error) => {
          clearTimeout(timeout)
          waiting.delete(requestId)
          reject(error)
        },
        ops
      })
    })
    send({ name, requestId, data }).catch((error) => waiting.get(requestId)?.reject(new EPError([{ message: error.message }], ops)))
    return { requestId, answer }
  }

  // MARK: Labels

  /** The system's labels (`{ language, strings, enums }`), once loaded from the first state's address. */
  let labels = null
  let labelsLoading = null
  let labelsLoaded = null

  /** Resolves with the labels once they have loaded; see `EP.labels`. */
  const labelsReady = new Promise((resolve) => {
    labelsLoaded = resolve
  })

  function loadLabels(address) {
    if (!address || labels || labelsLoading) {
      return
    }
    labelsLoading = fetch(address)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`labels not available: ${response.status}`)
        }
        return response.json()
      })
      .then((loaded) => {
        labels = loaded
        labelsLoaded(labels)
      })
      .catch((error) => {
        // a later state tries again
        labelsLoading = null
        console.warn('ep.js:', error.message)
      })
  }

  // MARK: Schema

  /**
   * The app's checks on a write, from the entity type's runtime schema
   * (`cache/schemas/<label>.json`, its address in the first state). A copy of the app's
   * `ModelSchema` rules — the same lookup, conversions and ops, kept in step by the cases both
   * run (`EncounterPlusTests/Fixtures/model-ops.json`) — so a write the app would refuse is
   * refused before it is sent, with the same codes and paths. The app stays the authority.
   */

  /** A path inside `data` as the app parses it: keys and selectors after `data`; `null` if malformed. */
  function parseDataPath(string) {
    if (typeof string !== 'string' || !string.startsWith('data')) {
      return null
    }
    const segments = []
    let rest = string.slice(4)
    while (rest.length > 0) {
      if (rest[0] === '.') {
        rest = rest.slice(1)
        const end = rest.search(/[.\[\]]/)
        const key = end < 0 ? rest : rest.slice(0, end)
        if (key === '') {
          return null
        }
        segments.push({ key })
        rest = end < 0 ? '' : rest.slice(end)
      } else if (rest[0] === '[') {
        rest = rest.slice(1)
        const end = rest.indexOf(']')
        if (end < 0) {
          return null
        }
        const selector = rest.slice(0, end)
        if (selector === '' || selector.includes('[')) {
          return null
        }
        segments.push({ selector })
        rest = rest.slice(end + 1)
      } else {
        return null
      }
    }
    return segments
  }

  function describe(segments) {
    return segments.reduce((path, segment) => segment.key !== undefined ? `${path}.${segment.key}` : `${path}[${segment.selector}]`, 'data')
  }

  function formatNumber(number) {
    return String(number)
  }

  /** An issue as the app reports it: `{ code, path, message }`. */
  const issues = {
    invalidPath: (path) => ({ code: 'invalidPath', path, message: `${path}: not a valid data path` }),
    undeclared: (path) => ({ code: 'undeclared', path, message: `${path}: not declared in the schema` }),
    notWritable: (path) => ({ code: 'notWritable', path, message: `${path}: can't be written` }),
    invalidValue: (path, expected) => ({ code: 'invalidValue', path, message: `${path}: expected ${expected}` }),
    outOfRange: (path, min, max) => {
      let message
      if (min !== undefined && max !== undefined) {
        message = `must be between ${formatNumber(min)} and ${formatNumber(max)}`
      } else if (min !== undefined) {
        message = `must be at least ${formatNumber(min)}`
      } else {
        message = `must be at most ${formatNumber(max)}`
      }
      return { code: 'outOfRange', path, message: `${path}: ${message}` }
    },
    invalidKey: (path) => ({ code: 'invalidKey', path, message: `${path}: not a valid key` }),
    invalidSelector: (path) => ({ code: 'invalidSelector', path, message: `${path}: not a valid item selector for this list` }),
    duplicateId: (path) => ({ code: 'duplicateId', path, message: `${path}: duplicate item id` }),
    invalidOp: (path, message) => ({ code: 'invalidOp', path, message: path ? `${path}: ${message}` : message }),
    missingItem: (path) => ({ code: 'missingItem', path, message: `${path}: no such item` }),
    notAList: (path) => ({ code: 'notAList', path, message: `${path}: not a list of objects` }),
    invalidIndex: (path, index) => ({ code: 'invalidIndex', path, message: `${path}: no position ${index} in the list` }),
    testFailed: (path) => ({ code: 'testFailed', path, message: `${path}: the value has changed` }),
    notAReference: (path) => ({ code: 'notAReference', path, message: `${path}: not a reference to an entity` }),
    missingSource: (path, reference) => ({ code: 'missingSource', path, message: `${path}: ${reference} not found` })
  }

  /** Every problem found in one write or op. */
  class Invalid extends Error {
    constructor(found) {
      super(found.map((issue) => issue.message).join('\n'))
      this.issues = found
    }
  }

  /** Why a batch was refused: the position of the first op that failed, and its issues. */
  class OpError extends Error {
    constructor(index, found) {
      super(found.map((issue) => `op ${index}: ${issue.message}`).join('\n'))
      this.index = index
      this.issues = found
    }
  }

  function fail(issue) {
    return new Invalid([issue])
  }

  function idOf(item) {
    return isObject(item) && typeof item.id === 'string' && item.id !== '' ? item.id : null
  }

  function wholeNumber(number) {
    return Number.isFinite(number) && Number.isInteger(number) && Math.abs(number) < 9.0e15 ? number : null
  }

  /** Reads an op from its JSON form, as the app does; throws `Invalid`. */
  const opKeys = { set: ['value'], remove: [], insert: ['value', 'index'], move: ['index'], test: ['value'], embed: ['ref', 'keys', 'index'] }

  function parseOp(json) {
    const rawPath = typeof json.path === 'string' ? json.path : ''
    const invalid = (message) => fail(issues.invalidOp(rawPath, message))

    if (typeof json.op !== 'string') {
      throw invalid('an op needs "op"')
    }
    const keys = opKeys[json.op]
    if (!Object.hasOwn(opKeys, json.op)) {
      throw invalid(`unknown op "${json.op}"`)
    }
    if (typeof json.path !== 'string') {
      throw invalid('an op needs "path"')
    }
    const path = parseDataPath(rawPath)
    if (!path) {
      throw fail(issues.invalidPath(rawPath))
    }
    for (const key of Object.keys(json).sort()) {
      if (key !== 'op' && key !== 'path' && !keys.includes(key)) {
        throw invalid(`unknown key "${key}" in ${json.op}`)
      }
    }

    const op = { op: json.op, path }
    if (keys.includes('value')) {
      if (!Object.hasOwn(json, 'value')) {
        throw invalid(`${json.op} needs "value"`)
      }
      op.value = json.value === null ? undefined : json.value
    }
    if (keys.includes('index') && json.index !== undefined && json.index !== null) {
      if (typeof json.index !== 'number' || wholeNumber(json.index) === null) {
        throw invalid('"index" must be a whole number')
      }
      op.index = json.index
    }
    if (json.op === 'move' && op.index === undefined) {
      throw invalid('move needs "index"')
    }
    if (json.op === 'embed') {
      if (typeof json.ref !== 'string' || json.ref === '') {
        throw invalid('embed needs "ref", the entry\'s reference')
      }
      if (!Array.isArray(json.keys) || !json.keys.every((key) => typeof key === 'string')) {
        throw invalid('embed needs "keys", a list of data keys')
      }
      op.ref = json.ref
      op.keys = json.keys
    }
    return op
  }

  /** Reads a batch; throws `OpError` for the first malformed op. */
  function parseBatch(json) {
    return json.map((element, index) => {
      if (!isObject(element)) {
        throw new OpError(index, [issues.invalidOp('', 'an op is an object')])
      }
      try {
        return parseOp(element)
      } catch (error) {
        if (error instanceof Invalid) {
          throw new OpError(index, error.issues)
        }
        throw error
      }
    })
  }

  class Schema {
    constructor(runtime) {
      this.enums = runtime.enums ?? {}
      this.defs = runtime.defs ?? {}
      this.root = { properties: runtime.data?.properties ?? {} }
    }

    // MARK: Lookup

    /** The properties of an object declaration (inline, named or a reference), or `null`. */
    objectOf(field) {
      if (field.def !== undefined) {
        return this.defs[field.def]?.properties ?? {}
      }
      return field.properties ?? null
    }

    static implicitProperties(field) {
      const properties = {}
      if (field.ids || field.tree) {
        properties.id = { type: 'string' }
      }
      if (field.tree) {
        properties.parentId = { type: 'string' }
        properties.container = { type: 'boolean' }
      }
      return properties
    }

    isValidMapKey(key, keys) {
      if (key === '' || /[.\[\]]/.test(key)) {
        return false
      }
      return keys === undefined || (this.enums[keys] ?? []).some((value) => String(value) === key)
    }

    lookup(segments) {
      let field = this.root
      let implicit = {}
      let isId = false
      const current = []

      for (const segment of segments) {
        current.push(segment)
        isId = false
        if (segment.key !== undefined) {
          const object = this.objectOf(field)
          if (object) {
            if (Object.hasOwn(object, segment.key)) {
              field = object[segment.key]
            } else if (Object.hasOwn(implicit, segment.key)) {
              field = implicit[segment.key]
              isId = segment.key === 'id'
            } else {
              return { issue: issues.undeclared(describe(current)) }
            }
          } else if (field.map !== undefined) {
            if (!this.isValidMapKey(segment.key, field.keys)) {
              return { issue: issues.invalidKey(describe(current)) }
            }
            field = field.map
          } else {
            return { issue: issues.undeclared(describe(current)) }
          }
          implicit = {}
        } else {
          if (field.list === undefined) {
            return { issue: issues.invalidSelector(describe(current)) }
          }
          if (!(field.ids || field.tree) && (!/^[+-]?\d+$/.test(segment.selector) || Number(segment.selector) < 0)) {
            return { issue: issues.invalidSelector(describe(current)) }
          }
          implicit = Schema.implicitProperties(field)
          field = field.list
        }
      }
      return { field, implicit, isId }
    }

    fieldAt(segments) {
      const found = this.lookup(segments)
      return found.issue ? null : found.field
    }

    /** Whether a path can be written: declared, and not a list item's `id`. */
    isWritable(path) {
      const segments = parseDataPath(path)
      if (!segments || segments.length === 0) {
        return false
      }
      const found = this.lookup(segments)
      return !found.issue && !found.isId
    }

    // MARK: Converting

    /** Checks and converts a value written at a path; `undefined` removes the key. Throws `Invalid`. */
    normalize(value, segments) {
      const normalizer = new Normalizer(this)
      const found = this.lookup(segments)
      let result
      if (found.issue) {
        normalizer.issues.push(found.issue)
      } else if (found.isId) {
        normalizer.issues.push(issues.notWritable(describe(segments)))
      } else {
        result = normalizer.value(value, found.field, found.implicit, segments)
      }
      if (normalizer.issues.length > 0) {
        throw new Invalid(normalizer.issues)
      }
      return result
    }

    // MARK: Ops

    /**
     * Applies a batch of ops (JSON form, with string paths) to `data`, whole or not at all.
     * Without `sources` an embed is checked as far as it can be — target and keys — and applied
     * by the app. Throws `OpError`.
     */
    applying(data, ops, { sources = null, makeId = () => nextId('i') } = {}) {
      const parsed = parseBatch(ops)
      const root = { value: data }
      parsed.forEach((op, index) => {
        try {
          this._apply(op, root, sources, makeId)
        } catch (error) {
          if (error instanceof Invalid) {
            throw new OpError(index, error.issues)
          }
          throw error
        }
      })
      return isObject(root.value) ? root.value : {}
    }

    _apply(op, root, sources, makeId) {
      const path = op.path
      const description = describe(path)

      switch (op.op) {
      case 'embed': {
        const field = this.fieldAt(path)
        if (!field) {
          this.normalize(undefined, path)
          throw fail(issues.undeclared(description))
        }
        let kind
        let properties
        let isList
        if (field.list !== undefined && field.list.ref !== undefined) {
          kind = field.list.ref
          properties = field.list.properties ?? {}
          isList = true
        } else if (field.ref !== undefined) {
          kind = field.ref
          properties = field.properties ?? {}
          isList = false
        } else {
          throw fail(issues.notAReference(description))
        }

        let source = null
        if (sources) {
          source = sources[op.ref]
          if (!source) {
            throw fail(issues.missingSource(description, op.ref))
          }
          if (!source.kinds.includes(kind)) {
            throw fail(issues.invalidValue(description, `a reference to ${kind}`))
          }
        }
        for (const key of op.keys) {
          if (!Object.hasOwn(properties, key)) {
            throw fail(issues.undeclared(describe([...path, { key }])))
          }
        }
        if (!source) {
          // the app copies the entry
          return
        }

        const copy = { name: source.name, reference: op.ref }
        for (const key of op.keys) {
          if (key !== 'name' && key !== 'reference' && source.data[key] !== undefined && source.data[key] !== null) {
            copy[key] = source.data[key]
          }
        }
        const write = isList ? { op: 'insert', path, value: copy, index: op.index } : { op: 'set', path, value: copy }
        this._apply(write, root, sources, makeId)
        return
      }

      case 'set': {
        this._requireNotRoot(path)
        const value = this.normalize(op.value, path)
        const keepsId = this._isItemWithIds(path)
        root.value = this._modify(root.value, path, 0, (current) => {
          if (!keepsId || !isObject(value)) {
            return value
          }
          // the item stays the same item: it keeps its id, or gets one
          return { ...value, id: idOf(current) ?? makeId() }
        })
        return
      }

      case 'remove':
        this._requireNotRoot(path)
        // checks the path: declared, writable, selectors of the right form
        this.normalize(undefined, path)
        root.value = this._modify(root.value, path, 0, () => undefined)
        return

      case 'insert': {
        const list = this._listField(path)
        const hasIds = Boolean(list.ids || list.tree)
        root.value = this._modify(root.value, path, 0, (current) => {
          let items
          if (current === undefined || current === null) {
            items = []
          } else if (Array.isArray(current)) {
            items = [...current]
          } else {
            throw fail(issues.invalidValue(description, 'a list'))
          }
          const index = op.index ?? items.length
          if (index < 0 || index > items.length) {
            throw fail(issues.invalidIndex(description, index))
          }

          const givenId = hasIds ? idOf(op.value) : null
          const selector = hasIds ? givenId ?? makeId() : String(index)
          const itemPath = [...path, { selector }]
          const item = this.normalize(op.value, itemPath)
          if (!isObject(item)) {
            throw fail(issues.invalidValue(describe(itemPath), 'an object'))
          }
          if (hasIds) {
            if (items.some((existing) => idOf(existing) === selector)) {
              throw fail(issues.duplicateId(describe(itemPath)))
            }
            item.id = selector
          }
          items.splice(index, 0, item)
          return items
        })
        return
      }

      case 'move': {
        const last = path[path.length - 1]
        if (!last || last.selector === undefined) {
          throw fail(issues.invalidOp(description, 'move takes the path of a list item'))
        }
        const listPath = path.slice(0, -1)
        const list = this._listField(listPath)
        const index = op.index ?? 0
        root.value = this._modify(root.value, listPath, 0, (current) => {
          const from = Array.isArray(current) ? this._position(last.selector, current, Boolean(list.ids || list.tree)) : -1
          if (from < 0) {
            throw fail(issues.missingItem(description))
          }
          if (index < 0 || index >= current.length) {
            throw fail(issues.invalidIndex(description, index))
          }
          const items = [...current]
          items.splice(index, 0, ...items.splice(from, 1))
          return items
        })
        return
      }

      case 'test': {
        this._requireDeclared(path)
        let current
        try {
          current = this._valueAt(path, root.value)
        } catch {
          throw fail(issues.testFailed(description))
        }
        const expected = op.value
        const matches = current === undefined ? expected === undefined : expected !== undefined && isSame(current, expected)
        if (!matches) {
          throw fail(issues.testFailed(description))
        }
        return
      }
      }
    }

    _requireNotRoot(path) {
      if (path.length === 0) {
        throw fail(issues.notWritable('data'))
      }
    }

    /** Whether the schema declares the path; a list item's `id` counts, since a test only reads. */
    _requireDeclared(path) {
      try {
        this.normalize(undefined, path)
      } catch (error) {
        const description = describe(path)
        if (error instanceof Invalid && error.issues.length === 1 && error.issues[0].code === 'notWritable' && error.issues[0].path === description) {
          return
        }
        throw error
      }
    }

    _listField(path) {
      const field = this.fieldAt(path)
      if (!field) {
        this.normalize(undefined, path)
        throw fail(issues.undeclared(describe(path)))
      }
      if (field.list === undefined) {
        throw fail(issues.notAList(describe(path)))
      }
      return field
    }

    _isItemWithIds(path) {
      const last = path[path.length - 1]
      if (!last || last.selector === undefined) {
        return false
      }
      const list = this.fieldAt(path.slice(0, -1))
      return Boolean(list?.ids || list?.tree)
    }

    _hasIds(listPath) {
      const list = this.fieldAt(listPath)
      return Boolean(list?.ids || list?.tree)
    }

    _position(selector, items, hasIds) {
      if (hasIds) {
        return items.findIndex((item) => idOf(item) === selector)
      }
      if (!/^[+-]?\d+$/.test(selector)) {
        return -1
      }
      const index = Number(selector)
      return index >= 0 && index < items.length ? index : -1
    }

    /** The value at a path, `undefined` when a key is missing; throws for a missing list item. */
    _valueAt(path, root) {
      let current = root
      const position = []
      for (const segment of path) {
        if (segment.key !== undefined) {
          position.push(segment)
          current = isObject(current) ? current[segment.key] : undefined
        } else {
          const listPath = [...position]
          position.push(segment)
          const index = Array.isArray(current) ? this._position(segment.selector, current, this._hasIds(listPath)) : -1
          if (index < 0) {
            throw fail(issues.missingItem(describe(position)))
          }
          current = current[index]
        }
        if (current === null) {
          current = undefined
        }
      }
      return current
    }

    /**
     * The value with `body`'s result at the path; `undefined` removes it. Missing objects on the
     * way are created only when there is something to store; list items never are.
     */
    _modify(value, path, position, body) {
      if (position >= path.length) {
        return body(value)
      }
      const container = path.slice(0, position)
      const current = value === null ? undefined : value
      const segment = path[position]

      if (segment.key !== undefined) {
        if (current !== undefined && !isObject(current)) {
          throw fail(issues.invalidValue(describe(container), 'an object'))
        }
        const child = this._modify(current?.[segment.key], path, position + 1, body)
        if (current === undefined && child === undefined) {
          // nothing was there and nothing is stored
          return value
        }
        const updated = { ...(current ?? {}) }
        if (child === undefined) {
          delete updated[segment.key]
        } else {
          updated[segment.key] = child
        }
        return updated
      }

      const itemPath = path.slice(0, position + 1)
      const index = Array.isArray(current) ? this._position(segment.selector, current, this._hasIds(container)) : -1
      if (index < 0) {
        throw fail(issues.missingItem(describe(itemPath)))
      }
      const child = this._modify(current[index], path, position + 1, body)
      const items = [...current]
      if (child === undefined) {
        items.splice(index, 1)
      } else {
        items[index] = child
      }
      return items
    }
  }

  /** Converts values against their declarations, collecting every problem. */
  class Normalizer {
    constructor(schema) {
      this.schema = schema
      this.issues = []
    }

    value(value, field, implicit, path) {
      if (value === undefined || value === null) {
        return undefined
      }
      const description = describe(path)

      if (field.type !== undefined) {
        return this.primitive(value, field.type, field, path)
      }
      if (field.enum !== undefined) {
        return this.enumKey(value, field.enum, path)
      }
      if (field.set !== undefined) {
        if (!Array.isArray(value)) {
          this.issues.push(issues.invalidValue(description, 'a list'))
          return undefined
        }
        const result = []
        value.forEach((item, index) => {
          const converted = this.value(item, field.set, {}, [...path, { selector: String(index) }])
          if (converted !== undefined && !result.some((existing) => isSame(existing, converted))) {
            result.push(converted)
          }
        })
        return result
      }

      const object = this.schema.objectOf(field)
      if (object) {
        if (!isObject(value)) {
          this.issues.push(issues.invalidValue(description, 'an object'))
          return undefined
        }
        const result = {}
        for (const key of Object.keys(value).sort()) {
          const keyPath = [...path, { key }]
          const property = Object.hasOwn(object, key) ? object[key] : Object.hasOwn(implicit, key) ? implicit[key] : null
          if (!property) {
            this.issues.push(issues.undeclared(describe(keyPath)))
            continue
          }
          const converted = this.value(value[key], property, {}, keyPath)
          if (converted !== undefined) {
            result[key] = converted
          }
        }
        return result
      }

      if (field.map !== undefined) {
        if (!isObject(value)) {
          this.issues.push(issues.invalidValue(description, 'an object'))
          return undefined
        }
        const result = {}
        for (const key of Object.keys(value).sort()) {
          const keyPath = [...path, { key }]
          if (!this.schema.isValidMapKey(key, field.keys)) {
            this.issues.push(issues.invalidKey(describe(keyPath)))
            continue
          }
          const converted = this.value(value[key], field.map, {}, keyPath)
          if (converted !== undefined) {
            result[key] = converted
          }
        }
        return result
      }

      if (field.list !== undefined) {
        if (!Array.isArray(value)) {
          this.issues.push(issues.invalidValue(description, 'a list'))
          return undefined
        }
        return this.list(value, field, path)
      }
      return undefined
    }

    /** A whole list written: every item is new; items in a list with ids get one. */
    list(array, field, path) {
      const implicit = Schema.implicitProperties(field)
      const hasIds = Boolean(field.ids || field.tree)
      const items = []
      array.forEach((element, index) => {
        const id = hasIds ? idOf(element) : null
        const converted = this.value(element, field.list, implicit, [...path, { selector: id ?? String(index) }])
        if (converted !== undefined) {
          items.push(converted)
        }
      })
      const ids = new Set()
      for (const item of items) {
        if (hasIds && isObject(item) && idOf(item) === null) {
          item.id = nextId('i')
        }
        const id = hasIds ? idOf(item) : null
        if (id !== null) {
          if (ids.has(id)) {
            this.issues.push(issues.duplicateId(describe([...path, { selector: id }])))
          }
          ids.add(id)
        }
      }
      return items
    }

    primitive(value, type, field, path) {
      const description = describe(path)
      switch (type) {
      case 'integer': {
        let result = null
        if (typeof value === 'number') {
          result = wholeNumber(value)
        } else if (typeof value === 'string') {
          const text = value.trim()
          if (text === '') {
            return undefined
          }
          result = /^[+-]?\d+$/.test(text) ? Number(text) : Number.isNaN(Number(text)) ? null : wholeNumber(Number(text))
        }
        if (result === null) {
          this.issues.push(issues.invalidValue(description, 'a whole number'))
          return undefined
        }
        return this.inRange(result, field, description) ? result : undefined
      }
      case 'number': {
        let result = null
        if (typeof value === 'number') {
          result = Number.isFinite(value) ? value : null
        } else if (typeof value === 'string') {
          const text = value.trim()
          if (text === '') {
            return undefined
          }
          const number = Number(text)
          result = Number.isFinite(number) ? number : null
        }
        if (result === null) {
          this.issues.push(issues.invalidValue(description, 'a number'))
          return undefined
        }
        return this.inRange(result, field, description) ? result : undefined
      }
      case 'boolean':
        if (typeof value === 'boolean') {
          return value
        }
        if (typeof value === 'string') {
          const text = value.trim().toLowerCase()
          if (text === 'true') {
            return true
          }
          if (text === 'false') {
            return false
          }
          if (text === '') {
            return undefined
          }
        }
        this.issues.push(issues.invalidValue(description, 'true or false'))
        return undefined
      case 'url':
        if (typeof value !== 'string') {
          this.issues.push(issues.invalidValue(description, 'a URL'))
          return undefined
        }
        return value === '' ? undefined : value
      default:
        // string, text, dice
        if (typeof value !== 'string') {
          this.issues.push(issues.invalidValue(description, type === 'dice' ? 'a dice formula' : 'text'))
          return undefined
        }
        return value
      }
    }

    enumKey(value, name, path) {
      let text = null
      if (typeof value === 'string') {
        if (value === '') {
          return undefined
        }
        text = value
      } else if (typeof value === 'number' && wholeNumber(value) !== null) {
        text = String(value)
      }
      const keys = this.schema.enums[name] ?? []
      const key = text === null ? undefined : keys.find((candidate) => String(candidate) === text)
      if (key !== undefined) {
        return key
      }
      this.issues.push(issues.invalidValue(describe(path), `a key of ${name}`))
      return undefined
    }

    inRange(number, field, description) {
      if ((field.min !== undefined && number < field.min) || (field.max !== undefined && number > field.max)) {
        this.issues.push(issues.outOfRange(description, field.min, field.max))
        return false
      }
      return true
    }
  }

  const schemas = new Map()

  /** The runtime schema at an address, loaded once. */
  function loadSchema(address) {
    if (!schemas.has(address)) {
      schemas.set(address, fetch(address)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`schema not available: ${response.status}`)
          }
          return response.json()
        })
        .then((runtime) => new Schema(runtime))
        .catch((error) => {
          schemas.delete(address)
          console.warn('ep.js:', error.message)
          return null
        }))
    }
    return schemas.get(address)
  }

  // MARK: Store

  /** One write waiting to be sent or acknowledged: a batch of operations and its promise. */
  class Batch {
    constructor(ops) {
      this.id = nextId('b')
      this.ops = ops
      this.requestId = null
      this.promise = new Promise((resolve, reject) => {
        this.resolve = resolve
        this.reject = reject
      })
    }

    /** The path of a batch that is a single `set`, which a later `set` of the path may replace. */
    get setPath() {
      return this.ops.length === 1 && this.ops[0].op === 'set' ? this.ops[0].path : null
    }
  }

  class EntityStore extends EventTarget {
    constructor(id) {
      super()
      this.id = id
      /** The entity as the app last sent it, and what the app computes for it. */
      this.base = { data: {} }
      this.derived = {}
      /** The batch with the app, and those waiting behind it. */
      this.sent = null
      this.queue = []
      /** `connecting`, `connected` or `disconnected`; `hasState` once any state is known. */
      this.status = 'connecting'
      this.hasState = false
      this.connected = null
      /** Whether the view wants to follow the entity, and whether the app has it subscribed now. */
      this.following = false
      this.subscribed = false
      this.listeners = new Set()
      /** The entity type's checks, once loaded; see `Schema`. */
      this.schema = null
      /** The view's environment (`dataURL`, `systemURL`, …), from the first state. */
      this.env = null
      this._seed()
      this._rebuild(false)
    }

    // MARK: Reading

    /** The current snapshot `{ model, view, pending, status }`, immutable. */
    get snapshot() {
      return this._snapshot
    }

    /** The entity with this view's unacknowledged changes applied. */
    get model() {
      return this._snapshot.model
    }

    /** The model with the app's computed values laid over it. */
    get view() {
      return this._snapshot.view
    }

    /** A value by path: from the model, or from the view with a `view.` prefix. */
    get(path) {
      if (typeof path === 'string' && (path === 'view' || path.startsWith('view.') || path.startsWith('view['))) {
        return path === 'view' ? this.view : valueAt(this.view, parsePath(path.slice(5)))
      }
      return valueAt(this.model, parsePath(path))
    }

    /**
     * A path as content stores it — an image, a file — as the page reaches it, the way the
     * templates' `resolvePath` filter does: `/systems/…`, `/modules/…`, `/campaigns/…` as they
     * are, other `/`-prefixed paths in the system, relative ones in the entity's container.
     * Addresses with a scheme (`https:`, `data:`) stay as they are; so does everything until the
     * first state brings the environment.
     */
    resolvePath(path) {
      if (typeof path !== 'string' || path === '' || /^[a-z][a-z0-9+.-]*:/i.test(path) || /^\/(systems|modules|campaigns)\//.test(path)) {
        return path
      }
      const base = path.startsWith('/') ? this.env?.systemURL : this.env?.dataURL
      return typeof base === 'string' && base ? `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}` : path
    }

    /**
     * Calls `fn` with the snapshot now and after every change, and follows the entity. Returns
     * the function that stops calling it.
     */
    subscribe = (fn) => {
      this.listeners.add(fn)
      fn(this._snapshot)
      this.connect().catch((error) => console.warn('ep.js:', error.message))
      return () => {
        this.listeners.delete(fn)
      }
    }

    /**
     * Follows the entity: the app sends it now, and again on every change. Resolves with the
     * store, so `const hero = await EP.entity.connect()` reads naturally.
     */
    connect() {
      this.following = true
      if (!this.connected) {
        this._setStatus('connecting')
        this.connected = request('subscribeEntity', { id: this.id, api: API }).answer
          .then(() => {
            this.subscribed = true
            this._flush()
            return this
          })
          .catch((error) => {
            // a later call tries again
            this.connected = null
            this._setStatus('disconnected')
            throw error
          })
      }
      return this.connected
    }

    /** Stops following the entity. */
    disconnect() {
      this.following = false
      this.subscribed = false
      this.connected = null
      this._setStatus('disconnected')
      send({ name: 'unsubscribeEntity', data: { id: this.id } }).catch(() => {})
    }

    // MARK: Writing

    set(path, value) {
      return this.apply([{ op: 'set', path: writable(path), value: value === undefined ? null : value }])
    }

    remove(path) {
      return this.apply([{ op: 'remove', path: writable(path) }])
    }

    insert(path, value, index) {
      return this.apply([index === undefined ? { op: 'insert', path: writable(path), value } : { op: 'insert', path: writable(path), value, index }])
    }

    move(path, index) {
      return this.apply([{ op: 'move', path: writable(path), index }])
    }

    /**
     * Adds a copy of a library entry — a reference such as `/item/axe`, or what `EP.pick` and
     * `EP.query` give — to a list of references (at `index`, else at the end), or puts it in a
     * single reference field. The app copies the entry's name and reference and the listed `keys`
     * of its data, and checks the copy like any write.
     */
    embed(path, entry, keys = [], index) {
      const ref = typeof entry === 'string' ? entry : entry?.reference
      if (!ref) {
        throw new EPError([{ code: 'invalidOp', path: String(path), message: `${path}: embed needs an entry's reference` }])
      }
      const op = { op: 'embed', path: writable(path), ref, keys: [...keys], _name: typeof entry === 'string' ? undefined : entry.name }
      if (index !== undefined) {
        op.index = index
      }
      return this.apply([op])
    }

    /**
     * Changes the entity's `data` in one batch: `fn` gets a copy to change (or returns a new
     * one), and what it changed is sent. Resolves when the app has applied it.
     */
    update(fn) {
      const before = clone(this.model.data ?? {})
      const draft = clone(before)
      const result = fn(draft)
      if (result instanceof Promise) {
        throw new Error('ep.js: update takes a synchronous function')
      }
      const ops = diff(before, result === undefined ? draft : result, 'data')
      return ops.length ? this.apply(ops) : Promise.resolve()
    }

    /**
     * Sends a batch of operations, applied whole or not at all. The view shows it at once; the
     * promise resolves when the app has applied it and rejects with an `EP.Error` when the app
     * refused it.
     */
    apply(ops) {
      for (const op of ops) {
        writable(op.path)
      }
      const refused = this._check(ops)
      if (refused) {
        this.dispatchEvent(new CustomEvent('error', { detail: { errors: refused.errors, ops } }))
        return Promise.reject(refused)
      }
      ops = this._converted(ops)

      // a set of a path still waiting replaces the waiting value
      const path = ops.length === 1 && ops[0].op === 'set' ? ops[0].path : null
      const waitingSet = path ? this.queue.find((batch) => batch.setPath === path) : null
      if (waitingSet) {
        waitingSet.ops = [{ ...ops[0] }]
        this._rebuild()
        return waitingSet.promise
      }

      const batch = new Batch(ops.map((op) => ({ ...op })))
      this.queue.push(batch)
      this._rebuild()
      this._flush()
      return batch.promise
    }

    // MARK: Internals

    /** The ops with the values of `set`s converted as the app will store them (`"7"` → `7`), once the schema is known. */
    _converted(ops) {
      if (!this.schema) {
        return ops
      }
      return ops.map((op) => {
        if (op.op !== 'set') {
          return op
        }
        const value = this.schema.normalize(op.value, parseDataPath(op.path))
        return { ...op, value: value === undefined ? null : value }
      })
    }

    /** The `EP.Error` the app would answer a batch with, from the schema; `null` when it passes or there is none yet. */
    _check(ops) {
      if (!this.schema) {
        return null
      }
      try {
        const sendable = ops.map((op) => Object.fromEntries(Object.entries(op).filter(([key]) => !key.startsWith('_'))))
        this.schema.applying(this.model.data ?? {}, sendable)
        return null
      } catch (error) {
        if (error instanceof OpError) {
          return new EPError(error.issues.map((issue) => ({ index: error.index, ...issue })), ops)
        }
        throw error
      }
    }

    /**
     * The entity's first state, which the app's web views set on the window before the page loads
     * (`encounterplusStartingState`): the view draws the entity at once, and the first state
     * received changes nothing. A browser starts without it, so `hasState` stays false until the
     * subscription answers; a state for another entity is left alone.
     */
    _seed() {
      const state = window.encounterplusStartingState
      if (!isObject(state) || state.id !== this.id) {
        return
      }
      try {
        // a copy: the page's object stays as the app set it
        this.base = clone(state.model ?? state.view) ?? { data: {} }
        this.base.data ??= {}
        this.derived = clone(state.derived) ?? {}
        this.hasState = true
        this._takeFirstState(state)
      } catch (error) {
        console.warn('ep.js: unreadable starting state', error)
      }
    }

    /** What the first state carries beside the entity: the environment, and the labels' and schema's addresses. */
    _takeFirstState(state) {
      if (state.env) {
        this.env = state.env
      }
      if (state.system?.labels) {
        loadLabels(state.system.labels)
      }
      if (state.schema && !this.schema) {
        loadSchema(state.schema).then((schema) => {
          if (schema && !this.schema) {
            this.schema = schema
            this.dispatchEvent(new Event('schema'))
          }
        })
      }
    }

    /** Sends the next waiting batch, when the app holds none and the store is subscribed. */
    _flush() {
      if (this.sent || !this.subscribed || this.queue.length === 0) {
        return
      }
      const batch = this.queue.shift()
      batch.ops = this._guarded(batch.ops)
      this.sent = batch

      // keys starting with _ are the store's own (an embed's name until the app answers)
      const ops = batch.ops.map((op) => Object.fromEntries(Object.entries(op).filter(([key]) => !key.startsWith('_'))))
      const { requestId, answer } = request('updateEntity', { id: this.id, batch: batch.id, ops }, { ops })
      batch.requestId = requestId
      // resolved by the entityUpdated that lists the batch, see _receive
      answer.then(() => batch.resolve(), (error) => this._refused(batch, error))
    }

    _refused(batch, error) {
      if (this.sent === batch) {
        this.sent = null
      }
      this.queue = this.queue.filter((waiting) => waiting !== batch)
      this._rebuild()
      const errors = error.errors ?? [{ message: error.message }]
      this.dispatchEvent(new CustomEvent('error', { detail: { errors, ops: batch.ops } }))
      batch.reject(error instanceof EPError ? error : new EPError(errors, batch.ops))
      this._flush()
    }

    /** The connection closed: following the entity ends until the store subscribes again. */
    _disconnected() {
      this.subscribed = false
      this.connected = null
      this._setStatus('disconnected')
    }

    /** Subscribes again after the web socket closed, if the store was following its entity. */
    _resubscribe() {
      if (!this.following || this.connected) {
        return
      }
      this.connect().catch((error) => console.warn('ep.js:', error.message))
    }

    /**
     * Takes an `entityUpdated`. Acknowledges the batch in `ack`, then dispatches `change`, and
     * `state` with `acknowledged` (this view's batches the entity includes), `changed` (whether the
     * stored entity differs from the last one, `modified` aside) and `paths` (where the view
     * changed; see `changedPaths`). A change made elsewhere, such as in the entity's form, arrives
     * with `changed` and nothing acknowledged.
     */
    _receive(state) {
      const previous = this.base
      const previousView = this.view
      this.base = state.model ?? { data: {} }
      this.base.data ??= {}
      this.derived = state.derived ?? {}
      this.hasState = true
      this.status = 'connected'
      this._takeFirstState(state)

      const acknowledged = new Set(state.ack ?? [])
      const sent = this.sent
      if (sent && acknowledged.has(sent.id)) {
        this.sent = null
        waiting.get(sent.requestId)?.resolve()
      }
      this._rebuild()
      this._flush()

      const { modified: _previousModified, ...previousEntity } = previous
      const { modified: _modified, ...entity } = this.base
      const paths = changedPaths(previousView, this.view).filter((path) => path !== 'modified' && !path.startsWith('modified.'))
      this.dispatchEvent(new CustomEvent('state', { detail: { acknowledged: [...acknowledged], changed: !isSame(previousEntity, entity), paths } }))
    }

    _deleted() {
      this.following = false
      this.subscribed = false
      this.connected = null
      this._setStatus('disconnected')
      this.dispatchEvent(new CustomEvent('deleted'))
    }

    _setStatus(status) {
      if (this.status !== status) {
        this.status = status
        this._rebuild()
      }
    }

    /** Builds a new snapshot and tells everyone following the store. */
    _rebuild(notify = true) {
      const model = clone(this.base)
      for (const batch of [this.sent, ...this.queue]) {
        for (const op of batch?.ops ?? []) {
          try {
            applyLocally(model, op)
          } catch (error) {
            console.warn('ep.js: operation not applied locally', op, error)
          }
        }
      }
      const pending = (this.sent ? 1 : 0) + this.queue.length
      this._snapshot = freeze({ model, view: laidOver(model, this.derived), pending, status: this.status })
      if (!notify) {
        return
      }
      for (const listener of [...this.listeners]) {
        try {
          listener(this._snapshot)
        } catch (error) {
          console.error('ep.js: subscriber failed', error)
        }
      }
      this.dispatchEvent(new Event('change'))
    }

    /**
     * Guards writes into items addressed by position with a `test` of the item as the app has it,
     * so the app refuses them if another change moved the items meanwhile.
     */
    _guarded(ops) {
      const guards = []
      const guarded = new Set()
      for (const op of ops) {
        if (op.op === 'test' || op.op === 'embed') {
          continue
        }
        let prefix = ''
        let node = this.base
        for (const segment of parsePath(op.path)) {
          if (segment.key !== undefined) {
            prefix += prefix ? `.${segment.key}` : segment.key
            node = isObject(node) ? node[segment.key] : undefined
            continue
          }
          prefix += `[${segment.selector}]`
          const index = Array.isArray(node) ? itemIndex(node, segment.selector) : -1
          const item = index < 0 ? undefined : node[index]
          const byPosition = /^\d+$/.test(segment.selector) && !(isObject(item) && item.id === segment.selector)
          if (byPosition && !guarded.has(prefix)) {
            guarded.add(prefix)
            guards.push({ op: 'test', path: prefix, value: clone(item) ?? null })
          }
          node = item
        }
      }
      return [...guards, ...ops.filter((op) => !(op.op === 'test' && guarded.has(op.path)))]
    }
  }

  // MARK: Binding

  /** The bindings made with `EP.bind`, rendered again when labels arrive or a region refreshes. */
  const bindings = new Set()

  /**
   * Binds the elements under `root` to a store, and connects it:
   *
   * - `data-bind="data.…"` — an input, select or text area shows the value and writes it on
   *   `change`. A checkbox writes `true`/`false`, a number input a number (empty removes), a radio
   *   its value when picked. An input being edited is left alone.
   * - `data-text="path"` — the value as text; with `data-label="Enum"`, its label.
   * - `data-count="data.…"` — a count drawn across the checkboxes inside: the first `count` are
   *   ticked; ticking one sets the count to it, unticking the last ticked lowers it by one.
   *   `data-max="path"` disables those past the maximum.
   * - `data-bar="path"` with `data-max="path"` — a value against a maximum: `value` and `max` of
   *   a `<progress>` or `<meter>`, else the `--value`, `--max` and `--ratio` CSS variables.
   *
   * Nothing is rendered before the entity's state is known, so the values a template rendered
   * stay until then. Returns the binding: `shows(path)` tells whether an element shows a path
   * (`data.…`, view paths without their prefix), so a view can tell what it must render again
   * itself; `render()` and `unbind()`.
   */
  function bind(root, store) {
    const elements = () => root.querySelectorAll('[data-bind], [data-text], [data-count], [data-bar]')

    function render() {
      if (!store.hasState) {
        return
      }
      for (const element of elements()) {
        if (element.dataset.bind !== undefined) {
          renderInput(element, store.get(element.dataset.bind))
        }
        if (element.dataset.text !== undefined) {
          const value = store.get(element.dataset.text)
          const text = element.dataset.label ? EP.label(element.dataset.label, value) : value
          element.textContent = text === undefined || text === null ? '' : String(text)
        }
        if (element.dataset.count !== undefined) {
          renderCount(element, Number(store.get(element.dataset.count) ?? 0), maximum(element))
        }
        if (element.dataset.bar !== undefined) {
          renderBar(element, Number(store.get(element.dataset.bar) ?? 0), maximum(element))
        }
      }
    }

    function maximum(element) {
      if (!element.dataset.max) {
        return undefined
      }
      const value = store.get(element.dataset.max)
      return value === undefined || value === null || value === '' ? undefined : Number(value)
    }

    function onChange(event) {
      const target = event.target
      const count = target.closest?.('[data-count]')
      if (count && root.contains(count) && target.type === 'checkbox') {
        const boxes = [...count.querySelectorAll('input[type="checkbox"]')]
        const index = boxes.indexOf(target) + 1
        const current = Number(store.get(count.dataset.count) ?? 0)
        store.set(count.dataset.count, index === current ? index - 1 : index).catch(() => {})
        return
      }

      const element = target.closest?.('[data-bind]')
      if (!element || !root.contains(element)) {
        return
      }
      let value = element.value
      if (element.type === 'checkbox') {
        value = element.checked
      } else if (element.type === 'radio') {
        if (!element.checked) {
          return
        }
      } else if (element.type === 'number' || element.type === 'range') {
        value = element.value === '' ? null : Number(element.value)
      }
      // a refusal reaches the view as the store's error event; the input shows the stored value again
      store.set(element.dataset.bind, value).catch((error) => console.warn('ep.js:', error.message))
    }

    // inputs bound to paths the schema doesn't let anyone write, said once when it loads
    function warn() {
      if (!store.schema) {
        return
      }
      for (const element of root.querySelectorAll('[data-bind], [data-count]')) {
        const path = element.dataset.bind ?? element.dataset.count
        if (!store.schema.isWritable(path)) {
          console.warn(`ep.js: ${path} can't be written; the schema doesn't declare it or the app manages it`, element)
        }
      }
    }

    root.addEventListener('change', onChange)
    store.addEventListener('change', render)
    store.addEventListener('schema', warn)
    render()
    warn()

    const binding = {
      render,
      shows(path) {
        for (const element of elements()) {
          for (const shown of [element.dataset.bind, element.dataset.text, element.dataset.count, element.dataset.bar, element.dataset.max]) {
            if (shown && shown.replace(/^view\./, '') === path) {
              return true
            }
          }
        }
        return false
      },
      unbind() {
        root.removeEventListener('change', onChange)
        store.removeEventListener('change', render)
        store.removeEventListener('schema', warn)
        bindings.delete(binding)
      }
    }
    bindings.add(binding)
    store.connect().catch((error) => console.warn('ep.js:', error.message))
    return binding
  }

  function renderInput(element, value) {
    if (element.type === 'checkbox') {
      element.checked = value === true
    } else if (element.type === 'radio') {
      element.checked = value !== undefined && value !== null && String(value) === element.value
    } else if (element !== document.activeElement) {
      const text = value === undefined || value === null ? '' : String(value)
      if (element.value !== text) {
        element.value = text
      }
    }
  }

  function renderCount(element, count, max) {
    element.querySelectorAll('input[type="checkbox"]').forEach((box, position) => {
      const index = position + 1
      box.checked = index <= count
      box.disabled = max !== undefined && index > max
    })
  }

  function renderBar(element, value, max) {
    if (element instanceof HTMLProgressElement || element instanceof HTMLMeterElement) {
      if (max !== undefined) {
        element.max = max
      }
      element.value = value
      return
    }
    element.style.setProperty('--value', String(value))
    if (max !== undefined) {
      element.style.setProperty('--max', String(max))
      element.style.setProperty('--ratio', String(max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0))
    }
  }

  /** Renders every binding again: labels as they arrive, regions as they refresh. */
  function renderBindings() {
    for (const binding of bindings) {
      binding.render()
    }
  }

  // MARK: Refreshing

  /**
   * Renders regions of the page again from the server, for what the bindings don't cover — a
   * list that gained a row, a name in a heading: fetches the page and replaces the contents of
   * each element matching `selector` with their new version, then renders the bindings into it.
   */
  async function refresh(selector = 'main') {
    const response = await fetch(location.href)
    const page = new DOMParser().parseFromString(await response.text(), 'text/html')
    const fresh = page.querySelectorAll(selector)
    document.querySelectorAll(selector).forEach((element, index) => {
      if (fresh[index]) {
        element.innerHTML = fresh[index].innerHTML
      }
    })
    renderBindings()
  }

  // MARK: Entry point

  const stores = new Map()

  const EP = {
    version: API,

    Error: EPError,

    /**
     * Settings: `server` is the app's web server, for a sheet served from elsewhere; `picker`
     * lets the user pick library entries in a browser — `({ entity, multiple }) => entries`, an
     * empty list when cancelled — as `ep-ui.js`'s dialog does; `onRoll` is called with each
     * roll's result in a browser — `({ name, formula, result, detail }) => void` — as
     * `ep-ui.js`'s banner shows it.
     */
    configure(options = {}) {
      if (options.server !== undefined) {
        settings.server = options.server
      }
      if (options.picker !== undefined) {
        settings.picker = options.picker
      }
      if (options.onRoll !== undefined) {
        settings.onRoll = options.onRoll
      }
    },

    /**
     * The store of the entity the view shows, or `null` in a view that shows none: the entity of
     * a template view (`<html data-entity-id>`), or the one a sheet's address names
     * (`/sheets/<sheet>/?id=<entity-id>`).
     */
    get entity() {
      const id = document.documentElement.dataset.entityId || new URLSearchParams(location.search).get('id')
      return id ? EP.entities.get(id) : null
    },

    /** Stores by entity id. */
    entities: {
      get(id) {
        if (!stores.has(id)) {
          stores.set(id, new EntityStore(id))
        }
        return stores.get(id)
      }
    },

    bind,
    refresh,

    /**
     * Rolls dice: the app's dice roller and log in the app, the shared log in a browser.
     * `label` names the roll.
     *
     * In a browser the roll is a `createMessage` request: the app rolls the `/roll` command, logs
     * it, and answers with the logged message. Resolves with the result,
     * `{ name, formula, result, detail }`, after passing it to the configured `onRoll`; rejects
     * with an `EP.Error` when the app could not roll it (`Invalid expression`). In the app the
     * dice roller shows the result, and it resolves with `null`.
     */
    async roll(formula, { label } = {}) {
      if (messageHandler()) {
        const name = label ? `/${encodeURIComponent(label)}` : ''
        location.assign(`/roll/${encodeURIComponent(formula)}${name}`)
        return null
      }
      const creature = EP.entity?.model?.name
      const { answer } = request('createMessage', {
        type: 'command', content: `/roll ${formula}${label ? ` [${label}]` : ''}`, ...(creature ? { creature } : {})
      })
      const message = (await answer).data
      if (message?.type !== 'roll' || !message.content) {
        throw new EPError([{ message: typeof message?.content === 'string' ? message.content : 'the app could not roll it' }])
      }
      const { name, formula: rolled, result, detail } = message.content
      const outcome = { name: name ?? label, formula: rolled ?? formula, result, detail }
      try {
        settings.onRoll?.(outcome)
      } catch (error) {
        console.warn('ep.js: onRoll failed', error)
      }
      return outcome
    },

    /**
     * The loaded system's library entries of a kind (and the kinds extending it), by name:
     * `{ id, name, kind, reference, source? }`. `search` matches part of the name.
     */
    async query({ entity, search, limit } = {}) {
      const { answer } = request('queryEntities', { entity, ...(search ? { search } : {}), ...(limit ? { limit } : {}) })
      return (await answer).data?.entities ?? []
    },

    /**
     * Lets the user pick library entries of a kind: the app's library list in the app, the
     * configured `picker` in a browser (`EP.configure`), and without one rejects — `EP.query`
     * lists the entries for a view that draws its own. Resolves with the entry
     * (`{ id, name, kind, reference }`), or `null` when the user cancels; with `multiple`, with a
     * list.
     */
    async pick({ entity, multiple = false } = {}) {
      let entities
      if (messageHandler()) {
        const { answer } = request('pickEntity', { entity }, { timeout: null })
        entities = (await answer).data?.entities ?? []
      } else if (settings.picker) {
        entities = (await settings.picker({ entity, multiple })) ?? []
      } else {
        throw new EPError([{ code: 'unsupported', message: 'no library picker in a browser: load ep-ui.js or configure a picker' }])
      }
      return multiple ? entities : entities[0] ?? null
    },

    /** The system's text for a key, in its language; the key itself until the labels load. */
    t(key) {
      return labels?.strings?.[key] ?? key
    },

    /** The label of an enum key — `EP.label('Kin', 'elf')`; the key itself when there is none. */
    label(name, value) {
      if (value === undefined || value === null) {
        return ''
      }
      return labels?.enums?.[name]?.[String(value)] ?? String(value)
    },

    /**
     * Resolves with the system's labels once they have loaded — the first state brings their
     * address — so a view can render its texts again; until then `t` and `label` give keys.
     */
    labels() {
      return labelsReady
    },

    /**
     * Opens a reference — `/item/broadsword`, `/sheets/hero/?id=…` — the way a link to it
     * would: the app shows it, a browser goes to it.
     */
    open(reference) {
      location.assign(reference)
    },

    /** Called with every event from the app: the web socket's messages and the web views' window events. */
    _receive(event) {
      if (event?.name === 'entityUpdated') {
        stores.get(event.data?.id)?._receive(event.data)
      } else if (event?.name === 'entityDeleted') {
        stores.get(event.data?.id)?._deleted()
      }
      if (event?.responseId === undefined) {
        return
      }
      const waiter = waiting.get(event.responseId)
      if (!waiter) {
        return
      }
      if (event.name === 'requestFailed') {
        waiter.reject(new EPError(event.data?.errors ?? [{ message: event.data?.message ?? 'refused' }], waiter.ops))
      } else {
        waiter.resolve(event)
      }
    }
  }

  // the pure helpers, for tests run outside a page
  EP._internal = { parsePath, diff, applyLocally, laidOver, changedPaths, isSame, Schema, parseBatch, OpError }

  window.EP = EP

  // bindings show the labels' texts once they arrive
  labelsReady.then(renderBindings)

  // the app's web views deliver every event as a window event, the in-app counterpart of the web
  // socket's messages
  window.addEventListener('encounterplus:message', (event) => EP._receive(event.detail))
})()
