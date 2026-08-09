async function ensureContentScript(tabId) {
  try {
    await browser.tabs.sendMessage(tabId, { type: "ping" });
  } catch {
    await browser.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
    await browser.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  }
}

browser.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  await ensureContentScript(tab.id);
  await browser.tabs.sendMessage(tab.id, { type: "toggle-picker" });
});
