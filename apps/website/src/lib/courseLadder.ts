// The course ladder on t27.ai: which course this reader may open, and with which key.
//
// Every rule is gHashTag/t27 specs/automation/course-access.t27 (vendored as
// specs/ladder/course-access.t27) run from its own compiled fn bodies
// (courseAccess.logic.ts); every number is its gen-ts (courseAccess.gen.ts); every word and
// the render's address are specs/ladder/course-ladder.t27 (courseLadder.generated.ts).
// scripts/course-ladder-from-spec.mjs stops the build when a copy drifts from its spec.
// This file only keeps the reader's state in this browser and talks to the render.
import * as RULES from './courseAccess.gen'
import { mayOpen, mayReport, staysOpen, stepOf } from './courseAccess.logic'
import { LADDER } from './courseLadder.generated'
// The utm_source this session arrived with, as trafficArrival.ts keeps it.
import { SOURCE_KEY } from './trafficArrival'

/** The courses this reader opened, in the order they were opened, with the rung each took. */
export type Opened = { id: string; step: number }[]
/** The keys the bot handed back: one per step that needs proof. */
export type Keys = { bot?: string; paid?: string }
export type KeyCheck = { ok: boolean; step?: number; until?: string; reason?: string }

const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  },
  set(key: string, value: unknown) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // private mode: the ladder lives as long as the tab
    }
  },
}

/**
 * The opened courses. A reader who studied before the ladder existed keeps every course they
 * has progress in, open on a free rung: the ladder must not lock anybody out of their own work.
 */
export function readOpened(known: readonly string[], withProgress: readonly string[]): Opened {
  const stored = store.get<Opened | null>(LADDER.openKey, null)
  if (Array.isArray(stored)) {
    return stored.filter((o) => o && typeof o.id === 'string' && known.includes(o.id) && Number.isInteger(o.step))
  }
  const seeded = withProgress.filter((id) => known.includes(id)).map((id) => ({ id, step: RULES.STEP_FREE }))
  if (seeded.length) store.set(LADDER.openKey, seeded)
  return seeded
}

export function readKeys(): Keys {
  const k = store.get<Keys>(LADDER.keysKey, {})
  return { bot: typeof k.bot === 'string' ? k.bot : undefined, paid: typeof k.paid === 'string' ? k.paid : undefined }
}

export function saveKeys(keys: Keys) {
  store.set(LADDER.keysKey, keys)
}

/** Where this course stands for this reader: open, and on which rung, or the step it needs. */
export function courseState(id: string, opened: Opened, valid: { bot: boolean; paid: boolean }) {
  const at = opened.findIndex((o) => o.id === id)
  if (at >= 0) {
    const step = opened[at].step
    return { known: true, open: staysOpen(step, valid.paid), rung: at + 1, step }
  }
  const step = stepOf(Math.min(opened.length, 255))
  return { known: false, open: false, rung: opened.length + 1, step, mayOpenNow: mayOpen(step, valid.bot, valid.paid) }
}

/** How many more courses open free from here: the rules' own step_of, asked rung by rung. */
export function freeLeft(opened: Opened): number {
  let n = 0
  for (let at = opened.length; at < 255 && stepOf(at) === RULES.STEP_FREE; at++) n++
  return n
}

/** The opened list with this course added, when its step allows; unchanged otherwise. */
export function openCourse(id: string, opened: Opened, valid: { bot: boolean; paid: boolean }): Opened {
  if (opened.some((o) => o.id === id)) return opened
  const step = stepOf(Math.min(opened.length, 255))
  if (!mayOpen(step, valid.bot, valid.paid)) return opened
  const next = [...opened, { id, step }]
  store.set(LADDER.openKey, next)
  return next
}

/** The bot link for a step that needs proof: t.me/<bot>?start=course_<bot|paid>_<route>. */
export function startLink(step: number, route: string): string {
  const word = step === RULES.STEP_PAID ? 'paid' : 'bot'
  return `https://t.me/${RULES.BOT}?start=${RULES.START_PREFIX}${word}_${route}`
}

export async function checkKey(k: string): Promise<KeyCheck> {
  try {
    const r = await fetch(`${LADDER.renderBase}/api/course/key?k=${encodeURIComponent(k)}`, { credentials: 'omit' })
    const body = (await r.json()) as KeyCheck
    return body && typeof body.ok === 'boolean' ? body : { ok: false, reason: 'unreadable' }
  } catch {
    return { ok: false, reason: 'unreachable' }
  }
}

/**
 * The render's on-site checkout. Roubles (on) only once it has Robokassa set; TON (ton.on) only
 * once it has a wallet and a TON rate. The two switch on independently.
 */
export type Offer = { on: boolean; rub?: number; days?: number; ton?: { on: boolean; amount?: number } }
/** Where and how much to send for a TON order, as the render answers it. */
export type TonTransfer = { address: string; amount: number; nano: string; comment: string; link: string; expiresAt?: string }
export type Order = { ok: boolean; status?: 'pending' | 'paid' | 'expired'; key?: string; until?: string; reason?: string; ton?: TonTransfer }

