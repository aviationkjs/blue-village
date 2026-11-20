// Photo → blue line drawing for statues, and the statue picture store. Browser only.
(function (root) {
  // Edge lines from a photo. detail 0..1: more detail keeps fainter edges.
  // Returns { mask, preview, w, h }: mask = white lines on black (used as alpha), preview = blue lines on white.
  function toLineArt(img, detail = 0.5, maxSide = 320) {
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    const w = Math.max(8, Math.round((img.naturalWidth || img.width) * k)), h = Math.max(8, Math.round((img.naturalHeight || img.height) * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, w, h);
    const src = x.getImageData(0, 0, w, h).data;
    const N = w * h;
    let g = new Float32Array(N);
    for (let i = 0; i < N; i++) g[i] = 0.299 * src[i * 4] + 0.587 * src[i * 4 + 1] + 0.114 * src[i * 4 + 2];
    // two passes of a 3x3 blur to calm photo noise
    for (let pass = 0; pass < 2; pass++) {
      const o = new Float32Array(N);
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        let s = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const X = xx + dx, Y = yy + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
          s += g[Y * w + X]; n++;
        }
        o[yy * w + xx] = s / n;
      }
      g = o;
    }
    // Sobel magnitude
    const mag = new Float32Array(N);
    for (let yy = 1; yy < h - 1; yy++) for (let xx = 1; xx < w - 1; xx++) {
      const i = yy * w + xx;
      const gx = -g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1] + g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1];
      const gy = -g[i - w - 1] - 2 * g[i - w] - g[i - w + 1] + g[i + w - 1] + 2 * g[i + w] + g[i + w + 1];
      mag[i] = Math.hypot(gx, gy);
    }
    // keep the strongest edges: the top 6%..20% depending on detail
    const sorted = Float32Array.from(mag).sort();
    const thr = Math.max(12, sorted[Math.floor(N * (0.94 - detail * 0.14))]);
    let on = new Uint8Array(N);
    for (let i = 0; i < N; i++) on[i] = mag[i] >= thr ? 1 : 0;
    // drop lonely specks, then thicken a little so the lines read at a distance
    const clean = new Uint8Array(N);
    for (let yy = 1; yy < h - 1; yy++) for (let xx = 1; xx < w - 1; xx++) {
      const i = yy * w + xx; if (!on[i]) continue;
      let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n += on[i + dy * w + dx];
      if (n >= 3) clean[i] = 1;
    }
    on = new Uint8Array(N);
    for (let yy = 1; yy < h - 1; yy++) for (let xx = 1; xx < w - 1; xx++) {
      const i = yy * w + xx;
      if (clean[i] || clean[i - 1] || clean[i + 1] || clean[i - w] || clean[i + w]) on[i] = 1;
    }
    const make = (fg, bg) => {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const cx = cv.getContext('2d'); const im = cx.createImageData(w, h);
      for (let i = 0; i < N; i++) { const col = on[i] ? fg : bg; im.data[i * 4] = col[0]; im.data[i * 4 + 1] = col[1]; im.data[i * 4 + 2] = col[2]; im.data[i * 4 + 3] = 255; }
      cx.putImageData(im, 0, 0); return cv;
    };
    return { mask: make([255, 255, 255], [0, 0, 0]), preview: make([63, 127, 232], [255, 255, 255]), w, h };
  }

  // statue pictures live beside the villages (shared by every village slot)
  const KEY = 'bv-statues';
  let all = {};
  try { all = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { all = {}; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(all)); return true; } catch (e) { return false; } }
  const Statues = {
    get: id => all[id] || null,
    list: () => Object.keys(all).map(id => [id, all[id]]),
    add(rec) {
      const id = 's' + Date.now().toString(36);
      all[id] = rec;
      if (!save()) { delete all[id]; return null; }
      return id;
    },
    remove(id) { delete all[id]; save(); },
  };

  root.BV = root.BV || {};
  root.BV.Photo = { toLineArt };
  root.BV.Statues = Statues;
})(this);
