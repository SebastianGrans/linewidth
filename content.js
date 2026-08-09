(() => {
  // Guard against the content script being injected more than once
  if (window.__linewidthInjected) return;
  window.__linewidthInjected = true;

  const DEFAULT_WIDTH_EM = 45;
  const PICKER_ICON_URL = browser.runtime.getURL("picker.svg");

  let active = false;
  let chain = [];
  let chainIndex = 0;
  let widthValue = null;
  let styledElement = null;
  let centered = false;
  let centeredElement = null;

  const highlightBox = document.createElement("div");
  highlightBox.id = "linewidth-highlight";

  const panel = document.createElement("div");
  panel.id = "linewidth-panel";
  panel.innerHTML = `
    <div id="linewidth-hint">Click on an element</div>
    <div id="linewidth-row-hierarchy">
    <input id="linewidth-slider" type="range" min="0" max="0" value="0" step="1" title="Select ancestor" />
    <div id="linewidth-label"></div>
      <button id="linewidth-repick" type="button" title="Re-select element" aria-label="Re-select element"></button>
    </div>
    <div id="linewidth-row-width">
      <input id="linewidth-width-slider" type="range" min="20" max="100" value="${DEFAULT_WIDTH_EM}" step="1" title="Width (em)" />
      <input id="linewidth-width-input" type="text" value="${DEFAULT_WIDTH_EM}em" size="6" />
      <label id="linewidth-center-label">
        <input id="linewidth-center-toggle" type="checkbox" /> Center
      </label>
      <button id="linewidth-close" type="button" aria-label="Close">&times;</button>
    </div>
  `;

  const hint = panel.querySelector("#linewidth-hint");
  const slider = panel.querySelector("#linewidth-slider");
  const label = panel.querySelector("#linewidth-label");
  const widthSlider = panel.querySelector("#linewidth-width-slider");
  const widthInput = panel.querySelector("#linewidth-width-input");
  const centerToggle = panel.querySelector("#linewidth-center-toggle");
  const closeButton = panel.querySelector("#linewidth-close");
  const repickButton = panel.querySelector("#linewidth-repick");
  repickButton.style.backgroundImage = `url("${PICKER_ICON_URL}")`;

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
    repickButton.disabled = disabled;
  }

  function selectElement(element) {
    // Select a new element: build its ancestor chain, reset the panel to
    // its defaults, and apply the default width/centering to it

    clearWidth(styledElement);
    clearCenter(centeredElement);

    chain = buildChain(element);
    chainIndex = 0;
    widthValue = null;
    styledElement = null;
    centered = false;
    centeredElement = null;

    slider.max = String(chain.length - 1);
    slider.value = "0";

    widthSlider.value = String(DEFAULT_WIDTH_EM);
    widthInput.value = `${DEFAULT_WIDTH_EM}em`;
    centerToggle.checked = true;
    setControlsDisabled(false);

    widthValue = `${DEFAULT_WIDTH_EM}em`;
    applyWidthToCurrent();

    centered = true;
    applyCenter(chain[chainIndex]);
    centeredElement = chain[chainIndex];

    updateSelection();
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
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

  function activate() {
    // Show the panel, resuming a remembered selection if it's still on the
    // page, otherwise entering picking mode

    if (active) return;

    active = true;
    document.body.appendChild(highlightBox);
    document.body.appendChild(panel);
    document.addEventListener("keydown", onKeyDown, true);

    const remembered = chain[chainIndex];
    if (remembered && remembered.isConnected) {
      setControlsDisabled(false);
      updateSelection();
      window.addEventListener("scroll", onReposition, true);
      window.addEventListener("resize", onReposition);
    } else {
      startPicking();
    }
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
  repickButton.addEventListener("click", onRepickClick);
  slider.addEventListener("input", onSliderInput);
  widthSlider.addEventListener("input", onWidthSliderInput);
  widthInput.addEventListener("input", onWidthInputChange);
  centerToggle.addEventListener("change", onCenterToggle);

  browser.runtime.onMessage.addListener((message) => {
    if (message.type === "ping") return Promise.resolve(true);
    if (message.type === "toggle-picker") {
      if (active) deactivate();
      else activate();
    }
  });
})();
