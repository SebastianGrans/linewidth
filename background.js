async function ensureContentScript(tabId) {
  try {
    await browser.tabs.sendMessage(tabId, { type: "ping" });
  } catch {
    await browser.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
    await browser.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  }
}

async function registerOrigin(originPattern) {
  const existing = await browser.scripting.getRegisteredContentScripts({ ids: [originPattern] });
  if (existing.length) return;

  await browser.scripting.registerContentScripts([
    {
      id: originPattern,
      matches: [originPattern],
      js: ["content.js"],
      css: ["content.css"],
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

browser.runtime.onMessage.addListener((message) => {
  if (message.type === "open-dashboard") browser.runtime.openOptionsPage();
});

browser.runtime.onInstalled.addListener(() => {
  // Create this once at install/update rather than on every background
  // script run, to avoid "duplicate id" errors on re-registration
  browser.contextMenus.create({
    id: "open-dashboard",
    title: "Open Dashboard",
    contexts: ["action"],
  });
});

browser.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "open-dashboard") browser.runtime.openOptionsPage();
});
