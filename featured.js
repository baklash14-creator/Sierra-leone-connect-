/* SL Connect - Featured posts (gold star, pinned to the top) + views counter.
   Needs featured.sql run once in Supabase. Load AFTER app.js and admin.js (put it after price.js).
   - Admins feature / un-feature a listing from Admin > Listings.
   - Owners (and admins) see how many different people viewed each post. */
(function () {
  "use strict";
  if (typeof CLOUD === "undefined" || !CLOUD || typeof renderMarket !== "function") return;
  const $ = id => document.getElementById(id);
  const META = {};          // id -> { featured, views }
  let loadedAt = 0, loading = null;

  async function loadMeta(force) {
    if (loading) return loading;
    if (!force && Date.now() - loadedAt < 20000) return;
    loading = (async () => {
      try {
        const { data, error } = await sb.from("posts").select("id,featured,views").limit(1000);
        if (error) throw error;
        Object.keys(META).forEach(k => delete META[k]);
        (data || []).forEach(r => META[r.id] = { featured: !!r.featured, views: +r.views || 0 });
        loadedAt = Date.now();
      } catch (e) { loadedAt = Date.now(); /* columns missing: SQL not run yet, stay silent */ }
      loading = null;
      decorate();
    })();
    return loading;
  }

  const mine = id => { const p = posts.find(x => x.id === id); return !!(user && p && (p.owner === user.id || user.admin)); };

  /* ---------- paint badges, views and move featured cards to the top ---------- */
  function decorate() {
    if (!user) return;
    ["list", "myList"].forEach(boxId => {
      const box = $(boxId); if (!box) return;
      const cards = [...box.querySelectorAll(".card[data-id]")];
      const top = [];
      cards.forEach(c => {
        const m = META[c.dataset.id] || {};
        c.classList.toggle("feat", !!m.featured);
        const ph = c.querySelector(".ph");
        const has = c.querySelector(".feat-badge");
        if (m.featured && ph && !has) ph.insertAdjacentHTML("beforeend", '<span class="feat-badge">⭐ Featured</span>');
        if (!m.featured && has) has.remove();
        if (m.featured) top.push(c);

        const by = c.querySelector(".by");
        const old = c.querySelector(".views");
        if (by && mine(c.dataset.id) && m.views !== undefined) {
          const t = "👁 " + m.views + (m.views === 1 ? " view" : " views");
          if (old) old.textContent = t; else by.insertAdjacentHTML("beforeend", ` <span class="views">${t}</span>`);
        } else if (old) old.remove();
      });
      if (boxId === "list" && top.length) for (let i = top.length - 1; i >= 0; i--) box.prepend(top[i]);
    });
  }

  const _rm = renderMarket;
  renderMarket = function () { _rm.apply(this, arguments); decorate(); loadMeta(); };
  if (typeof renderAccount === "function") {
    const _ra = renderAccount;
    renderAccount = function () { _ra.apply(this, arguments); decorate(); loadMeta(); };
  }

  /* the built-in search / area / sort / available boxes re-draw the cards with the old function,
     so paint the badges again right after them (and after the price filter has run) */
  ["q", "locF", "sort", "avail"].forEach(id => {
    const el = $(id); if (el) el.addEventListener(id === "q" ? "input" : "change", decorate);
  });

  /* ---------- count a view when someone opens a post ---------- */
  const seen = new Set();
  const _detail = detail;
  detail = function (id) {
    _detail.apply(this, arguments);
    const p = posts.find(x => x.id === id); if (!p || !user) return;

    const m = META[id];
    if (mine(id) && m) {
      const by = document.querySelector("#ddBody .by");
      if (by && !document.querySelector("#ddBody .views-line"))
        by.insertAdjacentHTML("afterend", `<div class="views-line">👁 ${m.views} ${m.views === 1 ? "person has" : "people have"} viewed this post</div>`);
    }
    if (p.owner !== user.id && !seen.has(id)) {
      seen.add(id);
      sb.rpc("bump_view", { pid: String(id) }).then(r => { if (!r.error) loadMeta(true); }).catch(() => { });
    }
  };

  /* admin.js asks us to feature / un-feature */
  window.slFeat = {
    meta: META,
    async set(id, on) {
      const { error } = await sb.rpc("admin_set_featured", { pid: String(id), make: on });
      if (error) throw error;
      (META[id] = META[id] || { views: 0 }).featured = on;
      decorate();
    }
  };
  loadMeta(true);
})();
