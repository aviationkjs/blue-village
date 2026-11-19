// 3D house generator: one recipe per drawing on the sheet (집 1..50). Browser only.
(function (root) {
  const Mo = root.BV.Models;
  const { M, part, box, bar, gable, hipRoof, windowOn, addSmoke } = Mo;

  const R = o => Object.assign({ w: 2, d: 1.6, h: 1.1, floors: 1, roof: 'gable', rh: 0.85, o: 0.2, win: 1, winB: null, ws: 'cross', door: 'rect', doors: 1, doorSlot: null, chim: null, ex: [] }, o);

  // One recipe per drawing, in sheet order (row by row).
  const RECIPES = [
    R({ w: 1.9, h: 1.15, win: 1, ws: 'pane', door: 'none', chim: 0.55 }),
    R({ chim: 0.55, winB: 0, ex: ['gableRound'] }),
    R({ h: 1.8, floors: 2, win: 2, winB: 1, ws: 'shutter', door: 'double', rh: 0.6 }),
    R({ chim: 0.55, win: 1, ws: 'wide', door: 'none' }),
    R({ w: 1.7, h: 1.2, winB: 0, door: 'double', chim: 0.5, ex: ['gableWin'] }),
    R({ roof: 'shed', rh: 0.9, h: 1.0, door: 'none', win: 0, ex: ['glass'] }),
    R({ w: 2.2, d: 1.7, winB: 1, door: 'double', doorSlot: 0, ws: 'shutter', chim: 0.55, ex: ['gableWin'] }),
    R({ roof: 'hip', win: 1, ws: 'wide', ex: ['roundTreeR'] }),
    R({ w: 1.4, d: 1.4, h: 1.9, floors: 2, win: 2, winB: 0, door: 'arch', rh: 0.9, chim: 0.5 }),
    R({ roof: 'tiled', w: 2.3, h: 0.95, rh: 0.75, winB: 2, doorSlot: 2, chim: 0.45, ws: 'wide' }),
    R({ w: 1.4, winB: 1, chim: 0.4, ex: ['garageL'] }),
    R({ roof: 'side', floors: 2, h: 1.7, win: 2, winB: 1, chim: 0.5, ex: ['balcony'] }),
    R({ w: 1.8, win: 1, ws: 'pane', door: 'none', rh: 0.8 }),
    R({ w: 2.1, winB: 0, door: 'double', rh: 0.8, ex: ['log', 'gableRound'] }),
    R({ roof: 'aframe', rh: 2.0, ex: ['treeR'] }),
    R({ w: 1.9, winB: 2, door: 'none', chim: 0.55 }),
    R({ w: 2.1, winB: 0, rh: 0.75, ex: ['columns'] }),
    R({ roof: 'side', w: 2.3, h: 1.0, rh: 0.95, winB: 2, door: 'double', ex: ['dormers'] }),
    R({ w: 1.9, winB: 0, ex: ['porch', 'gableWin'] }),
    R({ roof: 'twin', w: 2.3, winB: 2, doors: 2 }),
    R({ w: 1.5, d: 1.4, h: 2.4, floors: 3, win: 2, winB: 0, rh: 0.8, ws: 'pane' }),
    R({ roof: 'side', w: 1.5, winB: 1, door: 'none', chim: -0.3, ex: ['garageR'] }),
    R({ roof: 'round', w: 1.9, rh: 0.85, winB: 1, doorSlot: 1, ex: ['gableRound'] }),
    R({ w: 1.5, h: 1.3, winB: 0, door: 'arch', rh: 0.7, ex: ['towers'] }),
    R({ roof: 'hip', w: 1.8, h: 1.0, winB: 1, door: 'none', ws: 'round', chim: 0.4, ex: ['fenceR'] }),
    R({ w: 1.4, d: 1.4, h: 1.6, floors: 2, rh: 1.0, win: 2, winB: 0, ws: 'arch', door: 'double', ex: ['gableRound'] }),
    R({ roof: 'shed', w: 2.2, h: 1.1, rh: 0.7, win: 0, door: 'none', ex: ['glass'] }),
    R({ winB: 1, doorSlot: 1, ws: 'pane', ex: ['stone', 'gableWin'] }),
    R({ roof: 'shed', h: 0.9, rh: 0.5, winB: 1, doorSlot: 0, ws: 'pane' }),
    R({ rh: 0.8, winB: 0, door: 'barn' }),
    R({ w: 1.6, h: 1.4, floors: 2, win: 1, winB: 1, door: 'none', chim: 0.55, ex: ['roundTreeL'] }),
    R({ w: 1.6, h: 1.5, floors: 2, win: 1, winB: 1, ex: ['fenceL'] }),
    R({ roof: 'shed', w: 2.1, h: 1.4, rh: 0.6, win: 0, door: 'none', ex: ['glass'] }),
    R({ w: 1.9, winB: 1, ws: 'wide', door: 'none', chim: 0.55 }),
    R({ h: 1.7, floors: 2, win: 3, winB: 0, rh: 0.6, ex: ['balcony'] }),
    R({ w: 1.8, winB: 1, door: 'none', chim: 0.5, ex: ['bushL'] }),
    R({ w: 2.4, d: 1.7, h: 1.0, rh: 0.8, winB: 2, ws: 'wide', door: 'none' }),
    R({ w: 1.9, winB: 1, door: 'double', ex: ['bell', 'gableRound'] }),
    R({ w: 1.7, winB: 0, door: 'arch', ex: ['bushes', 'gableWin'] }),
    R({ w: 1.4, d: 1.4, h: 2.4, floors: 3, win: 2, winB: 1, rh: 0.6 }),
    R({ roof: 'round', w: 1.9, rh: 0.8, winB: 0, door: 'arch', chim: 0.5, ex: ['gableRound'] }),
    R({ roof: 'shed', w: 1.7, h: 1.2, rh: 0.6, win: 0, door: 'none', ex: ['glass', 'annexR'] }),
    R({ w: 1.8, winB: 0, door: 'arch', chim: 0.55, ex: ['gableWin'] }),
    R({ w: 1.8, winB: 1, ws: 'pane', door: 'none', chim: 0.55 }),
    R({ roof: 'hanok', w: 2.2, h: 0.95, rh: 0.95, winB: 2, door: 'double', ws: 'pane' }),
    R({ w: 1.6, winB: 1, door: 'none', ex: ['roundTreeL'] }),
    R({ roof: 'twin', w: 2.1, h: 2.2, floors: 3, win: 4, winB: 2, doors: 2 }),
    R({ roof: 'flat', w: 1.4, h: 1.3, winB: 1, door: 'none', ex: ['garageL'] }),
    R({ w: 1.9, winB: 1, door: 'double', doorSlot: 1, ex: ['annexR', 'gableWin'] }),
    R({ w: 1.6, winB: 2, door: 'none', chim: 0.55 }),
  ];

  function spread(n, w) {
    if (n <= 1) return [0];
    const m = Math.min(0.42, w / (2 * n));
    return Array.from({ length: n }, (_, i) => -w / 2 + m + i * (w - 2 * m) / (n - 1));
  }
  function shapeGeo(points) {
    const s = new THREE.Shape(); s.moveTo(points[0][0], points[0][1]);
    points.slice(1).forEach(p => s.lineTo(p[0], p[1])); s.closePath(); return s;
  }
  function extrude(shape, depth) { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 16 }); g.translate(0, 0, -depth / 2); return g; }

  function roundWin(g, r, x, y, z) {
    part(new THREE.CircleGeometry(r, 20), g, x, y, z, M.win);
    bar(g, r * 2, 0.03, 0.05, x, y, z); bar(g, 0.03, r * 2, 0.05, x, y, z);
  }
  function archWin(g, w, h, x, y, z) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, -h / 2); s.lineTo(-w / 2, h / 2 - w / 2); s.absarc(0, h / 2 - w / 2, w / 2, Math.PI, 0, true); s.lineTo(w / 2, -h / 2); s.closePath();
    part(new THREE.ShapeGeometry(s, 12), g, x, y, z, M.win);
    bar(g, 0.03, h, 0.05, x, y, z);
  }
  function addWindow(g, style, w, h, x, y, z) {
    if (style === 'round') roundWin(g, Math.min(w, h) * 0.55, x, y, z);
    else if (style === 'arch') archWin(g, w * 0.85, h * 1.3, x, y, z);
    else if (style === 'wide') windowOn(g, w * 1.5, h * 0.8, x, y, z);
    else if (style === 'shutter') windowOn(g, w * 0.8, h, x, y, z, true);
    else windowOn(g, w, h, x, y, z);
  }
  function addDoor(g, style, x, z, fh) {
    const dw = 0.36, dh = Math.min(0.72, fh * 0.75);
    if (style === 'arch') {
      const s = new THREE.Shape();
      s.moveTo(-dw / 2, 0); s.lineTo(-dw / 2, dh - dw / 2); s.absarc(0, dh - dw / 2, dw / 2, Math.PI, 0, true); s.lineTo(dw / 2, 0); s.closePath();
      part(new THREE.ShapeGeometry(s, 12), g, x, 0.01, z, M.soft);
    } else if (style === 'double') {
      part(box(dw * 1.5, dh, 0.05), g, x, dh / 2, z, M.soft); bar(g, 0.03, dh, 0.07, x, dh / 2, z);
    } else if (style === 'barn') {
      const W = dw * 2, H = dh * 1.1;
      part(box(W, H, 0.05), g, x, H / 2, z, M.soft);
      const L = Math.hypot(W, H), a = Math.atan2(H, W);
      [a, -a].forEach(r => { const b = bar(g, L * 0.95, 0.04, 0.07, x, H / 2, z); b.rotation.z = r; });
    } else {
      part(box(dw, dh, 0.05), g, x, dh / 2, z, M.soft);
    }
    return dh;
  }

  function roof(g, s) {
    const y = s.h, W = s.w + s.o, D = s.d + s.o, rh = s.rh;
    switch (s.roof) {
      case 'side': { const r = part(gable(D, rh, W), g, 0, y, 0); r.rotation.y = Math.PI / 2; break; }
      case 'hip': part(hipRoof(W, D, rh, Math.min(W, D) * 0.42), g, 0, y, 0); break;
      case 'shed': {
        part(extrude(shapeGeo([[-s.w / 2, 0], [s.w / 2, 0], [s.w / 2, rh]]), s.d), g, 0, y, 0);
        const L = Math.hypot(W, rh), slab = part(box(L, 0.1, D), g, 0, y + rh / 2 + 0.05, 0);
        slab.rotation.z = Math.atan2(rh, W); break;
      }
      case 'flat': part(box(W, 0.14, D), g, 0, y + 0.07, 0); break;
      case 'round': {
        const sh = new THREE.Shape(); sh.moveTo(W / 2, 0); sh.absellipse(0, 0, W / 2, rh, 0, Math.PI, false); sh.closePath();
        part(extrude(sh, D), g, 0, y, 0); break;
      }
      case 'twin': [-1, 1].forEach(k => part(gable(W / 2 + 0.06, rh, D), g, k * W / 4, y, 0)); break;
      case 'tiled': {
        part(hipRoof(W, D, rh, Math.min(W, D) * 0.4), g, 0, y, 0);
        [0.3, 0.6].forEach(t => bar(g, W * (1 - t * 0.55), 0.05, 0.05, 0, y + rh * t + 0.03, D / 2 * (1 - t) + 0.03));
        break;
      }
      case 'hanok': {
        part(box(s.w + 0.06, 0.12, s.d + 0.06), g, 0, y + 0.06, 0);
        const RW = W + 0.45, RD = D + 0.35, ridge = RW - RD * 1.1;
        part(hipRoof(RW, RD, rh, (RW - ridge) / 2), g, 0, y + 0.12, 0);
        bar(g, ridge + 0.1, 0.1, 0.1, 0, y + 0.14 + rh, 0);
        [-1, 1].forEach(a => { const t = bar(g, 0.22, 0.08, 0.08, a * (ridge / 2 + 0.1), y + 0.2 + rh, 0); t.rotation.z = a * 0.6; });
        [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => { const t = bar(g, 0.16, 0.05, 0.05, a * (RW / 2 + 0.03), y + 0.17, b * (RD / 2)); t.rotation.z = a * 0.7; });
        break;
      }
      case 'aframe': break; // the whole house is the roof; drawn in build()
      default: part(gable(W, rh, D), g, 0, y, 0);
    }
  }

  function gableFace(s) {
    return ['gable', 'round', 'twin'].includes(s.roof) ? { z: (s.d + s.o) / 2 + 0.02, y: s.h + s.rh * 0.36 } : null;
  }

  function extras(g, s, ctx, ticks) {
    const { w, d, h } = s, fz = d / 2 + 0.03, fh = h / s.floors;
    const side = k => (k.endsWith('L') ? -1 : 1);
    s.ex.forEach(k => {
      if (/^(round)?[tT]reeL$|^(round)?[tT]reeR$/.test(k)) {
        const t = Mo.deco(k.startsWith('round') ? 'roundTree' : 'tree'); t.scale.setScalar(1.25);
        t.position.set(side(k) * (w / 2 + 0.42), 0, d * 0.15); g.add(t);
      } else if (k === 'fenceL' || k === 'fenceR') {
        const f = Mo.deco('fence'); f.scale.setScalar(0.8); f.position.set(side(k) * (w / 2 + 0.42), 0, d / 2 - 0.1); g.add(f);
      } else if (k === 'bushL' || k === 'bushR' || k === 'bushes') {
        (k === 'bushes' ? [-1, 1] : [side(k)]).forEach(sd => { const b = Mo.deco('bush'); b.position.set(sd * (w / 2 + 0.3), 0, d / 2 - 0.1); g.add(b); });
      } else if (k === 'garageL' || k === 'garageR') {
        const gw = 0.95, gh = Math.min(h * 0.85, 0.95), gd = d * 0.9, x = side(k) * (w / 2 + gw / 2);
        part(box(gw, gh, gd), g, x, gh / 2, -d * 0.05);
        part(box(gw + 0.12, 0.08, gd + 0.12), g, x, gh + 0.04, -d * 0.05);
        const gz = gd / 2 - d * 0.05 + 0.03;
        part(box(gw * 0.75, gh * 0.68, 0.05), g, x, gh * 0.34, gz, M.soft);
        for (let i = 1; i < 4; i++) bar(g, gw * 0.75, 0.025, 0.07, x, gh * 0.68 * i / 4, gz);
      } else if (k === 'annexR' || k === 'annexL') {
        const aw = 0.75, ah = h * 0.6, x = side(k) * (w / 2 + aw / 2);
        part(box(aw, ah, d * 0.8), g, x, ah / 2, -d * 0.1);
        part(box(aw + 0.1, 0.08, d * 0.8 + 0.1), g, x, ah + 0.04, -d * 0.1);
        windowOn(g, 0.32, 0.28, x, ah * 0.55, d * 0.4 - d * 0.1 + 0.03);
      } else if (k === 'porch') {
        const x = ctx.doorX, z = d / 2 + 0.32, ph = Math.min(ctx.doorH + 0.15, fh * 0.95);
        [-0.28, 0.28].forEach(dx => bar(g, 0.05, ph, 0.05, x + dx, ph / 2, z));
        part(gable(0.8, 0.3, 0.6), g, x, ph, d / 2 + 0.25);
      } else if (k === 'columns') {
        part(box(w + 0.2, 0.08, 0.7), g, 0, 0.04, d / 2 + 0.3);
        spread(4, w).forEach(x => part(new THREE.CylinderGeometry(0.07, 0.07, h - 0.08, 8), g, x, h / 2 + 0.04, d / 2 + 0.42));
        part(box(w + 0.2, 0.1, 0.7), g, 0, h + 0.05, d / 2 + 0.3);
      } else if (k === 'balcony') {
        const y = fh, z = d / 2 + 0.2;
        part(box(w * 0.7, 0.06, 0.4), g, 0, y, z);
        bar(g, w * 0.7, 0.04, 0.04, 0, y + 0.26, z + 0.18);
        spread(6, w * 0.7).forEach(x => bar(g, 0.03, 0.26, 0.03, x, y + 0.13, z + 0.18));
      } else if (k === 'dormers') {
        [-1, 1].forEach(sd => {
          const x = sd * w * 0.25, y = h + s.rh * 0.25, z = (d + s.o) * 0.22;
          part(box(0.42, 0.36, 0.5), g, x, y + 0.18, z);
          part(gable(0.55, 0.26, 0.6), g, x, y + 0.36, z);
          windowOn(g, 0.22, 0.2, x, y + 0.18, z + 0.27);
        });
      } else if (k === 'bell') {
        const y = h + s.rh;
        part(box(0.36, 0.42, 0.36), g, 0, y + 0.1, 0);
        const c = part(new THREE.ConeGeometry(0.34, 0.45, 4), g, 0, y + 0.53, 0); c.rotation.y = Math.PI / 4;
        const bell = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), M.lamp); bell.position.set(0, y + 0.08, 0.19); g.add(bell);
      } else if (k === 'log') {
        for (let y = 0.15; y < h; y += 0.17) bar(g, w + 0.1, 0.035, 0.05, 0, y, fz - 0.01);
      } else if (k === 'stone') {
        [-1, 1].forEach(sd => { for (let i = 0; i < 4; i++) part(box(0.16, 0.13, 0.16), g, sd * (w / 2 - 0.02) + (i % 2 ? -sd * 0.05 : 0), 0.15 + i * (h - 0.25) / 3, d / 2 - 0.06); });
      } else if (k === 'towers') {
        [-1, 1].forEach(sd => {
          const x = sd * (w / 2 + 0.2), th = h * 1.55;
          part(new THREE.CylinderGeometry(0.3, 0.3, th, 10), g, x, th / 2, d * 0.15);
          part(new THREE.ConeGeometry(0.38, 0.6, 10), g, x, th + 0.3, d * 0.15);
          bar(g, 0.03, 0.4, 0.03, x, th + 0.8, d * 0.15);
          const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.16), M.flag); fl.position.set(x + 0.15, th + 0.92, d * 0.15); g.add(fl);
          ticks.push(t => { fl.rotation.y = Math.sin(t * 3 + sd) * 0.35; });
        });
      } else if (k === 'glass') {
        const gw = w * 0.82, gh = h * 0.78;
        part(box(gw, gh, 0.05), g, 0, gh / 2 + 0.06, fz, M.win);
        spread(4, gw).slice(1, 3).concat([0]).forEach(x => bar(g, 0.04, gh, 0.07, x, gh / 2 + 0.06, fz));
        bar(g, gw, 0.04, 0.07, 0, gh * 0.62, fz);
      } else if (k === 'gableRound' || k === 'gableWin') {
        const gf = gableFace(s); if (!gf) return;
        const xs = s.roof === 'twin' ? [-(s.w + s.o) / 4, (s.w + s.o) / 4] : [0];
        xs.forEach(x => { if (k === 'gableRound') roundWin(g, Math.min(0.17, s.rh * 0.22), x, gf.y, gf.z); else windowOn(g, 0.3, 0.26, x, gf.y, gf.z); });
      }
    });
  }

  function build(ref) {
    const s = RECIPES[+ref] || RECIPES[0];
    const inner = new THREE.Group();
    const ticks = [];
    const ctx = { doorX: 0, doorH: 0.6 };
    const fz = s.d / 2 + 0.03, fh = s.h / s.floors;

    if (s.roof === 'aframe') {
      const W = s.w + s.o, D = s.d + s.o;
      part(gable(W, s.rh, D), inner, 0, 0, 0);
      ctx.doorH = addDoor(inner, 'rect', 0, D / 2 + 0.02, 0.9);
      windowOn(inner, 0.32, 0.3, 0, s.rh * 0.55, D / 2 + 0.02);
    } else {
      part(box(s.w, s.h, s.d), inner, 0, s.h / 2, 0);
      roof(inner, s);
      const winB = s.winB == null ? s.win : s.winB;
      const doors = s.door === 'none' ? 0 : s.doors;
      const slots = winB + doors;
      const xs = slots ? spread(slots, s.w - (slots > 2 ? 0 : 0.2)) : [];
      const doorIdx = doors === 2 ? [1, slots - 2] : doors ? [s.doorSlot == null ? Math.floor(slots / 2) : Math.min(s.doorSlot, slots - 1)] : [];
      const ww = Math.min(0.5, (s.w / Math.max(1, slots)) * 0.55), wh = Math.min(0.46, fh * 0.42);
      xs.forEach((x, i) => {
        if (doorIdx.includes(i)) { ctx.doorX = x; ctx.doorH = addDoor(inner, s.door, x, fz, fh); }
        else addWindow(inner, s.ws, ww, wh, x, fh * 0.55, fz);
      });
      for (let f = 1; f < s.floors; f++) {
        const n = s.win, uw = Math.min(0.46, (s.w / Math.max(1, n)) * 0.55);
        if (n) spread(n, s.w - 0.2).forEach(x => addWindow(inner, s.ws, uw, wh, x, fh * (f + 0.55), fz));
      }
      // windows on the back so a turned house is not blank
      spread(Math.max(1, Math.min(3, Math.round(s.w))), s.w - 0.3).forEach(x => windowOn(inner, 0.32, Math.min(0.32, wh), x, fh * 0.55, -fz));
    }
    if (s.chim != null && s.roof !== 'aframe') {
      const cx = s.chim * s.w / 2, cz = -s.d * 0.15, top = s.h + Math.max(0.35, s.rh) * 0.95 + 0.15;
      const base = s.h + 0.05, ch = top - base;
      const c = part(box(0.22, ch, 0.22), inner, cx, base + ch / 2, cz);
      part(box(0.28, 0.06, 0.28), c, 0, ch / 2, 0);
      ticks.push(addSmoke(inner, cx, top + 0.15, cz));
    }
    extras(inner, s, ctx, ticks);

    // shrink to fit a 2x2 footprint and centre it
    const bb = new THREE.Box3().setFromObject(inner), size = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    const k = Math.min(1.25, 1.82 / Math.max(size.x, size.z));
    inner.scale.setScalar(k);
    inner.position.set(-c.x * k, 0, -c.z * k);
    const g = new THREE.Group(); g.add(inner);
    if (ticks.length) g.userData.tick = (t, dt, n) => ticks.forEach(fn => fn(t, dt, n));
    return g;
  }

  root.BV.House3D = { build, RECIPES };
})(this);
