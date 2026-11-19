// Cut a sheet of blue drawings into one paper cut-out per drawing.
(function (root) {
  function findBands(profile, minGap = 6, minSize = 20) {
    const runs = [];
    let start = -1;
    profile.forEach((v, i) => {
      if (v > 0 && start < 0) start = i;
      if (v === 0 && start >= 0) { runs.push([start, i - 1]); start = -1; }
    });
    if (start >= 0) runs.push([start, profile.length - 1]);
    const merged = [];
    runs.forEach(r => {
      const last = merged[merged.length - 1];
      if (last && r[0] - last[1] - 1 < minGap) last[1] = r[1];
      else merged.push(r.slice());
    });
    return merged.filter(([a, b]) => b - a + 1 >= minSize);
  }

  function even(len, n) { const s = len / n; return Array.from({ length: n }, (_, i) => [Math.round(i * s), Math.round((i + 1) * s) - 1]); }

  function cells(rowProfile, colProfile, w, h, rows = 5, cols = 10) {
    let rb = findBands(rowProfile, Math.max(6, Math.round(h * 0.01)), Math.round(h / rows * 0.3));
    let cb = findBands(colProfile, Math.max(6, Math.round(w * 0.006)), Math.round(w / cols * 0.3));
    if (rb.length !== rows || cb.length !== cols) { rb = even(h, rows); cb = even(w, cols); }
    const out = [];
    rb.forEach(([y0, y1]) => cb.forEach(([x0, x1]) => out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 })));
    return out;
  }

  function inkAlpha(r, g, b) {
    const a = Math.min(1, (255 - Math.min(r, g, b)) / 170);
    return a < 0.12 ? 0 : a;
  }

  // 1 = inside the drawing's outer outline (paper), 0 = outside.
  function silhouette(alpha, w, h, thr = 40) {
    const out = new Uint8Array(w * h).fill(1);
    const stack = [];
    const push = (x, y) => { const i = y * w + x; if (out[i] && alpha[i] < thr) { out[i] = 0; stack.push(i); } };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    while (stack.length) {
      const i = stack.pop(), x = i % w, y = (i / w) | 0;
      if (x > 0) push(x - 1, y);
      if (x < w - 1) push(x + 1, y);
      if (y > 0) push(x, y - 1);
      if (y < h - 1) push(x, y + 1);
    }
    return out;
  }

  // Remove ink pieces that touch the crop's left/right/top/bottom edge (within `margin`)
  // and are much smaller than the biggest piece: those are slivers of the neighbouring drawing.
  function dropEdgeSpecks(alpha, w, h, margin = 0, thr = 60) {
    const label = new Int32Array(w * h).fill(-1), comps = [];
    for (let s = 0; s < w * h; s++) {
      if (label[s] >= 0 || alpha[s] < thr) continue;
      const c = { px: [], edge: false, x0: w, x1: 0 }, stack = [s]; label[s] = comps.length;
      while (stack.length) {
        const i = stack.pop(), x = i % w, y = (i / w) | 0;
        c.px.push(i); c.x0 = Math.min(c.x0, x); c.x1 = Math.max(c.x1, x);
        if (x <= margin || y <= margin || x >= w - 1 - margin || y >= h - 1 - margin) c.edge = true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx; if (label[j] < 0 && alpha[j] >= thr) { label[j] = comps.length; stack.push(j); }
        }
      }
      comps.push(c);
    }
    const out = Uint8Array.from(alpha);
    if (!comps.length) return out;
    const main = comps.reduce((a, b) => (b.px.length > a.px.length ? b : a));
    const biggest = main.px.length;
    // A neighbour's sliver is small and either sits on the crop edge (thin or tiny)
    // or stands off to the side of the main drawing. Trees and bushes that belong to
    // the drawing are bigger, so they stay.
    comps.forEach(c => {
      if (c === main || c.px.length >= biggest * 0.2) return;
      const onEdge = c.edge && (c.x1 - c.x0 + 1 < w * 0.1 || c.px.length < biggest * 0.09);
      const aside = c.x1 < main.x0 - 3 || c.x0 > main.x1 + 3;
      if (onEdge || aside) c.px.forEach(i => { out[i] = 0; });
    });
    // faint anti-aliased pixels next to removed ink go too
    for (let i = 0; i < w * h; i++) if (out[i] < thr && alpha[i] < thr) {
      const x = i % w, y = (i / w) | 0;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < w && ny < h && alpha[ny * w + nx] >= thr && out[ny * w + nx] === 0; });
      if (near) out[i] = 0;
    }
    return out;
  }

  // Browser only: image -> [{canvas (paper + lines), back (paper + faint lines), thumb, aspect}]
  function load(img, rows = 5, cols = 10) {
    const W = img.naturalWidth, H = img.naturalHeight;
    const src = document.createElement('canvas'); src.width = W; src.height = H;
    const sctx = src.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(img, 0, 0);
    const px = sctx.getImageData(0, 0, W, H).data;
    const alphaAt = i => inkAlpha(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
    const rowP = new Array(H).fill(0), colP = new Array(W).fill(0);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (alphaAt(y * W + x) > 0.5) { rowP[y]++; colP[x]++; }
    return cells(rowP, colP, W, H, rows, cols).map(c => cutOne(px, W, c));
  }

  function cutOne(px, W, c) {
    const pad = 6, w = c.w + pad * 2, h = c.h + pad * 2;
    const raw = new Uint8Array(w * h);
    for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
      const i = ((c.y + y) * W + (c.x + x)) * 4;
      raw[(y + pad) * w + x + pad] = Math.round(inkAlpha(px[i], px[i + 1], px[i + 2]) * 255);
    }
    const alpha = dropEdgeSpecks(raw, w, h, pad + 2, 60);
    // thicken the ink a little so the paper edge closes small gaps in the outline
    const grown = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      let m = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) m = Math.max(m, alpha[(y + dy) * w + x + dx]);
      grown[y * w + x] = m;
    }
    const paper = silhouette(grown, w, h, 60);
    const make = (lineOpacity, mirror) => {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d'); const im = ctx.createImageData(w, h); const d = im.data;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const sx = mirror ? w - 1 - x : x, si = y * w + sx, o = (y * w + x) * 4;
        const a = alpha[si] / 255 * lineOpacity;
        const p = paper[si] || grown[si] > 60;
        // blend blue line (40,110,235) over white paper
        d[o] = Math.round(255 * (1 - a) + 40 * a); d[o + 1] = Math.round(255 * (1 - a) + 110 * a); d[o + 2] = Math.round(255 * (1 - a) + 235 * a);
        d[o + 3] = p ? 255 : 0;
      }
      ctx.putImageData(im, 0, 0);
      return cv;
    };
    const front = make(1, false);
    return { canvas: front, back: make(0.35, true), thumb: front.toDataURL('image/png'), aspect: h / w };
  }

  const api = { findBands, cells, inkAlpha, silhouette, dropEdgeSpecks, load };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.BV = root.BV || {}; root.BV.Sheet = api; }
})(this);
