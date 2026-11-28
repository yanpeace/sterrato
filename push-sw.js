// Notifiche push di Sterrato: caricato dentro il service worker dell'app (workbox importScripts).
// Riceve i push dal server (push_server/) e li mostra anche con l'app chiusa o lo schermo spento.

const IS_IOS = /iP(hone|ad|od)|Macintosh/.test(self.navigator.userAgent || '')

/** C'è una finestra di Sterrato aperta e visibile? (chi ce l'ha davanti i vocali li sente già in diretta) */
async function appVisible() {
  try {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    return windows.some((w) => w.visibilityState === 'visible')
  } catch (_) { return false }
}

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (_) {
    data = { body: event.data ? event.data.text() : '' }
  }
  event.waitUntil((async () => {
    const live = data.kind === 'ptt' && (await appVisible())
    // vocale con l'app davanti agli occhi: niente notifica (Android/computer lo permettono)
    if (live && !IS_IOS) return
    const shown = self.registration.showNotification(data.title || 'Sterrato', {
      body: data.body || '',
      tag: data.tag || undefined,
      // aggiornamento di una notifica già mostrata (vocali in raffica): niente suono né vibrazione di nuovo
      renotify: !!data.tag && !data.quiet,
      silent: !!data.quiet || live,
      requireInteraction: !!data.urgent,
      vibrate: data.urgent ? [300, 120, 300, 120, 600] : [120, 60, 120],
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      data: { open: data.open || '' },
    })
    if (live) {
      // iPhone: ogni push DEVE mostrare una notifica (sennò Safari toglie l'iscrizione): la mostro e la tolgo subito
      await shown
      const list = await self.registration.getNotifications({ tag: data.tag || undefined })
      for (const n of list) n.close()
      return
    }
    const badge = self.navigator.setAppBadge ? self.navigator.setAppBadge().catch(() => {}) : null
    await Promise.all([shown, badge])
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const open = (event.notification.data && event.notification.data.open) || ''
  event.waitUntil((async () => {
    if (self.navigator.clearAppBadge) self.navigator.clearAppBadge().catch(() => {})
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const w of windows) {
      if ('focus' in w) {
        w.postMessage({ type: 'sterrato-open', open })
        return w.focus()
      }
    }
    const url = new URL(self.registration.scope)
    if (open) url.searchParams.set('open', open)
    return self.clients.openWindow(url.toString())
  })())
})
