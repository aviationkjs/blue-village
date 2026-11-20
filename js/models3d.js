// 3D buildings and decorations in the blue-outline style. Browser only (needs THREE).
(function (root) {
  const C = c => new THREE.Color(c);
  const DAY = { bg: C(0xf3f7ff), fill: C(0xffffff), line: C(0x3f7fe8), soft: C(0xd6e4fc), ground: C(0xe6efff), board: C(0xf7faff), road: C(0xd0defa), win: C(0xeef4ff), lamp: C(0xffffff), paper: C(0xffffff), edge: C(0xb8ccf2) };
  const NIGHT = { bg: C(0x0d1730), fill: C(0x21345e), line: C(0x8fb6ff), soft: C(0x2c4680), ground: C(0x13224a), board: C(0x182b56), road: C(0x1d3260), win: C(0xffd36b), lamp: C(0xffe08a), paper: C(0x8c9fc9), edge: C(0x4b6299) };
  const off = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
  const M = {
    fill: new THREE.MeshLambertMaterial({ color: DAY.fill, ...off }),
    line: new THREE.LineBasicMaterial({ color: DAY.line }),
    blue: new THREE.MeshBasicMaterial({ color: DAY.line }),
    soft: new THREE.MeshLambertMaterial({ color: DAY.soft, side: THREE.DoubleSide, ...off }),
    win: new THREE.MeshBasicMaterial({ color: DAY.win, ...off }),
    lamp: new THREE.MeshBasicMaterial({ color: DAY.lamp }),
    flag: new THREE.MeshBasicMaterial({ color: DAY.line, side: THREE.DoubleSide }),
    glow: null, // lamp light pool on the ground, made below once a canvas exists
  };
  (function () {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,224,140,0.85)'); gr.addColorStop(0.45, 'rgba(255,214,120,0.35)'); gr.addColorStop(1, 'rgba(255,210,110,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    M.glow = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  })();

  function part(geo, parent, x = 0, y = 0, z = 0, mat = M.fill) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geo, mat));
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), M.line));
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  }
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  function bar(parent, w, h, d, x, y, z) { const m = new THREE.Mesh(box(w, h, d), M.blue); m.position.set(x, y, z); parent.add(m); return m; }
  function gable(w, h, d) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
    g.translate(0, 0, -d / 2);
    return g;
  }
  function hipRoof(w, d, h, inset) {
    const A = [-w / 2, 0, -d / 2], B = [w / 2, 0, -d / 2], Cc = [w / 2, 0, d / 2], D = [-w / 2, 0, d / 2];
    const R1 = [-w / 2 + inset, h, 0], R2 = [w / 2 - inset, h, 0];
    const tris = [D, Cc, R2, D, R2, R1, B, A, R1, B, R1, R2, A, D, R1, Cc, B, R2, A, Cc, B, A, D, Cc];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
    g.computeVertexNormals();
    return g;
  }
  function windowOn(parent, w, h, x, y, z, shutters = false) {
    const g = part(box(w, h, 0.05), parent, x, y, z, M.win);
    bar(g, 0.04, h, 0.07, 0, 0, 0);
    bar(g, w, 0.04, 0.07, 0, h * 0.1, 0);
    if (shutters) { part(box(w * 0.28, h, 0.04), g, -w / 2 - w * 0.16, 0, 0); part(box(w * 0.28, h, 0.04), g, w / 2 + w * 0.16, 0, 0); }
    return g;
  }
  function leaf(parent, x, y, z, rotZ, size = 1) {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.quadraticCurveTo(0.24, 0.16, 0, 0.46); s.quadraticCurveTo(-0.24, 0.16, 0, 0);
    const g = part(new THREE.ShapeGeometry(s, 8), parent, x, y, z, M.soft);
    g.rotation.z = rotZ; g.scale.setScalar(size);
  }

  // chimney smoke as children of the building, so it moves with it
  function addSmoke(g, x, y, z) {
    const puffs = [];
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
      m.userData.smoke = true;
      g.add(m); puffs.push({ m, t: i / 5 });
    }
    return (t, dt, night) => puffs.forEach(p => {
      p.t = (p.t + dt * 0.25) % 1;
      p.m.position.set(x + Math.sin(p.t * 5) * 0.15 + p.t * 0.8, y + p.t * 2.4, z);
      p.m.scale.setScalar(0.5 + p.t * 1.4);
      p.m.material.opacity = 0.85 * (1 - p.t);
      p.m.material.color.setRGB(1 - night * 0.55, 1 - night * 0.48, 1 - night * 0.3);
    });
  }

  const B = {};
  B.cottage = () => {
    const g = new THREE.Group();
    const W = 4.6, D = 2.4, H = 1.5;
    part(box(W, H, D), g, 0, H / 2, 0);
    part(hipRoof(W + 0.5, D + 0.5, 1.05, 0.9), g, 0, H, 0);
    const ch = part(box(0.3, 0.75, 0.3), g, 1.7, H + 0.75, -0.35);
    part(box(0.38, 0.08, 0.38), ch, 0, 0.4, 0);
    const fz = D / 2 + 0.03;
    [-1.75, -0.95, -0.15, 1.55].forEach(x => windowOn(g, 0.5, 0.48, x, 0.9, fz, true));
    part(box(0.5, 0.95, 0.05), g, 0.68, 0.55, fz, M.soft);
    part(box(0.75, 0.12, 0.35), g, 0.68, 0.06, fz + 0.15);
    [-1.4, 0, 1.4].forEach(x => windowOn(g, 0.5, 0.48, x, 0.9, -fz, true));
    g.userData.tick = addSmoke(g, 1.7, H + 1.2, -0.35);
    return g;
  };
  B.greenhouse = () => {
    const g = new THREE.Group();
    const W = 2.2, D = 2.4, H = 1.2;
    part(box(W, H, D), g, 0, H / 2, 0);
    part(gable(W + 0.2, 1.0, D + 0.2), g, 0, H, 0);
    for (let i = -2; i <= 2; i++) { bar(g, 0.05, H, 0.05, W / 2 + 0.02, H / 2, i * (D / 5)); bar(g, 0.05, H, 0.05, -W / 2 - 0.02, H / 2, i * (D / 5)); }
    bar(g, W + 0.06, 0.05, D + 0.06, 0, 0.3, 0);
    const fz = D / 2 + 0.04;
    [[-0.5, 0.45], [-0.5, 0.82], [0.45, 0.5]].forEach(([x, y]) => { leaf(g, x, y, fz, -0.7, 0.85); leaf(g, x, y, fz, 0.7, 0.85); });
    part(box(0.55, 0.95, 0.04), g, 0, 0.48, -fz, M.soft);
    return g;
  };
  B.tower = () => {
    const g = new THREE.Group();
    const Ht = 8.2, r = y => 0.16 + 1.9 * Math.pow(1 - y / Ht, 2.4);
    const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
    corners.forEach(([sx, sz]) => {
      const pts = [];
      for (let i = 0; i <= 24; i++) { const y = (i / 24) * (Ht - 0.4); pts.push(new THREE.Vector3(sx * r(y), y, sz * r(y))); }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.07, 6), M.blue));
    });
    const brace = [], levels = [0.8, 1.6, 2.6, 3.6, 4.6, 5.6, 6.5, 7.3];
    for (let i = 0; i < levels.length - 1; i++) {
      const y0 = levels[i], y1 = levels[i + 1];
      for (let c = 0; c < 4; c++) {
        const [ax, az] = corners[c], [bx, bz] = corners[(c + 1) % 4];
        brace.push(ax * r(y0), y0, az * r(y0), bx * r(y1), y1, bz * r(y1), bx * r(y0), y0, bz * r(y0), ax * r(y1), y1, az * r(y1));
      }
    }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(brace, 3));
    g.add(new THREE.LineSegments(bg, M.line));
    for (let c = 0; c < 4; c++) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.06, 6, 24, Math.PI), M.blue);
      const a = c * Math.PI / 2;
      arch.position.set(Math.sin(a) * 1.55, 0.05, Math.cos(a) * 1.55); arch.rotation.y = a; arch.scale.y = 1.1;
      g.add(arch);
    }
    [[1.15, 1.22], [3.3, 0.62], [6.5, 0.32]].forEach(([y, s]) => { part(box(s * 2.4, 0.16, s * 2.4), g, 0, y, 0); part(box(s * 2.6, 0.06, s * 2.6), g, 0, y + 0.26, 0); });
    part(new THREE.CylinderGeometry(0.1, 0.22, 0.6, 6), g, 0, Ht - 0.2, 0);
    bar(g, 0.06, 1.1, 0.06, 0, Ht + 0.6, 0);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), M.lamp); tip.position.y = Ht + 1.2; g.add(tip);
    return g;
  };
  B.storeBox = () => {
    const g = new THREE.Group();
    const W = 2.2, D = 1.7, H = 1.3;
    part(box(W, H, D), g, 0, H / 2, 0);
    const pivot = new THREE.Group(); pivot.position.set(0, H, -D / 2 - 0.06); g.add(pivot);
    part(box(W + 0.14, 0.42, D + 0.12), pivot, 0, 0, D / 2 + 0.06);
    bar(g, 0.55, 0.07, 0.04, -0.45, H - 0.38, D / 2 + 0.02);
    const phase = Math.random() * 6;
    g.userData.tick = t => { const s = Math.max(0, Math.sin(t * 0.9 + phase)); pivot.rotation.x = -Math.pow(s, 6) * 0.75; };
    return g;
  };
  B.tripleGable = () => {
    const g = new THREE.Group();
    const D = 2.2;
    part(box(2.3, 2.6, D), g, 0, 1.3, 0);
    part(gable(2.7, 1.3, D + 0.2), g, 0, 2.6, 0);
    [-1, 1].forEach(s => { part(box(1.9, 1.6, D - 0.3), g, s * 2.1, 0.8, -0.15); part(gable(2.2, 0.95, D - 0.1), g, s * 2.1, 1.6, -0.15); });
    const fz = D / 2 + 0.03;
    windowOn(g, 0.62, 0.62, -0.5, 2.0, fz); windowOn(g, 0.62, 0.62, 0.5, 2.0, fz);
    const s = new THREE.Shape();
    s.moveTo(-0.32, 0); s.lineTo(-0.32, 0.6); s.absarc(0, 0.6, 0.32, Math.PI, 0, true); s.lineTo(0.32, 0); s.closePath();
    part(new THREE.ShapeGeometry(s, 16), g, 0, 0.02, fz + 0.01, M.soft);
    const wfz = (D - 0.3) / 2 - 0.15 + 0.03;
    part(box(1.05, 1.05, 0.05), g, -2.1, 0.55, wfz, M.soft);
    for (let i = 1; i < 4; i++) bar(g, 1.05, 0.03, 0.07, -2.1, 0.03 + i * 0.26, wfz);
    windowOn(g, 0.95, 0.55, 2.1, 0.85, wfz);
    return g;
  };
  B.castle = () => {
    const g = new THREE.Group();
    const D = 2.2;
    part(box(3.4, 2.0, D), g, 0, 1.0, 0);
    part(box(3.0, 0.45, D - 0.2), g, 0, 2.22, 0);
    part(gable(3.6, 1.0, D + 0.1), g, 0, 2.45, 0);
    [-1, 1].forEach(s => {
      const t = part(box(1.4, 3.6, 1.4), g, s * 2.4, 1.8, 0);
      [-0.55, 0, 0.55].forEach(a => { part(box(0.3, 0.38, 0.3), t, a, 1.99, 0.55); part(box(0.3, 0.38, 0.3), t, a, 1.99, -0.55); });
      part(box(0.3, 0.38, 0.3), t, 0.55, 1.99, 0); part(box(0.3, 0.38, 0.3), t, -0.55, 1.99, 0);
      bar(t, 1.44, 0.06, 1.44, 0, -1.2, 0);
    });
    const fz = D / 2 + 0.03;
    part(box(1.3, 1.15, 0.05), g, 0, 0.6, fz, M.soft);
    for (let i = 0; i < 6; i++) bar(g, 0.05, 1.15, 0.08, -0.55 + i * 0.22, 0.6, fz);
    for (let j = 0; j < 4; j++) bar(g, 1.3, 0.05, 0.08, 0, 0.2 + j * 0.27, fz);
    bar(g, 0.08, 1.6, 0.08, 0, 4.25, 0);
    const fg = new THREE.PlaneGeometry(1.1, 0.5, 12, 3); fg.translate(0.55, 0, 0);
    const flag = new THREE.Mesh(fg, M.flag); flag.position.set(0.03, 4.75, 0); g.add(flag);
    const base = fg.attributes.position.array.slice();
    g.userData.tick = t => {
      const pos = fg.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1];
        pos.array[i * 3 + 2] = Math.sin(x * 5 - t * 5) * 0.12 * x;
        pos.array[i * 3 + 1] = y + Math.sin(x * 4 - t * 3) * 0.04 * x;
      }
      pos.needsUpdate = true;
    };
    return g;
  };

  // scale so each model fits its footprint in BV.Grid.MODEL_FP
  const SCALE = { cottage: 0.62, greenhouse: 0.75, tower: 0.62, storeBox: 0.8, tripleGable: 0.5, castle: 0.48 };
  const NAMES = { cottage: '오두막', greenhouse: '온실', tower: '전망탑', storeBox: '상자 창고', tripleGable: '세 지붕 집', castle: '작은 성' };

  function model(ref) {
    const inner = (B[ref] || B.cottage)();
    inner.scale.setScalar(SCALE[ref] || 0.6);
    const g = new THREE.Group(); g.add(inner);
    g.userData.tick = inner.userData.tick;
    return g;
  }

  // decorations: 1x1 cell
  const DECO = {
    tree: () => { const g = new THREE.Group(); part(new THREE.CylinderGeometry(0.06, 0.08, 0.4, 6), g, 0, 0.2, 0); part(new THREE.ConeGeometry(0.38, 0.95, 6), g, 0, 0.85, 0, M.soft); g.rotation.y = Math.random() * 6; return g; },
    roundTree: () => { const g = new THREE.Group(); part(new THREE.CylinderGeometry(0.06, 0.08, 0.4, 6), g, 0, 0.2, 0); part(new THREE.IcosahedronGeometry(0.38, 0), g, 0, 0.72, 0, M.soft); g.rotation.y = Math.random() * 6; return g; },
    bush: () => { const g = new THREE.Group(); [[0, 0.16, 0, 0.22], [0.2, 0.12, 0.08, 0.16], [-0.2, 0.12, -0.05, 0.16]].forEach(([x, y, z, r]) => part(new THREE.IcosahedronGeometry(r, 0), g, x, y, z, M.soft)); return g; },
    lamp: () => {
      const g = new THREE.Group();
      bar(g, 0.06, 1.2, 0.06, 0, 0.6, 0);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), M.lamp); bulb.position.y = 1.28; g.add(bulb);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.SphereGeometry(0.12, 6, 4)), M.line); e.position.y = 1.28; g.add(e);
      // light pool on the ground at night (not tappable: flagged like smoke so picking skips it)
      const pool = new THREE.Mesh(new THREE.CircleGeometry(1.25, 32), M.glow);
      pool.rotation.x = -Math.PI / 2; pool.position.y = 0.03; pool.renderOrder = 2; pool.userData.smoke = true; g.add(pool);
      return g;
    },
    fence: () => {
      const g = new THREE.Group();
      [-0.4, 0, 0.4].forEach(x => part(box(0.07, 0.42, 0.07), g, x, 0.21, 0));
      part(box(0.95, 0.06, 0.04), g, 0, 0.3, 0); part(box(0.95, 0.06, 0.04), g, 0, 0.14, 0);
      return g;
    },
  };
  const DECO_NAMES = { tree: '뾰족 나무', roundTree: '둥근 나무', bush: '덤불', lamp: '가로등', fence: '울타리' };
  function deco(ref) { return (DECO[ref] || DECO.tree)(); }

  root.BV = root.BV || {};
  // ---- rainbow paint: one shared material per colour and surface kind, darkened at night like the rest
  const PALETTE = [
    { name: '빨강', hex: 0xff6b6b }, { name: '주황', hex: 0xffa94d }, { name: '노랑', hex: 0xffd43b }, { name: '초록', hex: 0x69db7c },
    { name: '하늘', hex: 0x4dabf7 }, { name: '남색', hex: 0x5c7cfa }, { name: '보라', hex: 0xb197fc }, { name: '분홍', hex: 0xf783ac },
  ];
  // colour codes: 0..7 = the first rainbow set (kept for old saves); 100..355 = 16 hues x 16 tones
  const HUE_NAMES = ['빨강', '주황', '귤색', '노랑', '연두', '초록', '청록', '하늘빛', '하늘', '파랑', '남색', '보라', '자주', '분홍', '장미', '회색'];
  const code = (hue, tone) => 100 + hue * 16 + tone;
  function colorHex(c) {
    if (c >= 0 && c < PALETTE.length) return PALETTE[c].hex;
    const hue = Math.floor((c - 100) / 16), tone = (c - 100) % 16;
    const col = new THREE.Color().setHSL(hue === 15 ? 0 : hue * 24 / 360, hue === 15 ? 0 : 0.78, 0.94 - tone * 0.76 / 15);
    return col.getHex();
  }
  function colorName(c) {
    if (c >= 0 && c < PALETTE.length) return PALETTE[c].name;
    const hue = Math.floor((c - 100) / 16), tone = (c - 100) % 16;
    return (tone < 5 ? '연한 ' : tone > 10 ? '진한 ' : '') + HUE_NAMES[hue];
  }
  const validColor = c => Number.isInteger(c) && ((c >= 0 && c < PALETTE.length) || (c >= 100 && c < 356));
  const paintMats = {};
  let paintNightT = 0;
  function paintNightColor(day, base) {
    // painted windows keep their own colour and glow at night; walls and roofs darken
    return base === 'win' ? day.clone().lerp(new THREE.Color(0xffffff), 0.2) : day.clone().multiplyScalar(0.62).lerp(NIGHT.fill, 0.2);
  }
  function paintMat(ci, base) {
    const key = ci + ':' + base;
    if (paintMats[key]) return paintMats[key].mat;
    const day = C(colorHex(ci));
    const opt = { color: day.clone(), ...off };
    const mat = base === 'win' ? new THREE.MeshBasicMaterial(opt) : new THREE.MeshLambertMaterial({ ...opt, side: base === 'soft' ? THREE.DoubleSide : THREE.FrontSide });
    paintMats[key] = { mat, day, night: paintNightColor(day, base) };
    mat.color.copy(day).lerp(paintMats[key].night, paintNightT);
    return mat;
  }
  function setPaintNight(t) {
    paintNightT = t;
    M.glow.opacity = t;
    Object.values(paintMats).forEach(p => p.mat.color.copy(p.day).lerp(p.night, t));
  }
  // which shared material a mesh started with decides whether (and how) it can be painted
  function paintBaseOf(mat) { return mat === M.fill ? 'fill' : mat === M.soft ? 'soft' : mat === M.win ? 'win' : null; }

  // ---- photo statue: pedestal + board, with the line drawing on both faces (lines follow the blue line colour)
  const statueTex = {};
  function statue(ref, rec) {
    const g = new THREE.Group();
    part(box(1.3, 0.28, 1.3), g, 0, 0.14, 0);
    part(box(1.0, 0.14, 1.0), g, 0, 0.35, 0, M.soft);
    if (!rec) return g;
    const aspect = rec.w / rec.h;
    let H = 1.5, W = H * aspect;
    if (W > 1.8) { W = 1.8; H = W / aspect; }
    const y = 0.42 + H / 2 + 0.06;
    part(box(W + 0.14, H + 0.14, 0.06), g, 0, y, 0);
    let tex = statueTex[ref];
    if (!tex) {
      tex = statueTex[ref] = new THREE.Texture();
      const im = new Image(); im.onload = () => { tex.image = im; tex.needsUpdate = true; }; im.src = rec.mask;
    }
    const mat = new THREE.MeshBasicMaterial({ alphaMap: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    mat.color = M.flag.color; // shared colour object: day/night changes reach the statue too
    [0.036, -0.036].forEach((z, i) => {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat);
      pl.position.set(0, y, z); if (i) pl.rotation.y = Math.PI; g.add(pl);
    });
    g.scale.setScalar(1.25);
    return g;
  }

  root.BV.Models = { statue, PALETTE, HUE_NAMES, code, colorHex, colorName, validColor, paintMat, setPaintNight, paintBaseOf, DAY, NIGHT, M, part, box, bar, gable, hipRoof, windowOn, leaf, addSmoke, model, deco, NAMES, DECO_NAMES, MODEL_REFS: Object.keys(NAMES), DECO_REFS: Object.keys(DECO) };
})(this);
