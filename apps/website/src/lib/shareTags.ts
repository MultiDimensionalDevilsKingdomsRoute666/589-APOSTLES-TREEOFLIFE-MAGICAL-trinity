/**
 * A SHARED LINK SAYS WHERE IT WAS SHARED. Owner, 2026-10-13: utm tags everywhere, to see the
 * traffic. The share buttons are where our links leave for other sites, so that is where the
 * tags go: utm_source=<platform>, utm_medium=social, utm_campaign=<blog|course>,
 * utm_content=<slug>. The query sits before any '#', where trafficArrival.ts reads it on arrival.
 *
 * Internal links never carry utm_* (an internal tag overwrites the channel the reader came
 * from); they carry ?from=<placement> instead (courseLadder.ts promoTo).
 */
export function shareTagged(url: string, source: string, campaign: string, content: string): string {
  const hash = url.indexOf('#')
  const base = hash >= 0 ? url.slice(0, hash) : url
  const tail = hash >= 0 ? url.slice(hash) : ''
  const q = new URLSearchParams({ utm_source: source, utm_medium: 'social', utm_campaign: campaign, utm_content: content })
  return `${base}${base.includes('?') ? '&' : '?'}${q.toString()}${tail}`
}
