/**
 * F002 (research R2): a share opens the installed app at /share-target?title&text&url. Before the
 * hash router starts, that entry URL is replaced by the in-app route #/shared?…, so it is read once:
 * Back does not lead to it and a reload stays on the in-app route.
 */
export function takeShare(location: Location = window.location, history: History = window.history) {
  if (location.pathname !== '/share-target') return
  const incoming = new URLSearchParams(location.search)
  const params = new URLSearchParams()
  for (const key of ['title', 'text', 'url']) {
    const value = incoming.get(key)
    if (value) params.set(key, value)
  }
  history.replaceState(null, '', `/#/shared?${params}`)
}
