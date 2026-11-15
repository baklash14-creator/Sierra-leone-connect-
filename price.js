/* SL Connect - Price filter + price sorting + "with photos" filter for the Marketplace.
   Works on the phone only, no database changes. Load AFTER app.js (put it after invite.js). */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  if (!$("p-market") || !$("sort") || !$("list") || typeof renderMarket !== "function") return;

  /* "Le 6,000 per month" -> 6000   |   "Le 150/day" -> 150   |   no number -> null */
  function priceOf(p) {
    const m = String((p && p.price) || "").replace(/\s/g, "").match(/\d[\d,.]*/);
    if (!m) return null;
    const n = parseFloat(m[0].replace(/,/g, ""));
    return isFinite(n) ? n : null;
  }
  const num = el => { const d = String(el.value || "").replace(/\D/g, ""); return d === "" ? null : parseInt(d, 10); };
  const fmt = n => n.toLocaleString("en-US");

  /* ---------- controls ---------- */
  const sort = $("sort");
  [["pl", "Price: low to high"], ["ph", "Price: high to low"]].forEach(([v, t]) => {
    if (!sort.querySelector(`option[value="${v}"]`)) sort.insertAdjacentHTML("beforeend", `<option value="${v}">${t}</option>`);
  });

  const bar = document.querySelector("#p-market .bar");
  if (!$("pf") && bar) {
    bar.insertAdjacentHTML("afterend", `<div class="pf" id="pf">
      <span class="pf-t">💰 Price (Le)</span>
      <input class="pf-in" id="pfMin" inputmode="numeric" placeholder="Min" aria-label="Minimum price" autocomplete="off">
      <span class="pf-dash">to</span>
      <input class="pf-in" id="pfMax" inputmode="numeric" placeholder="Max" aria-label="Maximum price" autocomplete="off">
      <button type="button" class="pf-chip" id="pfPhoto" aria-pressed="false">📷 With photos</button>
      <button type="button" class="pf-clear" id="pfClear" hidden>✕ Clear</button>
    </div>`);
  }

  let photosOnly = false;

  /* ---------- apply filters + sorting to the cards already on screen ---------- */
  function apply() {
    const list = $("list"); if (!list) return;
    const cards = [...list.querySelectorAll(".card[data-id]")];
    const old = $("pfEmpty"); if (old) old.remove();
    if (!cards.length) return;

    const min = num($("pfMin")), max = num($("pfMax")), mode = $("sort").value;
    const byId = {}; (typeof posts !== "undefined" ? posts : []).forEach(p => byId[p.id] = p);
    const active = min !== null || max !== null || photosOnly;
    $("pfClear").hidden = !active;

    let shown = 0;
    cards.forEach(c => {
      const p = byId[c.dataset.id]; let ok = true;
      if (p) {
        const v = priceOf(p);
        if (min !== null && (v === null || v < min)) ok = false;
        if (max !== null && (v === null || v > max)) ok = false;
        if (photosOnly && !(p.images && p.images.length)) ok = false;
      }
      c.style.display = ok ? "" : "none";
      if (ok) shown++;
    });

    if (mode === "pl" || mode === "ph") {
      const val = c => { const p = byId[c.dataset.id], v = p ? priceOf(p) : null; return v === null ? (mode === "pl" ? Infinity : -Infinity) : v; };
      cards.slice().sort((a, b) => mode === "pl" ? val(a) - val(b) : val(b) - val(a)).forEach(c => list.appendChild(c));
    }

    const cnt = $("count");
    if (cnt) {
      let t = shown + " result" + (shown === 1 ? "" : "s");
      if (min !== null || max !== null) t += " · Le " + (min !== null ? fmt(min) : "0") + (max !== null ? " to " + fmt(max) : " and up");
      cnt.textContent = t;
    }
    if (!shown) list.insertAdjacentHTML("beforeend", '<div class="empty" id="pfEmpty">No listings in this price range. Try a wider range, or tap Clear.</div>');
  }

  /* run after every normal marketplace render */
  const _rm = renderMarket;
  renderMarket = function () { _rm.apply(this, arguments); apply(); };

  /* the built-in search / area / sort / available boxes render with the old function,
     so run our filter again right after them */
  ["q", "locF", "sort", "avail"].forEach(id => {
    const el = $(id); if (el) el.addEventListener(id === "q" ? "input" : "change", apply);
  });
  ["pfMin", "pfMax"].forEach(id => $(id).addEventListener("input", e => {
    const d = e.target.value.replace(/\D/g, "");
    e.target.value = d ? fmt(parseInt(d, 10)) : "";
    apply();
  }));
  $("pfPhoto").addEventListener("click", e => {
    photosOnly = !photosOnly;
    e.currentTarget.classList.toggle("on", photosOnly);
    e.currentTarget.setAttribute("aria-pressed", photosOnly);
    apply();
  });
  $("pfClear").addEventListener("click", () => {
    $("pfMin").value = ""; $("pfMax").value = ""; photosOnly = false;
    $("pfPhoto").classList.remove("on"); $("pfPhoto").setAttribute("aria-pressed", "false");
    apply();
  });
})();
