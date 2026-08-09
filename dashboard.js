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

function describeSettings(settings) {
  // Build a short human-readable summary of a saved page's settings

  const parts = [settings.width || "default width"];
  if (settings.centered) parts.push("centered");
  if (settings.justified) parts.push("justified");
  return parts.join(", ");
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
    const card = document.createElement("section");
    card.className = "site-card";

    const heading = document.createElement("h2");
    heading.textContent = origin;
    card.appendChild(heading);

    const status = document.createElement("p");
    status.className = "status";
    status.textContent =
      site.granted && site.registered ? "Auto-applies on load" : "Click-to-restore only";
    card.appendChild(status);

    if (site.granted || site.registered) {
      const revokeButton = document.createElement("button");
      revokeButton.textContent = "Revoke site access";
      revokeButton.addEventListener("click", async () => {
        const pattern = `${origin}/*`;
        await browser.permissions.remove({ origins: [pattern] });
        await browser.scripting.unregisterContentScripts({ ids: [pattern] });
        render();
      });
      card.appendChild(revokeButton);
    }

    const list = document.createElement("ul");
    for (const page of site.pages) {
      const item = document.createElement("li");

      const label = document.createElement("span");
      label.textContent = `${page.pathname} — ${describeSettings(page.settings)}`;
      item.appendChild(label);

      const deleteButton = document.createElement("button");
      deleteButton.textContent = "Delete";
      deleteButton.addEventListener("click", async () => {
        await browser.storage.local.remove(page.key);
        render();
      });
      item.appendChild(deleteButton);

      list.appendChild(item);
    }
    card.appendChild(list);

    container.appendChild(card);
  }
}

render();
