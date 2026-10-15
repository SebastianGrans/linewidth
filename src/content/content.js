(() => {
  // Guard against the content script being injected more than once
  if (window.__linewidthInjected) return;
  window.__linewidthInjected = true;

  const DEFAULT_WIDTH_EM = 45;
  const PICKER_ICON_URL = browser.runtime.getURL("src/icons/picker.svg");
  const DELETE_ICON_URL = browser.runtime.getURL("src/icons/delete.svg");
  const PAGE_URL = `${location.origin}${location.pathname}`;

  // The saved key settings are read from and saved to: either PAGE_URL
  // itself, or a pattern such as "https://example.com/docs/*"
  let activeKey = PAGE_URL;

  let active = false;
  let chain = [];
  let chainIndex = 0;
  let widthValue = null;
  let styledElement = null;
  let centered = false;
  let centeredElement = null;
  let justified = false;
  let justifiedElement = null;
  let enabled = true;

  const highlightBox = document.createElement("div");
  highlightBox.id = "linewidth-highlight";

  const panel = document.createElement("div");
  panel.id = "linewidth-panel";
  panel.innerHTML = `
    <div id="linewidth-hint">Click on an element</div>
    <div id="linewidth-row-scope">
      <label for="linewidth-scope">Apply to</label>
      <select id="linewidth-scope" title="Which pages these settings apply to"></select>
    </div>
    <div id="linewidth-row-hierarchy">
    <input id="linewidth-slider" type="range" min="0" max="0" value="0" step="1" title="Select ancestor" />
    <div id="linewidth-label"></div>
      <button id="linewidth-repick" type="button" title="Re-select element" aria-label="Re-select element"></button>
    </div>
    <div id="linewidth-row-width">
      <input id="linewidth-width-slider" type="range" min="20" max="100" value="${DEFAULT_WIDTH_EM}" step="1" title="Width (em)" />
      <input id="linewidth-width-input" type="text" value="${DEFAULT_WIDTH_EM}em" size="6" />
    </div>
    <div id="linewidth-row-toggles">
      <label id="linewidth-center-label">
        <input id="linewidth-center-toggle" type="checkbox" /> Center
      </label>
      <label id="linewidth-justify-label">
        <input id="linewidth-justify-toggle" type="checkbox" /> Justify
      </label>
      <button id="linewidth-delete" type="button" title="Delete saved settings" aria-label="Delete saved settings" style="display: none"></button>
      <button id="linewidth-manage" type="button" title="Manage saved pages" aria-label="Manage saved pages">&#9881;</button>
      <button id="linewidth-close" type="button" aria-label="Close">&times;</button>
    </div>
  `;

  const hint = panel.querySelector("#linewidth-hint");
  const scopeSelect = panel.querySelector("#linewidth-scope");
  const slider = panel.querySelector("#linewidth-slider");
  const label = panel.querySelector("#linewidth-label");
  const widthSlider = panel.querySelector("#linewidth-width-slider");
  const widthInput = panel.querySelector("#linewidth-width-input");
  const centerToggle = panel.querySelector("#linewidth-center-toggle");
  const justifyToggle = panel.querySelector("#linewidth-justify-toggle");
  const closeButton = panel.querySelector("#linewidth-close");
  const manageButton = panel.querySelector("#linewidth-manage");
  const repickButton = panel.querySelector("#linewidth-repick");
  const deleteButton = panel.querySelector("#linewidth-delete");
  repickButton.style.backgroundImage = `url("${PICKER_ICON_URL}")`;
  deleteButton.style.backgroundImage = `url("${DELETE_ICON_URL}")`;

  function describe(element) {
    // Generate a string composed of
    //  <element type>.<element class>
    // that is used as element label

    if (!element) return "";

    let string = element.tagName.toLowerCase();
    if (element.id) string += `#${element.id}`;
    if (typeof element.className === "string" && element.className.trim()) {
      string += "." + element.className.trim().split(/\s+/).join(".");
    }
    return string;
  }

  function updateHighlight(element) {
    // Position the highlight box over the given element, or hide it if none is given

    if (!element) {
      highlightBox.style.display = "none";
      return;
    }

    const rect = element.getBoundingClientRect();
    highlightBox.style.display = "block";
    highlightBox.style.left = `${rect.left}px`;
    highlightBox.style.top = `${rect.top}px`;
    highlightBox.style.width = `${rect.width}px`;
    highlightBox.style.height = `${rect.height}px`;
  }

  function buildChain(element) {
    // Build the list of ancestors for the given element, from itself up to <html>

    const result = [];
    let node = element;
    while (node && node.nodeType === 1) {
      result.push(node);
      if (node === document.documentElement) break;
      node = node.parentElement;
    }
    return result;
  }

  function buildSelector(element) {
    // Build a CSS selector that can re-find this element after a reload,
    // stopping early at the nearest ancestor with an id

    const parts = [];
    let node = element;

    while (node && node !== document.documentElement) {
      if (node.id) {
        parts.unshift(`#${CSS.escape(node.id)}`);
        return parts.join(" > ");
      }

      const parent = node.parentElement;
      if (!parent) break;

      const siblingsOfSameTag = Array.from(parent.children).filter(
        (child) => child.tagName === node.tagName
      );
      const position = siblingsOfSameTag.indexOf(node) + 1;
      parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${position})`);
      node = parent;
    }

    return parts.join(" > ");
  }

  function patternToRegex(pattern) {
    // Turn a saved key into a regex where "*" matches anything, and a
    // trailing "/*" also matches the bare directory ("/docs/*" matches "/docs")

    const source = pattern
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\/\.\*$/, "(?:/.*)?");
    return new RegExp(`^${source}$`);
  }

  async function findRule() {
    // Find the saved settings that apply to this page: an exact match if
    // there is one, otherwise the longest (most specific) matching pattern

    const stored = await browser.storage.local.get(null);
    const keys = Object.keys(stored).filter((key) => patternToRegex(key).test(PAGE_URL));
    if (!keys.length) return null;

    const key = keys.includes(PAGE_URL)
      ? PAGE_URL
      : keys.sort((a, b) => b.length - a.length)[0];
    return { key, settings: stored[key] };
  }

  function scopeKeys() {
    // List the keys this page's settings can be saved under, from this page
    // alone up to the whole site. A path not ending in "/" names a page
    // rather than a directory, so it gets no wildcard of its own

    const segments = location.pathname.split("/").filter(Boolean);
    const depth = location.pathname.endsWith("/") ? segments.length : segments.length - 1;

    const keys = [PAGE_URL];
    for (let i = depth; i >= 0; i--) {
      const directory = segments.slice(0, i).map((segment) => `/${segment}`).join("");
      keys.push(`${location.origin}${directory}/*`);
    }
    return keys;
  }

  function renderScopeOptions() {
    // Fill the scope dropdown, including the active key in case it's a
    // custom pattern (e.g. one edited in the dashboard)

    const keys = scopeKeys();
    if (!keys.includes(activeKey)) keys.push(activeKey);

    scopeSelect.replaceChildren(
      ...keys.map((key) =>
        new Option(key === PAGE_URL ? "This page only" : key.slice(location.origin.length), key)
      )
    );
    scopeSelect.value = activeKey;
  }

  function onScopeChange() {
    // Save the current settings under the newly chosen key. The old rule is
    // only removed if the new one covers every page it did: narrowing the
    // scope leaves the broader rule alone and adds an override on top

    const previousKey = activeKey;
    activeKey = scopeSelect.value;

    if (chain.length) {
      if (patternToRegex(activeKey).test(previousKey)) browser.storage.local.remove(previousKey);
      saveSettings();
    }

    renderScopeOptions();
    refreshDeleteButtonVisibility();
  }

  function saveSettings() {
    // Persist the current selection and settings under the active key

    const element = chain[chainIndex];
    if (!element) return;

    browser.storage.local.set({
      [activeKey]: {
        selector: buildSelector(element),
        width: widthValue,
        centered,
        justified,
        enabled,
      },
    });

    deleteButton.style.display = "";
  }

  async function refreshDeleteButtonVisibility() {
    // Show the delete button only if the active key currently has saved settings

    const stored = await browser.storage.local.get(activeKey);
    deleteButton.style.display = stored[activeKey] ? "" : "none";
  }

  function onDeleteClick() {
    // Remove the active key's saved settings and clear the currently applied styling

    browser.storage.local.remove(activeKey);
    deleteButton.style.display = "none";

    clearWidth(styledElement);
    clearCenter(centeredElement);
    clearJustify(justifiedElement);

    chain = [];
    chainIndex = 0;
    widthValue = null;
    styledElement = null;
    centered = false;
    centeredElement = null;
    justified = false;
    justifiedElement = null;

    updateHighlight(null);
    label.textContent = "";
    startPicking();
  }

  async function restoreSettings() {
    // Look up saved settings for this page and re-apply them if the
    // saved element can still be found

    if (chain.length) return true;

    const rule = await findRule();
    const settings = rule?.settings;
    if (!settings) return false;

    let element = null;
    try {
      element = document.querySelector(settings.selector);
    } catch {
      element = null;
    }
    if (!element || chain.length) return false;

    activeKey = rule.key;
    selectElement(element, settings);
    return true;
  }

  async function silentlyRestoreOnLoad() {
    // Reapply saved styling immediately on script load, without opening the panel

    if (chain.length) return;

    const rule = await findRule();
    const settings = rule?.settings;
    if (!settings || settings.enabled === false) return;

    let element = null;
    try {
      element = document.querySelector(settings.selector);
    } catch {
      element = null;
    }
    if (!element || chain.length) return;

    activeKey = rule.key;
    applyStateToElement(element, settings);
  }

  function onMouseMove(event) {
    // Follow the cursor with the highlight box while picking

    updateHighlight(event.target);
  }

  function setControlsDisabled(disabled) {
    // Enable or disable all interactive controls in the panel

    hint.style.display = disabled ? "block" : "none";
    slider.disabled = disabled;
    widthSlider.disabled = disabled;
    widthInput.disabled = disabled;
    centerToggle.disabled = disabled;
    justifyToggle.disabled = disabled;
    repickButton.disabled = disabled;
  }

  function applyStateToElement(element, settings) {
    // Set selection state and apply width/centering/justification to the
    // given element — no panel/UI changes

    chain = buildChain(element);
    chainIndex = 0;

    widthValue = settings.width ?? `${DEFAULT_WIDTH_EM}em`;
    styledElement = null;
    applyWidthToCurrent();

    centered = settings.centered ?? true;
    centeredElement = null;
    if (centered) {
      applyCenter(chain[chainIndex]);
      centeredElement = chain[chainIndex];
    }

    justified = settings.justified ?? false;
    justifiedElement = null;
    if (justified) {
      applyJustify(chain[chainIndex]);
      justifiedElement = chain[chainIndex];
    }

    enabled = settings.enabled ?? true;
  }

  function selectElement(element, options = {}) {
    // Select a new element: build its ancestor chain, reset the panel, and
    // apply the given (or default) width/centering/justification to it

    clearWidth(styledElement);
    clearCenter(centeredElement);
    clearJustify(justifiedElement);

    applyStateToElement(element, options);

    slider.max = String(chain.length - 1);
    slider.value = "0";
    setControlsDisabled(false);

    const emMatch = widthValue && widthValue.match(/^(\d+(?:\.\d+)?)em$/);
    widthSlider.value = emMatch ? emMatch[1] : String(DEFAULT_WIDTH_EM);
    widthInput.value = widthValue || "";
    centerToggle.checked = centered;
    justifyToggle.checked = justified;

    updateSelection();
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    saveSettings();
  }

  function startPicking() {
    // Enter picking mode: disable the panel and listen for hover/click on the page

    setControlsDisabled(true);
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("click", onClick, true);
  }

  function stopPicking() {
    // Stop listening for hover/click on the page

    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("click", onClick, true);
  }

  function onClick(event) {
    // Ignore clicks on our own panel, otherwise select the clicked element

    if (panel.contains(event.target)) return;

    event.preventDefault();
    event.stopPropagation();
    stopPicking();
    selectElement(event.target);
  }

  function onRepickClick() {
    // Let the user pick a different element while keeping the panel open

    startPicking();
  }

  function updateSelection() {
    // Refresh the highlight box and label for the current chain element

    const element = chain[chainIndex];
    updateHighlight(element);
    label.textContent = describe(element);
  }

  function onReposition() {
    // Keep the highlight box aligned after scroll/resize

    updateHighlight(chain[chainIndex]);
  }

  function clearWidth(element) {
    // Remove any forced width from the given element

    if (element) element.style.removeProperty("width");
  }

  function applyWidthToCurrent() {
    // Apply the current width value to the current chain element, clearing
    // it from whichever element had it before

    const element = chain[chainIndex];
    if (!element) return;

    if (styledElement && styledElement !== element) clearWidth(styledElement);
    if (widthValue) {
      element.style.width = widthValue;
      styledElement = element;
    } else {
      styledElement = null;
    }
    updateHighlight(element);
  }

  function applyCenter(element) {
    // Center the element horizontally via auto margins

    element.style.marginLeft = "auto";
    element.style.marginRight = "auto";
  }

  function clearCenter(element) {
    // Remove centering from the given element

    if (!element) return;

    element.style.removeProperty("margin-left");
    element.style.removeProperty("margin-right");
  }

  function applyJustify(element) {
    // Justify the element's text

    element.style.textAlign = "justify";
  }

  function clearJustify(element) {
    // Remove text justification from the given element

    if (!element) return;

    element.style.removeProperty("text-align");
  }

  function onSliderInput(event) {
    // Move to a different ancestor, carrying the forced width/centering
    // over from the previously selected element

    const previousElement = chain[chainIndex];
    chainIndex = Number(event.target.value);
    const newElement = chain[chainIndex];

    if (widthValue && styledElement === previousElement) {
      clearWidth(previousElement);
      newElement.style.width = widthValue;
      styledElement = newElement;
    }

    if (centered && centeredElement === previousElement) {
      clearCenter(previousElement);
      applyCenter(newElement);
      centeredElement = newElement;
    }

    if (justified && justifiedElement === previousElement) {
      clearJustify(previousElement);
      applyJustify(newElement);
      justifiedElement = newElement;
    }

    updateSelection();
  }

  function onCenterToggle(event) {
    // Toggle centering on/off for the current chain element

    centered = event.target.checked;
    const element = chain[chainIndex];
    if (!element) return;

    if (centered) {
      applyCenter(element);
      centeredElement = element;
    } else {
      clearCenter(element);
      centeredElement = null;
    }

    updateHighlight(element);
    saveSettings();
  }

  function onJustifyToggle(event) {
    // Toggle text justification on/off for the current chain element

    justified = event.target.checked;
    const element = chain[chainIndex];
    if (!element) return;

    if (justified) {
      applyJustify(element);
      justifiedElement = element;
    } else {
      clearJustify(element);
      justifiedElement = null;
    }

    updateHighlight(element);
    saveSettings();
  }

  function onWidthSliderInput(event) {
    // Apply the width chosen on the slider, in em

    widthValue = `${event.target.value}em`;
    widthInput.value = widthValue;
    applyWidthToCurrent();
  }

  function onWidthInputChange(event) {
    // Apply a manually typed width, syncing the slider back if it's a
    // plain em value within its range

    const raw = event.target.value.trim();
    widthValue = raw || null;

    const match = raw.match(/^(\d+(?:\.\d+)?)em$/);
    if (match) {
      const clamped = Math.min(
        Number(widthSlider.max),
        Math.max(Number(widthSlider.min), Number(match[1]))
      );
      widthSlider.value = String(clamped);
    }

    applyWidthToCurrent();
  }

  function onKeyDown(event) {
    // Close the picker on Escape

    if (event.key === "Escape") deactivate();
  }

  async function activate() {
    // Show the panel: resume an in-memory selection if it's still on the
    // page, else try a saved one for this page, else enter picking mode

    if (active) return;

    active = true;
    document.body.appendChild(highlightBox);
    document.body.appendChild(panel);
    document.addEventListener("keydown", onKeyDown, true);

    // Wait for the page-load silent restore to settle first, so it can't
    // race with the restoreSettings() call below over the same chain state
    await initialRestorePromise;

    const remembered = chain[chainIndex];
    if (remembered && remembered.isConnected) {
      setControlsDisabled(false);
      updateSelection();
      window.addEventListener("scroll", onReposition, true);
      window.addEventListener("resize", onReposition);
    } else {
      const restored = await restoreSettings();
      if (!restored) startPicking();
    }

    // Only now is the active key settled, as restoring may have changed it
    renderScopeOptions();
    refreshDeleteButtonVisibility();
  }

  function deactivate() {
    // Hide the panel and stop all picker listeners, keeping whatever
    // width/centering was already applied to the page

    active = false;
    stopPicking();
    document.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("scroll", onReposition, true);
    window.removeEventListener("resize", onReposition);
    highlightBox.remove();
    panel.remove();
  }

  closeButton.addEventListener("click", deactivate);
  manageButton.addEventListener("click", () => {
    browser.runtime.sendMessage({ type: "open-dashboard" });
  });
  repickButton.addEventListener("click", onRepickClick);
  deleteButton.addEventListener("click", onDeleteClick);
  scopeSelect.addEventListener("change", onScopeChange);
  slider.addEventListener("input", onSliderInput);
  slider.addEventListener("change", saveSettings);
  widthSlider.addEventListener("input", onWidthSliderInput);
  widthSlider.addEventListener("change", saveSettings);
  widthInput.addEventListener("input", onWidthInputChange);
  widthInput.addEventListener("change", saveSettings);
  centerToggle.addEventListener("change", onCenterToggle);
  justifyToggle.addEventListener("change", onJustifyToggle);

  browser.runtime.onMessage.addListener((message) => {
    if (message.type === "ping") return Promise.resolve(true);
    if (message.type === "toggle-picker") {
      if (active) deactivate();
      else activate();
    }
  });

  const initialRestorePromise = silentlyRestoreOnLoad();
})();
