async function loadSites() {
  // Combine saved pages, granted permissions, and registered auto-run
  // scripts into one map keyed by origin

  const stored = await browser.storage.local.get(null);
  const { origins: grantedOrigins } = await browser.permissions.getAll();
  const registeredScripts = await browser.scripting.getRegisteredContentScripts();

  const sites = new Map();

  function ensureSite(origin) {
    if (!sites.has(origin)) sites.set(origin, { pages: [], granted: false, registered: false });
    return sites.get(origin);
  }

  for (const [key, settings] of Object.entries(stored)) {
    let url;
    try {
      url = new URL(key);
    } catch {
      continue;
    }
    ensureSite(url.origin).pages.push({ key, pathname: url.pathname || "/", settings });
  }

  for (const pattern of grantedOrigins) {
    ensureSite(pattern.replace(/\/\*$/, "")).granted = true;
  }

  for (const script of registeredScripts) {
    ensureSite(script.id.replace(/\/\*$/, "")).registered = true;
  }

  return sites;
}

function openAndActivate(url) {
  // Open the page in a new tab, then trigger the picker panel once it's
  // done loading. Only meant for sites whose content script auto-runs
  // (granted permission + registered) - the script has to already be
  // running on the page by the time the message is sent, and for those
  // sites the browser guarantees that once the page finishes loading.

  browser.tabs.create({ url, active: true }).then((tab) => {
    function onUpdated(tabId, changeInfo) {
      if (tabId !== tab.id || changeInfo.status !== "complete") return;

      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.tabs.sendMessage(tab.id, { type: "toggle-picker" }).catch(() => {});
    }

    browser.tabs.onUpdated.addListener(onUpdated);
  });
}

function describeSettings(settings) {
  // Build a short human-readable summary of a saved page's settings

  const parts = [settings.width || "default width"];
  if (settings.centered) parts.push("centered");
  if (settings.justified) parts.push("justified");
  return parts.join(", ");
}

function renderSiteCard(origin, site) {
  // Build one site card from the template, filled in with this site's data

  const card = document
    .getElementById("site-card-template")
    .content.cloneNode(true).firstElementChild;

  card.querySelector("h2").textContent = origin;
  card.querySelector(".status").textContent =
    site.granted && site.registered ? "Auto-applies on load" : "Click-to-restore only";

  const revokeButton = card.querySelector(".revoke");
  if (site.granted || site.registered) {
    revokeButton.hidden = false;
    revokeButton.addEventListener("click", async () => {
      const pattern = `${origin}/*`;
      await browser.permissions.remove({ origins: [pattern] });
      await browser.scripting.unregisterContentScripts({ ids: [pattern] });
      render();
    });
  }

  const list = card.querySelector("ul");
  for (const page of site.pages) {
    list.appendChild(renderPageRow(origin, site, page));
  }

  return card;
}

function renderPageRow(origin, site, page) {
  // Build one saved-page row from the template

  const row = document
    .getElementById("page-row-template")
    .content.cloneNode(true).firstElementChild;

  const url = `${origin}${page.pathname}`;
  const link = row.querySelector("a");
  link.href = url;
  link.textContent = page.pathname;

  if (site.granted && site.registered) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      openAndActivate(url);
    });
  } else {
    link.target = "_blank";
  }

  row.querySelector(".settings").textContent = describeSettings(page.settings);

  row.querySelector(".delete").addEventListener("click", async () => {
    await browser.storage.local.remove(page.key);
    render();
  });

  return row;
}

async function render() {
  // Rebuild the whole page from current storage/permissions/registrations

  const sites = await loadSites();
  const container = document.getElementById("sites");
  container.innerHTML = "";

  if (!sites.size) {
    container.textContent = "No pages configured yet.";
    return;
  }

  for (const [origin, site] of [...sites.entries()].sort()) {
    container.appendChild(renderSiteCard(origin, site));
  }
}

render();
