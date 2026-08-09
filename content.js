(() => {
  if (window.__linewidthInjected) return;
  window.__linewidthInjected = true;

  const DEFAULT_WIDTH_EM = 45;

  let active = false;
  let chain = [];
  let chainIndex = 0;
  let widthValue = null;
  let styledEl = null;

  const highlightBox = document.createElement("div");
  highlightBox.id = "linewidth-highlight";

  const panel = document.createElement("div");
  panel.id = "linewidth-panel";
  panel.innerHTML = `
    <div id="linewidth-row-hierarchy">
      <div id="linewidth-label"></div>
      <input id="linewidth-slider" type="range" min="0" max="0" value="0" step="1" title="Select ancestor" />
    </div>
    <div id="linewidth-row-width">
      <input id="linewidth-width-slider" type="range" min="20" max="100" value="${DEFAULT_WIDTH_EM}" step="1" title="Width (em)" />
      <input id="linewidth-width-input" type="text" value="${DEFAULT_WIDTH_EM}em" size="6" />
      <button id="linewidth-close" type="button" aria-label="Close">&times;</button>
    </div>
  `;

  function describe(el) {
    if (!el) return "";
    let s = el.tagName.toLowerCase();
    if (el.id) s += `#${el.id}`;
    if (typeof el.className === "string" && el.className.trim()) {
      s += "." + el.className.trim().split(/\s+/).join(".");
    }
    return s;
  }

  function updateHighlight(el) {
    if (!el) {
      highlightBox.style.display = "none";
      return;
    }
    const rect = el.getBoundingClientRect();
    highlightBox.style.display = "block";
    highlightBox.style.left = `${rect.left}px`;
    highlightBox.style.top = `${rect.top}px`;
    highlightBox.style.width = `${rect.width}px`;
    highlightBox.style.height = `${rect.height}px`;
  }

  function buildChain(el) {
    const result = [];
    let node = el;
    while (node && node.nodeType === 1) {
      result.push(node);
      if (node === document.documentElement) break;
      node = node.parentElement;
    }
    return result;
  }

  function onMouseMove(e) {
    updateHighlight(e.target);
  }

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("click", onClick, true);

    chain = buildChain(e.target);
    chainIndex = 0;
    widthValue = null;
    styledEl = null;

    const slider = panel.querySelector("#linewidth-slider");
    slider.max = String(chain.length - 1);
    slider.value = "0";

    const widthSlider = panel.querySelector("#linewidth-width-slider");
    const widthInput = panel.querySelector("#linewidth-width-input");
    widthSlider.value = String(DEFAULT_WIDTH_EM);
    widthInput.value = `${DEFAULT_WIDTH_EM}em`;

    updateSelection();
    document.body.appendChild(panel);
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
  }

  function updateSelection() {
    const el = chain[chainIndex];
    updateHighlight(el);
    panel.querySelector("#linewidth-label").textContent = describe(el);
  }

  function onReposition() {
    updateHighlight(chain[chainIndex]);
  }

  function clearWidth(el) {
    if (el) el.style.removeProperty("width");
  }

  function applyWidthToCurrent() {
    const el = chain[chainIndex];
    if (!el) return;
    if (styledEl && styledEl !== el) clearWidth(styledEl);
    if (widthValue) {
      el.style.width = widthValue;
      styledEl = el;
    } else {
      styledEl = null;
    }
    updateHighlight(el);
  }

  function onSliderInput(e) {
    const oldEl = chain[chainIndex];
    chainIndex = Number(e.target.value);
    const newEl = chain[chainIndex];

    if (widthValue && styledEl === oldEl) {
      clearWidth(oldEl);
      newEl.style.width = widthValue;
      styledEl = newEl;
    }

    updateSelection();
  }

  function onWidthSliderInput(e) {
    widthValue = `${e.target.value}em`;
    panel.querySelector("#linewidth-width-input").value = widthValue;
    applyWidthToCurrent();
  }

  function onWidthInputChange(e) {
    const raw = e.target.value.trim();
    widthValue = raw || null;

    const match = raw.match(/^(\d+(?:\.\d+)?)em$/);
    if (match) {
      const widthSlider = panel.querySelector("#linewidth-width-slider");
      const clamped = Math.min(
        Number(widthSlider.max),
        Math.max(Number(widthSlider.min), Number(match[1]))
      );
      widthSlider.value = String(clamped);
    }

    applyWidthToCurrent();
  }

  function onKeyDown(e) {
    if (e.key === "Escape") deactivate();
  }

  function activate() {
    if (active) return;
    active = true;
    document.body.appendChild(highlightBox);
    document.addEventListener("mousemove", onMouseMove, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onKeyDown, true);
  }

  function deactivate() {
    active = false;
    document.removeEventListener("mousemove", onMouseMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("scroll", onReposition, true);
    window.removeEventListener("resize", onReposition);
    highlightBox.remove();
    panel.remove();
    chain = [];
    chainIndex = 0;
    widthValue = null;
    styledEl = null;
  }

  panel.querySelector("#linewidth-close").addEventListener("click", deactivate);
  panel.querySelector("#linewidth-slider").addEventListener("input", onSliderInput);
  panel.querySelector("#linewidth-width-slider").addEventListener("input", onWidthSliderInput);
  panel.querySelector("#linewidth-width-input").addEventListener("input", onWidthInputChange);

  browser.runtime.onMessage.addListener((message) => {
    if (message.type === "ping") return Promise.resolve(true);
    if (message.type === "toggle-picker") {
      if (active) deactivate();
      else activate();
    }
  });
})();
