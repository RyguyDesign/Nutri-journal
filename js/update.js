// Keeps the installed app current. Android resumes an installed web app
// from memory instead of reloading it, so a new version would otherwise
// only arrive after the app is fully closed. On start and whenever the app
// comes back to the foreground, compare version.json with the version this
// page loaded; if it changed, reload (or ask, when a form is open).

let loaded = null;

async function fetchVersion() {
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()).version || null;
  } catch {
    return null; // offline: keep using this version
  }
}

/**
 * isBusy(): true while the person is typing in a form, so we don't reload
 * under them. onAvailable(): show a "new version" prompt instead.
 */
export async function watchForUpdates({ isBusy, onAvailable }) {
  loaded = await fetchVersion();
  const check = async () => {
    if (document.visibilityState !== 'visible') return;
    const latest = await fetchVersion();
    if (!latest || !loaded || latest === loaded) return;
    if (isBusy()) onAvailable();
    else location.reload();
  };
  document.addEventListener('visibilitychange', check);
  setInterval(check, 15 * 60 * 1000);
}
