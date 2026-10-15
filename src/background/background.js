async function ensureContentScript(tabId) {
  try {
    await browser.tabs.sendMessage(tabId, { type: "ping" });
  } catch {
    await browser.scripting.insertCSS({ target: { tabId }, files: ["src/content/content.css"] });
    await browser.scripting.executeScript({ target: { tabId }, files: ["src/content/content.js"] });
  }
}

async function registerOrigin(originPattern) {
  const existing = await browser.scripting.getRegisteredContentScripts({ ids: [originPattern] });
  if (existing.length) return;

  await browser.scripting.registerContentScripts([
    {
      id: originPattern,
      matches: [originPattern],
      js: ["src/content/content.js"],
      css: ["src/content/content.css"],
      runAt: "document_idle",
    },
  ]);
}

function requestOriginPermission(tab) {
  // Ask for persistent access to this tab's site so saved settings can
  // auto-apply on future visits, without a click.
  //
  // Content scripts cannot request host permissions in Firefox at all -
  // this has to happen here, in a real click-event listener. It must also
  // be the very first thing this listener does: once a user-input handler
  // awaits anything, it loses its "triggered by a user gesture" status,
  // and permissions.request() silently refuses to prompt after that. It's
  // safe to call unconditionally on every click: for an origin that's
  // already granted, it resolves immediately with no prompt shown.

  if (!tab.url || !tab.url.startsWith("http")) return;

  let originPattern;
  try {
    originPattern = `${new URL(tab.url).origin}/*`;
  } catch {
    return;
  }

  browser.permissions.request({ origins: [originPattern] }).then((granted) => {
    if (granted) registerOrigin(originPattern);
  });
}

browser.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  requestOriginPermission(tab);

  await ensureContentScript(tab.id);
  await browser.tabs.sendMessage(tab.id, { type: "toggle-picker" });
});

browser.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "open-dashboard") browser.runtime.openOptionsPage();

  if (message.type === "set-badge" && sender.tab) {
    // Tab-specific badges are cleared by the browser whenever the tab
    // navigates to a new page, so the next page starts without one
    const tabId = sender.tab.id;
    browser.action.setBadgeText({ tabId, text: message.applied ? "✓" : "" });
    browser.action.setBadgeBackgroundColor({ tabId, color: "#34c643" });
  }
});

async function seedDevSettings() {
  // Start a temporary install, e.g. `npx web-ext run` with its fresh
  // profile, with the sample settings in dev/seed.json rather than an empty
  // dashboard. Existing settings are never touched, and built packages
  // leave out the dev folder entirely

  const existing = await browser.storage.local.get(null);
  if (Object.keys(existing).length) return;

  try {
    const response = await fetch(browser.runtime.getURL("dev/seed.json"));
    await browser.storage.local.set(await response.json());
  } catch {
    // No seed file to load
  }
}

browser.runtime.onInstalled.addListener(({ reason, temporary }) => {
  // Create this once at install/update rather than on every background
  // script run, to avoid "duplicate id" errors on re-registration
  browser.contextMenus.create({
    id: "open-dashboard",
    title: "Open Dashboard",
    contexts: ["action"],
  });

  if (reason === "install" && temporary) seedDevSettings();
});

browser.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "open-dashboard") browser.runtime.openOptionsPage();
});