function readTonTransfer(t: unknown): TonTransfer | undefined {
  const o = t as Partial<TonTransfer> | null
  if (!o || typeof o.address !== 'string' || typeof o.comment !== 'string' || typeof o.nano !== 'string') return undefined
  if (typeof o.amount !== 'number' || !(o.amount > 0)) return undefined
  // Only a TON transfer link is ever handed to the wallet button.
  if (typeof o.link !== 'string' || !o.link.startsWith('ton://transfer/')) return undefined
  return { address: o.address, amount: o.amount, nano: o.nano, comment: o.comment, link: o.link, expiresAt: typeof o.expiresAt === 'string' ? o.expiresAt : undefined }
}

export async function checkoutOffer(): Promise<Offer> {
  try {
    const r = await fetch(`${LADDER.renderBase}/api/course/checkout`, { credentials: 'omit' })
    const body = (await r.json()) as Offer
    const rubOn = Boolean(body && body.on === true && Number.isInteger(body.rub) && (body.rub ?? 0) > 0)
    const t = body?.ton
    const ton = t && t.on === true && typeof t.amount === 'number' && t.amount > 0 ? { on: true, amount: t.amount } : { on: false }
    return rubOn ? { on: true, rub: body.rub, days: body.days, ton } : { on: false, days: body?.days, ton }
  } catch {
    return { on: false, ton: { on: false } }
  }
}

/** A TON order for the club: the address, the amount and the comment to send it with. */
export async function startTonCheckout(email: string, route: string, lang: string): Promise<{ ok: boolean; order?: string; ton?: TonTransfer; reason?: string }> {
  try {
    const r = await fetch(`${LADDER.renderBase}/api/course/checkout`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, route, lang, from: readPromo(), source: readSource(), pay: 'ton' }),
    })
    const body = await r.json()
    const ton = readTonTransfer(body?.ton)
    return body && body.ok === true && typeof body.order === 'string' && ton ? { ok: true, order: body.order, ton } : { ok: false, reason: body?.reason ?? `http_${r.status}` }
  } catch {
    return { ok: false, reason: 'unreachable' }
  }
}

/** An order for the club, and the Robokassa page to pay it on. */
export async function startCheckout(email: string, route: string, lang: string): Promise<{ ok: boolean; order?: string; url?: string; reason?: string }> {
  try {
    const r = await fetch(`${LADDER.renderBase}/api/course/checkout`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      // The shelf that sold it and the channel the reader came from: the owner's notice names both.
      body: JSON.stringify({ email, route, lang, from: readPromo(), source: readSource() }),
    })
    const body = await r.json()
    return body && body.ok === true && typeof body.url === 'string' && body.url.startsWith('https://') ? body : { ok: false, reason: body?.reason ?? `http_${r.status}` }
  } catch {
    return { ok: false, reason: 'unreachable' }
  }
}

export async function readOrder(id: string): Promise<Order> {
  try {
    const r = await fetch(`${LADDER.renderBase}/api/course/checkout/order?id=${encodeURIComponent(id)}`, { credentials: 'omit' })
    const body = (await r.json()) as Order
    return body && typeof body.ok === 'boolean' ? { ...body, ton: readTonTransfer(body.ton) } : { ok: false, reason: 'unreadable' }
  } catch {
    return { ok: false, reason: 'unreachable' }
  }
}

export const ORDER_PARAM = 'order'

/**
 * WHICH SHELF SOLD IT. An internal link to a course carries ?from=<placement> (footer,
 * blog:<slug>, course:<route>, catalog) inside the hash. Never utm_*: an internal utm tag
 * overwrites the channel the reader really came from. The first placement of this session is
 * kept (blog -> catalog -> course names the blog, not the catalog) and sent with an order, so a
 * payment names the shelf that sold it.
 */
export const PROMO_PARAM = 'from'
const PROMO_KEY = 'traffic:promo'

/** A course link from a shelf: /<route>?from=<placement>. Pure. */
export function promoTo(route: string, placement: string): string {
  return `/${route}?${PROMO_PARAM}=${encodeURIComponent(placement)}`
}

/** Keep the placement this address names, if any. Never throws. */
export function notePromo(search: string) {
  const from = new URLSearchParams(search).get(PROMO_PARAM)
  if (!from || !/^[a-z0-9:_-]{1,80}$/i.test(from)) return
  try {
    if (!window.sessionStorage.getItem(PROMO_KEY)) window.sessionStorage.setItem(PROMO_KEY, from)
  } catch {
    // no storage: the order goes without its shelf
  }
}

function readSession(key: string): string | undefined {
  try {
    return window.sessionStorage.getItem(key) ?? undefined
  } catch {
    return undefined
  }
}
export const readPromo = () => readSession(PROMO_KEY)
export const readSource = () => readSession(SOURCE_KEY)

/** The catalog's address in the bot: a club member signs in here with the key it hands back. */
export const SIGN_IN_ROUTE = 'courses'

/** A finished lesson, sent with the reader's key -- and never without one (may_report). */
export async function reportDone(key: string | undefined, course: string, lesson: string): Promise<void> {
  if (!mayReport(Boolean(key))) return
  try {
    await fetch(`${LADDER.renderBase}/api/course/progress`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, course, lesson }),
    })
  } catch {
    // The mark is kept in this browser; the author simply hears of it later, or not.
  }
}

export const KEY_PARAM = RULES.KEY_PARAM
export const STEP = { free: RULES.STEP_FREE, bot: RULES.STEP_BOT, paid: RULES.STEP_PAID } as const
