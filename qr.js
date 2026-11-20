/* SL Connect - tiny offline QR code maker (byte mode, error level M, versions 1-10 = up to 213 characters).
   window.SLC_QR.make(text) -> {size, dark(x,y)}   window.SLC_QR.draw(canvas, text, px, quiet) */
(function () {
  "use strict";
  const ECC = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26], BLK = [1, 1, 2, 2, 4, 4, 4, 4, 5, 5];
  const rawModules = v => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const a = Math.floor(v / 7) + 2; r -= (25 * a - 10) * a - 55; if (v >= 7) r -= 36; } return r; };
  const dataCap = v => Math.floor(rawModules(v) / 8) - ECC[v - 1] * BLK[v - 1];
  const bit = (x, i) => ((x >>> i) & 1) !== 0;
  function utf8(s) { return Array.from(unescape(encodeURIComponent(s))).map(c => c.charCodeAt(0)); }
  const EXP = [], LOG = [];
  (function () { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  const gmul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);
  function rs(data, n) {
    let g = [1]; for (let i = 0; i < n; i++) { const ng = new Array(g.length + 1).fill(0); for (let j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= gmul(g[j], EXP[i]); } g = ng; }
    const res = new Array(n).fill(0);
    for (const b of data) { const f = b ^ res.shift(); res.push(0); for (let i = 0; i < n; i++) res[i] ^= gmul(g[i + 1], f); }
    return res;
  }
  function make(text) {
    const bytes = utf8(text); let ver = 1;
    while (ver <= 10 && dataCap(ver) < bytes.length + (ver < 10 ? 2 : 3)) ver++;
    if (ver > 10) throw new Error("Text too long for QR");
    const size = ver * 4 + 17, cap = dataCap(ver);
    const bits = []; const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); bytes.forEach(b => put(b, 8));
    put(0, Math.min(4, cap * 8 - bits.length)); while (bits.length % 8) bits.push(0);
    const data = []; for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
    for (let p = 0xec; data.length < cap; p ^= 0xec ^ 0x11) data.push(p);
    const nb = BLK[ver - 1], el = ECC[ver - 1], raw = Math.floor(rawModules(ver) / 8), ns = nb - raw % nb, sl = Math.floor(raw / nb);
    const blocks = []; for (let i = 0, k = 0; i < nb; i++) { const d = data.slice(k, k + sl - el + (i < ns ? 0 : 1)); k += d.length; const e = rs(d, el); if (i < ns) d.push(0); blocks.push(d.concat(e)); }
    const all = []; for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== sl - el || j >= ns) all.push(b[i]); });
    const m = [], fn = []; for (let y = 0; y < size; y++) { m.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    const setFn = (x, y, d) => { m[y][x] = d; fn[y][x] = true; };
    for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy; if (x >= 0 && x < size && y >= 0 && y < size) setFn(x, y, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    if (ver > 1) {
      const na = Math.floor(ver / 7) + 2, step = Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2, pos = [6];
      for (let p = size - 7; pos.length < na; p -= step) pos.splice(1, 0, p);
      pos.forEach((cx, i) => pos.forEach((cy, j) => { if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }));
    }
    const fmt = mask => { let r = mask; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537); const b = ((mask << 10) | r) ^ 0x5412;
      for (let i = 0; i <= 5; i++) setFn(8, i, bit(b, i)); setFn(8, 7, bit(b, 6)); setFn(8, 8, bit(b, 7)); setFn(7, 8, bit(b, 8));
      for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(b, i));
      for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(b, i)); for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(b, i)); setFn(8, size - 8, true); };
    fmt(0);
    if (ver >= 7) { let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25); const b = (ver << 12) | r;
      for (let i = 0; i < 18; i++) { const a = size - 11 + i % 3, c = Math.floor(i / 3); setFn(a, c, bit(b, i)); setFn(c, a, bit(b, i)); } }
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) { if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) { const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && i < all.length * 8) { m[y][x] = bit(all[i >>> 3], 7 - (i & 7)); i++; } } }
    const mk = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0, (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
    const apply = k => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && mk[k](x, y)) m[y][x] = !m[y][x]; };
    const pen = () => { let s = 0; for (let t = 0; t < 2; t++) for (let a = 0; a < size; a++) { let run = 1; for (let b = 1; b < size; b++) { const p = t ? m[b - 1][a] : m[a][b - 1], c = t ? m[b][a] : m[a][b]; if (c === p) { run++; if (run === 5) s += 3; else if (run > 5) s++; } else run = 1; } }
      for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) s += 3;
      let d = 0; m.forEach(r => r.forEach(v => { if (v) d++; })); s += Math.floor(Math.abs(d * 20 - size * size * 10) / (size * size)) * 10; return s; };
    let best = 0, bp = 1e9; for (let k = 0; k < 8; k++) { apply(k); fmt(k); const p = pen(); if (p < bp) { bp = p; best = k; } apply(k); }
    apply(best); fmt(best);
    return { size, dark: (x, y) => x >= 0 && y >= 0 && x < size && y < size && m[y][x] };
  }
  function draw(cv, text, px, quiet) {
    px = px || 8; quiet = quiet == null ? 4 : quiet; const q = make(text), n = q.size + quiet * 2;
    cv.width = cv.height = n * px; const c = cv.getContext("2d"); c.fillStyle = "#fff"; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = "#000";
    for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.dark(x, y)) c.fillRect((x + quiet) * px, (y + quiet) * px, px, px);
    return cv;
  }
  window.SLC_QR = { make, draw };
})();
