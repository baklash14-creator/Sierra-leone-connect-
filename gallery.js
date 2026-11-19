/* SL Connect - Past-work gallery for workers + photos on reviews. Needs gallery.sql (already applied if you used Claude's Supabase link). Load AFTER brain.js. */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  if (!$("p-market") || typeof detail !== "function" || typeof sb === "undefined" || !sb) return;
  const E = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const T = m => { try { toast(m); } catch (e) { alert(m); } };
  const P = () => (typeof posts !== "undefined" ? posts : []);
  const me = () => (typeof user !== "undefined" && user ? user : null);
  const BUCKET = "post-images", MAX = 8;
  const safe = u => /^https:\/\//i.test(u || "") ? u : "";

  const css = document.createElement("style");
  css.textContent = `
  .gl-box{margin:12px 0}.gl-box h3{margin:0 0 8px}
  .gl-g{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
  .gl-g .gl-i{position:relative;aspect-ratio:1;border-radius:12px;overflow:hidden;background:var(--line)}
  .gl-g img{width:100%;height:100%;object-fit:cover;display:block;cursor:zoom-in}
  .gl-g button.x{position:absolute;top:4px;right:4px;width:26px;height:26px;border-radius:50%;border:0;background:#e0245e;color:#fff;font-size:16px;line-height:1;cursor:pointer}
  .gl-add{display:inline-block;margin-top:8px;border:1px dashed var(--line);border-radius:12px;padding:9px 14px;font-weight:700;cursor:pointer;font-size:.9rem}
  .gl-empty{color:var(--muted);font-size:.9rem}
  #glLb{border:0;padding:0;background:transparent;max-width:100vw;max-height:100vh}#glLb::backdrop{background:#000d}
  #glLb img{max-width:96vw;max-height:88vh;border-radius:12px;display:block;margin:auto}
  #glLb button{position:fixed;top:14px;right:14px;width:42px;height:42px;border-radius:50%;border:0;background:#fff;font-size:24px;cursor:pointer}
  .rv-ph{display:block;width:96px;height:72px;object-fit:cover;border-radius:10px;margin-top:6px;cursor:zoom-in}
  .rv-add{border:0;background:none;color:var(--green,#1eb53a);font-weight:700;cursor:pointer;padding:6px 0;font-size:.85rem}`;
  document.head.append(css);

  function shrink(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => { const im = new Image(); im.onload = () => { const s = Math.min(1, 900 / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); c.toBlob(b => b ? res(b) : rej(new Error("compress")), "image/jpeg", 0.78); }; im.onerror = rej; im.src = r.result; };
      r.onerror = rej; r.readAsDataURL(file);
    });
  }
  async function upload(file, tag) {
    const u = me(); const blob = await shrink(file);
    const path = `${u.id}/${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
    if (error) throw error;
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  /* ---------- past-work gallery ---------- */
  function drawGallery(box, p, list) {
    const own = me() && p.owner === me().id;
    box.innerHTML = `<h3>🛠 Past work</h3>` + (list.length ? `<div class="gl-g">${list.map((u, i) => `<div class="gl-i"><img src="${E(u)}" alt="Past work ${i + 1}" loading="lazy" data-gl="zoom" data-u="${E(u)}">${own ? `<button class="x" data-gl="rm" data-i="${i}" aria-label="Remove">×</button>` : ""}</div>`).join("")}</div>` : `<div class="gl-empty">${own ? "Show customers your best work. Add photos of finished jobs." : "No work photos yet."}</div>`)
      + (own && list.length < MAX ? `<label class="gl-add">📷 Add work photos (${list.length}/${MAX})<input type="file" accept="image/*" multiple hidden data-gl-in="${E(p.id)}"></label>` : "");
    box.dataset.list = JSON.stringify(list);
  }
  const _d = detail;
  detail = function (id) {
    const r = _d.apply(this, arguments);
    try {
      const p = P().find(x => x.id === id), db = document.querySelector("#ddBody .db"); if (!p || p.type !== "service" || !db || db.querySelector(".gl-box")) return r;
      const box = document.createElement("div"); box.className = "gl-box"; box.dataset.pid = id; box.innerHTML = '<h3>🛠 Past work</h3><div class="gl-empty">Loading…</div>';
      const anchor = db.querySelector(".bn-box") || db.querySelector(".acts"); if (anchor) anchor.parentNode.insertBefore(box, anchor); else db.appendChild(box);
      sb.from("posts").select("work_photos").eq("id", id).maybeSingle().then(x => {
        if (!box.isConnected) return;
        if (x.error) { box.remove(); return; }
        drawGallery(box, p, ((x.data && x.data.work_photos) || []).filter(safe));
      });
    } catch (e) { }
    return r;
  };
  async function savePhotos(box, p, list) { const { error } = await sb.from("posts").update({ work_photos: list }).eq("id", p.id); if (error) throw error; drawGallery(box, p, list); }

  /* ---------- lightbox ---------- */
  const lb = document.createElement("dialog"); lb.id = "glLb"; lb.innerHTML = '<button aria-label="Close" data-gl="close">×</button><img alt="">'; document.body.append(lb);

  /* ---------- review photos ---------- */
  async function decorateReviews() {
    const box = $("revBox"); if (!box || box.dataset.rvp === "busy") return;
    const revs = [...box.querySelectorAll(".rev")]; if (!revs.length || revs.every(r => r.dataset.rvp)) return;
    box.dataset.rvp = "busy";
    try {
      const pid = (typeof cur !== "undefined" ? cur : null); if (!pid) return;
      const { data, error } = await sb.from("reviews").select("id,reviewer,photo_url").eq("post_id", pid).order("created_at", { ascending: false }).limit(50);
      if (error || !data) return;
      const u = me();
      revs.forEach((el, i) => {
        el.dataset.rvp = "1"; const row = data[i]; if (!row) return;
        const url = safe(row.photo_url);
        if (url) el.insertAdjacentHTML("beforeend", `<img class="rv-ph" src="${E(url)}" alt="Review photo" loading="lazy" data-gl="zoom" data-u="${E(url)}">`);
        if (u && row.reviewer === u.id) el.insertAdjacentHTML("beforeend", `<label class="rv-add">📷 ${url ? "Change" : "Add"} photo<input type="file" accept="image/*" hidden data-gl-rv="${E(row.id)}"></label>`);
      });
    } finally { box.dataset.rvp = ""; }
  }
  new MutationObserver(() => { clearTimeout(decorateReviews._t); decorateReviews._t = setTimeout(decorateReviews, 120); }).observe($("ddBody") || document.body, { childList: true, subtree: true });

  /* ---------- events ---------- */
  document.addEventListener("click", async ev => {
    const el = ev.target.closest("[data-gl]"); if (!el) return;
    const a = el.dataset.gl;
    if (a === "zoom") { ev.preventDefault(); ev.stopPropagation(); lb.querySelector("img").src = el.dataset.u; if (!lb.open) lb.showModal(); }
    else if (a === "close") lb.close();
    else if (a === "rm") {
      ev.preventDefault(); ev.stopPropagation();
      const box = el.closest(".gl-box"), p = P().find(x => x.id === box.dataset.pid); if (!p || !confirm("Remove this photo?")) return;
      const list = JSON.parse(box.dataset.list || "[]"); list.splice(+el.dataset.i, 1);
      try { await savePhotos(box, p, list); T("Photo removed"); } catch (e) { T("Could not remove photo."); }
    }
  }, true);
  lb.addEventListener("click", e => { if (e.target === lb) lb.close(); });

  document.addEventListener("change", async ev => {
    const t = ev.target;
    if (t.dataset && t.dataset.glIn) {
      const box = t.closest(".gl-box"), p = P().find(x => x.id === t.dataset.glIn); if (!box || !p) return;
      let list = JSON.parse(box.dataset.list || "[]"); const files = [...t.files]; t.value = "";
      T("Uploading…");
      try { for (const f of files) { if (list.length >= MAX) { T(`Up to ${MAX} photos.`); break; } list.push(await upload(f, "work")); }
        await savePhotos(box, p, list); T("Photos added"); }
      catch (e) { T(/bucket|policy|storage|row-level/i.test(e.message || "") ? "Photo upload is not allowed yet." : "Could not upload photo."); }
    } else if (t.dataset && t.dataset.glRv) {
      const f = t.files[0]; t.value = ""; if (!f) return; T("Uploading…");
      try { const url = await upload(f, "review"); const { error } = await sb.from("reviews").update({ photo_url: url }).eq("id", t.dataset.glRv); if (error) throw error; T("Photo added to your review");
        const b = $("revBox"); if (b) { b.querySelectorAll(".rv-ph,.rv-add").forEach(n => n.remove()); b.querySelectorAll(".rev").forEach(r => r.dataset.rvp = ""); } decorateReviews(); }
      catch (e) { T("Could not add the photo. Try again."); }
    }
  }, true);
})();
