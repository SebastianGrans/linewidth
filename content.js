(() => {
  if (window.__linewidthInjected) return;
  window.__linewidthInjected = true;

  let active = false;
  let chain = [];
  let chainIndex = 0;

  const highlightBox = document.createElement("div");
  highlightBox.id = "linewidth-highlight";

  const panel = document.createElement("div");
  panel.id = "linewidth-panel";
  panel.innerHTML = `
    <div id="linewidth-label"></div>
    <input id="linewidth-slider" type="range" min="0" max="0" value="0" step="1" />
    <button id="linewidth-close" type="button" aria-label="Close">&times;</button>
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

    const slider = panel.querySelector("#linewidth-slider");
    slider.max = String(chain.length - 1);
    slider.value = "0";

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

  function onSliderInput(e) {
    chainIndex = Number(e.target.value);
    updateSelection();
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
  }

  panel.querySelector("#linewidth-close").addEventListener("click", deactivate);
  panel.querySelector("#linewidth-slider").addEventListener("input", onSliderInput);

  browser.runtime.onMessage.addListener((message) => {
    if (message.type === "ping") return Promise.resolve(true);
    if (message.type === "toggle-picker") {
      if (active) deactivate();
      else activate();
    }
  });
})();
