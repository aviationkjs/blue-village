// Landmarks and village shops, in the blue-outline style. Browser only (needs THREE and BV.Models).
// Built in grid units (1 = one cell) around the footprint centre; the front faces +z.
// userData.tick(t, dt, night) animates; userData.react() is called when tapped in the appreciate view.
(function (root) {
  const Mo = root.BV.Models;
  const { M, part, box, bar, gable, hipRoof, windowOn, addSmoke, paintMat, code } = Mo;
  const col = (hue, tone, base = 'fill') => paintMat(code(hue, tone), base);
  const sound = (name) => { const S = root.BV.Sound; if (S && S[name]) S[name](); };
  const cyl = (rt, rb, h, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);
  function archShape(w, h) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(-w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, Math.PI, 0, true); s.lineTo(w / 2, 0); s.closePath();
    return new THREE.ShapeGeometry(s, 12);
  }
  const archDoor = (g, w, h, x, y, z, mat = M.soft) => part(archShape(w, h), g, x, y, z, mat);
  function ring(r, tube, mat = M.blue, arc = Math.PI * 2) { return new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 32, arc), mat); }
  // a short upturned eave tip, for east-asian roofs
  function eaveTips(g, w, d, y) {
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => { const t = bar(g, 0.18, 0.05, 0.05, a * w / 2, y, b * d / 2); t.rotation.z = a * 0.7; });
  }
  function glowMat() {
    return new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  }

  const L = {};

  // 1. windmill: sails turn; a tap makes them spin fast for a while
  L.windmill = () => {
    const g = new THREE.Group();
    part(cyl(0.5, 0.75, 2.3, 8), g, 0, 1.15, 0);
    part(new THREE.ConeGeometry(0.66, 0.75, 8), g, 0, 2.67, 0, M.soft);
    archDoor(g, 0.34, 0.6, 0, 0, 0.73);
    windowOn(g, 0.22, 0.22, 0, 1.25, 0.67); windowOn(g, 0.2, 0.2, 0, 1.85, 0.6);
    const hub = new THREE.Group(); hub.position.set(0, 2.15, 0.66); g.add(hub);
    part(cyl(0.09, 0.09, 0.2, 10), hub, 0, 0, 0).rotation.x = Math.PI / 2;
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2; hub.add(arm);
      bar(arm, 0.05, 1.25, 0.05, 0, 0.62, 0.06);
      const sail = part(box(0.32, 0.85, 0.02), arm, 0.19, 0.75, 0.07, M.soft);
      for (let k = 1; k < 4; k++) bar(sail, 0.32, 0.015, 0.03, 0, -0.425 + k * 0.21, 0);
    }
    let boost = 0;
    g.userData.tick = (t, dt) => { boost = Math.max(0, boost - dt * 0.5); hub.rotation.z -= dt * (0.5 + boost * 3); };
    g.userData.react = () => { boost = 1.6; sound('whoosh'); };
    return g;
  };

  // 2. lighthouse: the lamp beam sweeps; brighter at night
  L.lighthouse = () => {
    const g = new THREE.Group();
    part(box(1.1, 0.6, 0.8), g, 0.35, 0.3, -0.45); part(gable(1.25, 0.4, 0.95), g, 0.35, 0.6, -0.45, M.soft);
    const H = [0, 0.65, 1.3, 1.95, 2.6];
    for (let i = 0; i < 4; i++) {
      const r0 = 0.55 - i * 0.05, r1 = 0.55 - (i + 1) * 0.05;
      part(cyl(r1, r0, 0.65, 14), g, 0, H[i] + 0.325, 0.1, i % 2 ? col(0, 5) : M.fill);
    }
    part(cyl(0.48, 0.48, 0.08, 16), g, 0, 2.64, 0.1);
    const rail = ring(0.46, 0.02); rail.rotation.x = Math.PI / 2; rail.position.set(0, 2.85, 0.1); g.add(rail);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; bar(g, 0.02, 0.2, 0.02, Math.cos(a) * 0.46, 2.76, 0.1 + Math.sin(a) * 0.46); }
    part(cyl(0.28, 0.28, 0.45, 12), g, 0, 2.9, 0.1, M.win);
    part(new THREE.SphereGeometry(0.32, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), g, 0, 3.12, 0.1, M.soft);
    bar(g, 0.03, 0.25, 0.03, 0, 3.55, 0.1);
    archDoor(g, 0.26, 0.5, 0, 0, 0.66);
    windowOn(g, 0.16, 0.18, 0, 1.6, 0.57);
    const beamMat = glowMat();
    const beam = new THREE.Group(); beam.position.set(0, 2.9, 0.1); g.add(beam);
    [1, -1].forEach(s => {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.55, 4, 16, 1, true), beamMat);
      c.rotation.z = s * Math.PI / 2; c.position.x = -s * 2.1; c.userData.smoke = true; beam.add(c);
    });
    let flash = 0;
    g.userData.tick = (t, dt, night) => {
      flash = Math.max(0, flash - dt);
      beam.rotation.y += dt * (0.9 + flash * 3);
      beamMat.opacity = 0.04 + night * 0.4 + flash * 0.3;
    };
    g.userData.react = () => { flash = 1.5; sound('chime'); };
    return g;
  };

  // 3. clock tower: the hands follow the real time; a tap rings the bell
  function clockFace(parent, r) {
    const f = new THREE.Group(); parent.add(f);
    part(new THREE.CircleGeometry(r, 24), f, 0, 0, 0, M.win);
    const rim = ring(r, 0.03); f.add(rim);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; bar(f, 0.03, i % 3 ? 0.04 : 0.08, 0.02, Math.sin(a) * r * 0.82, Math.cos(a) * r * 0.82, 0.01).rotation.z = -a; }
    const hour = new THREE.Group(), minute = new THREE.Group(); f.add(hour, minute);
    bar(hour, 0.045, r * 0.5, 0.02, 0, r * 0.25, 0.02); bar(minute, 0.03, r * 0.78, 0.02, 0, r * 0.39, 0.03);
    return { f, hour, minute };
  }
  L.clockTower = () => {
    const g = new THREE.Group();
    part(box(1.5, 0.35, 1.5), g, 0, 0.175, 0);
    part(box(1.1, 3.3, 1.1), g, 0, 2.0, 0);
    part(box(1.3, 0.12, 1.3), g, 0, 3.7, 0);
    const roof = part(new THREE.ConeGeometry(0.98, 1.05, 4), g, 0, 4.28, 0, M.soft); roof.rotation.y = Math.PI / 4;
    bar(g, 0.04, 0.45, 0.04, 0, 5.0, 0);
    archDoor(g, 0.36, 0.7, 0, 0.35, 0.56);
    [1.4, 2.1].forEach(y => windowOn(g, 0.2, 0.3, 0, y, 0.56));
    const faces = [0, 1, 2, 3].map(i => {
      const holder = new THREE.Group(); holder.rotation.y = i * Math.PI / 2; g.add(holder);
      const c = clockFace(holder, 0.38); c.f.position.set(0, 3.05, 0.56);
      return c;
    });
    const bell = new THREE.Group(); bell.position.set(0, 3.95, 0); g.add(bell);
    const bm = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.22, 12, 1, true), M.lamp); bm.position.y = -0.12; bell.add(bm);
    let swing = 0;
    g.userData.tick = (t, dt) => {
      const d = new Date(), m = d.getMinutes() + d.getSeconds() / 60, h = (d.getHours() % 12) + m / 60;
      faces.forEach(c => { c.minute.rotation.z = -m / 60 * Math.PI * 2; c.hour.rotation.z = -h / 12 * Math.PI * 2; });
      swing = Math.max(0, swing - dt * 0.4); bell.rotation.z = Math.sin(t * 7) * 0.5 * swing;
    };
    g.userData.react = () => { swing = 1; sound('bell'); };
    return g;
  };

  // 4. ferris wheel: turns slowly, the cabins stay level
  L.ferrisWheel = () => {
    const g = new THREE.Group();
    const R = 1.2, cy = 1.55;
    part(box(2.6, 0.1, 1.5), g, 0, 0.05, 0);
    [-0.35, 0.35].forEach(z => [-1, 1].forEach(s => {
      const L1 = Math.hypot(0.9, cy), b = bar(g, 0.07, L1, 0.07, s * 0.45, cy / 2, z); b.rotation.z = s * Math.atan2(0.9, cy);
    }));
    bar(g, 0.08, 0.08, 0.9, 0, cy, 0);
    const wheel = new THREE.Group(); wheel.position.set(0, cy, 0); g.add(wheel);
    [-0.3, 0.3].forEach(z => { const r = ring(R, 0.035); r.position.z = z; wheel.add(r); const r2 = ring(R * 0.45, 0.02); r2.position.z = z; wheel.add(r2); });
    const cabins = [];
    const hues = [0, 1, 3, 5, 8, 11, 13, 9];
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      [-0.3, 0.3].forEach(z => { const s = bar(wheel, 0.025, R, 0.025, Math.cos(a) * R / 2, Math.sin(a) * R / 2, z); s.rotation.z = a - Math.PI / 2; });
      bar(wheel, 0.03, 0.03, 0.62, Math.cos(a) * R, Math.sin(a) * R, 0);
      const cab = new THREE.Group(); cab.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); wheel.add(cab);
      part(box(0.3, 0.26, 0.3), cab, 0, -0.2, 0, col(hues[i], 4, 'soft'));
      part(box(0.34, 0.04, 0.34), cab, 0, -0.05, 0);
      cabins.push(cab);
    }
    let boost = 0;
    g.userData.tick = (t, dt) => {
      boost = Math.max(0, boost - dt * 0.4);
      wheel.rotation.z += dt * (0.18 + boost);
      cabins.forEach((c, i) => { c.rotation.z = -wheel.rotation.z + Math.sin(t * 1.3 + i) * 0.06; });
    };
    g.userData.react = () => { boost = 0.9; sound('chime'); };
    return g;
  };

  // 5. water wheel mill: the wheel turns under a little falling stream
  L.waterwheel = () => {
    const g = new THREE.Group();
    part(box(1.4, 1.1, 1.3), g, -0.55, 0.55, 0); part(gable(1.6, 0.7, 1.5), g, -0.55, 1.1, 0, M.soft);
    archDoor(g, 0.32, 0.55, -0.55, 0, 0.66); windowOn(g, 0.24, 0.24, -0.95, 0.75, 0.66);
    const stream = new THREE.Mesh(box(0.55, 0.05, 2.0), M.water); stream.position.set(0.85, 0.03, 0); g.add(stream);
    part(box(0.25, 0.12, 1.0), g, 0.85, 1.55, -0.55); // trough
    bar(g, 0.05, 1.5, 0.05, 0.85, 0.75, -1.0);
    const wheel = new THREE.Group(); wheel.position.set(0.85, 0.75, 0); g.add(wheel);
    [-0.2, 0.2].forEach(x => { const r = ring(0.62, 0.03); r.rotation.y = Math.PI / 2; r.position.x = x; wheel.add(r); });
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      const p = part(box(0.42, 0.04, 0.2), wheel, 0, Math.sin(a) * 0.62, Math.cos(a) * 0.62, M.soft); p.rotation.x = -a;
      const s = bar(wheel, 0.03, 0.6, 0.03, 0, Math.sin(a) * 0.3, Math.cos(a) * 0.3); s.rotation.x = -a + Math.PI / 2;
    }
    part(cyl(0.08, 0.08, 0.5, 10), wheel, 0, 0, 0).rotation.z = Math.PI / 2;
    const drops = [];
    for (let i = 0; i < 10; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), M.water); d.userData.smoke = true; g.add(d); drops.push({ d, t: i / 10 }); }
    g.userData.tick = (t, dt) => {
      wheel.rotation.x -= dt * 0.7;
      drops.forEach(o => { o.t = (o.t + dt * 0.9) % 1; o.d.position.set(0.85 + Math.sin(o.t * 9) * 0.05, 1.5 - o.t * 1.1, -0.1 - o.t * 0.15); });
    };
    g.userData.react = () => sound('splash');
    return g;
  };

  // 6. observatory: the dome turns, the telescope nods toward the stars at night
  L.observatory = () => {
    const g = new THREE.Group();
    part(box(2.4, 0.2, 2.4), g, 0, 0.1, 0);
    part(cyl(1.0, 1.05, 1.1, 20), g, 0, 0.75, 0);
    const dome = new THREE.Group(); dome.position.y = 1.3; g.add(dome);
    part(new THREE.SphereGeometry(1.0, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), dome, 0, 0, 0, M.soft);
    const slit = new THREE.Mesh(box(0.34, 0.06, 1.02), new THREE.MeshBasicMaterial({ color: 0x24365f })); slit.position.set(0, 0.98, 0.0); dome.add(slit);
    const slit2 = new THREE.Mesh(box(0.34, 0.9, 0.06), slit.material); slit2.position.set(0, 0.5, 0.86); slit2.rotation.x = -0.55; dome.add(slit2);
    const scope = new THREE.Group(); scope.position.set(0, 0.45, 0.2); dome.add(scope);
    part(cyl(0.11, 0.15, 1.2, 12), scope, 0, 0.55, 0);
    archDoor(g, 0.36, 0.62, 0, 0.2, 1.06);
    [-0.6, 0.6].forEach(x => windowOn(g, 0.2, 0.22, x, 0.8, 0.9));
    part(box(0.7, 0.1, 0.35), g, 0, 0.05, 1.3);
    g.userData.tick = (t, dt, night) => { dome.rotation.y += dt * 0.08; scope.rotation.x = 0.45 + Math.sin(t * 0.3) * 0.08 - night * 0.25; };
    g.userData.react = () => { dome.rotation.y += 0.6; sound('chime'); };
    return g;
  };

  // 7. station: platform, canopy, clock and a bench (the train runs on rail tiles)
  L.station = () => {
    const g = new THREE.Group();
    part(box(3.0, 0.22, 1.1), g, 0, 0.11, 0.42);
    bar(g, 3.0, 0.03, 0.06, 0, 0.23, 0.96);
    part(box(1.5, 1.0, 0.8), g, -0.5, 0.5, -0.55); part(hipRoof(1.75, 1.0, 0.45, 0.5), g, -0.5, 1.0, -0.55, M.soft);
    archDoor(g, 0.3, 0.55, -0.5, 0, -0.14); windowOn(g, 0.28, 0.24, -1.0, 0.55, -0.14); windowOn(g, 0.28, 0.24, 0.0, 0.55, -0.14);
    [-1.3, -0.1, 1.1].forEach(x => bar(g, 0.06, 1.2, 0.06, x, 0.82, 0.8));
    part(box(2.9, 0.06, 0.95), g, -0.05, 1.42, 0.4, M.soft);
    const c = clockFace(g, 0.18); c.f.position.set(0.5, 1.2, 0.85);
    part(box(0.6, 0.22, 0.04), g, 0.9, 1.3, -0.14, col(9, 6));
    const bench = Mo.deco('bench'); bench.position.set(0.7, 0.22, 0.45); bench.scale.setScalar(0.8); g.add(bench);
    g.userData.tick = () => { const d = new Date(), m = d.getMinutes() + d.getSeconds() / 60; c.minute.rotation.z = -m / 60 * Math.PI * 2; c.hour.rotation.z = -((d.getHours() % 12) + m / 60) / 12 * Math.PI * 2; };
    g.userData.react = () => sound('whistle');
    return g;
  };

  // 8. tree house: a little house in a big tree, with a rope ladder
  L.treehouse = () => {
    const g = new THREE.Group();
    part(cyl(0.22, 0.32, 2.2, 8), g, 0, 1.1, -0.1);
    [[-0.6, 2.55, -0.3, 0.6], [0.55, 2.6, -0.25, 0.55], [0, 2.95, -0.1, 0.65], [-0.2, 2.5, 0.45, 0.45]].forEach(([x, y, z, r]) => part(new THREE.IcosahedronGeometry(r, 0), g, x, y, z, M.soft));
    part(box(1.5, 0.08, 1.4), g, 0, 1.5, 0.05);
    part(box(0.9, 0.65, 0.75), g, 0, 1.87, 0.05); part(gable(1.05, 0.4, 0.9), g, 0, 2.2, 0.05, M.soft);
    windowOn(g, 0.2, 0.18, -0.2, 1.9, 0.44); archDoor(g, 0.2, 0.42, 0.2, 1.55, 0.44);
    [-0.7, 0.7].forEach(x => bar(g, 0.03, 0.22, 0.03, x, 1.65, 0.7)); bar(g, 1.45, 0.03, 0.03, 0, 1.76, 0.7);
    const lad = new THREE.Group(); lad.position.set(0.35, 1.5, 0.75); g.add(lad);
    [-0.12, 0.12].forEach(x => bar(lad, 0.02, 1.5, 0.02, x, -0.75, 0));
    for (let i = 1; i < 7; i++) bar(lad, 0.26, 0.03, 0.04, 0, -i * 0.21, 0);
    g.userData.tick = (t) => { lad.rotation.x = Math.sin(t * 1.1) * 0.06; };
    g.userData.react = () => sound('chime');
    return g;
  };

  // 9. pavilion (정자): raised floor, four posts, curved tiled roof
  L.pavilion = () => {
    const g = new THREE.Group();
    [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]].forEach(([x, z]) => { bar(g, 0.08, 0.45, 0.08, x, 0.22, z); part(cyl(0.06, 0.06, 1.1, 8), g, x, 1.0, z); });
    part(box(1.6, 0.1, 1.6), g, 0, 0.47, 0);
    [-1, 1].forEach(s => { bar(g, 1.25, 0.04, 0.04, 0, 0.72, s * 0.62); bar(g, 0.04, 0.04, 1.25, s * 0.62, 0.72, 0); });
    part(box(0.7, 0.1, 0.35), g, 0, 0.2, 0.95);
    part(box(1.55, 0.1, 1.55), g, 0, 1.58, 0);
    part(hipRoof(2.3, 2.3, 0.65, 0.95), g, 0, 1.63, 0, M.soft);
    bar(g, 0.5, 0.08, 0.08, 0, 2.3, 0);
    eaveTips(g, 2.3, 2.3, 1.7);
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), M.lamp); lantern.position.set(0, 1.35, 0); g.add(lantern);
    g.userData.react = () => sound('chime');
    return g;
  };

  // 10. church: bell tower with a swinging bell
  L.church = () => {
    const g = new THREE.Group();
    part(box(1.5, 1.35, 2.0), g, 0, 0.675, -0.45);
    part(gable(1.75, 0.9, 2.2), g, 0, 1.35, -0.45, M.soft);
    [-0.85, -0.1].forEach(z => [-1, 1].forEach(s => { const w = archDoor(g, 0.22, 0.5, s * 0.76, 0.5, z, M.win); w.rotation.y = s * Math.PI / 2; }));
    part(box(0.85, 2.3, 0.85), g, 0, 1.15, 0.85);
    const spire = part(new THREE.ConeGeometry(0.62, 1.15, 4), g, 0, 2.88, 0.85, M.soft); spire.rotation.y = Math.PI / 4;
    bar(g, 0.04, 0.5, 0.04, 0, 3.7, 0.85); bar(g, 0.26, 0.04, 0.04, 0, 3.75, 0.85);
    archDoor(g, 0.36, 0.7, 0, 0, 1.28);
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x24365f });
    const hole = new THREE.Mesh(archShape(0.42, 0.55), holeMat); hole.position.set(0, 1.6, 1.28); g.add(hole);
    const rose = new THREE.Mesh(new THREE.CircleGeometry(0.14, 16), M.win); rose.position.set(0, 1.25, 1.285); g.add(rose); g.add((() => { const r = ring(0.14, 0.02); r.position.set(0, 1.25, 1.29); return r; })());
    const bell = new THREE.Group(); bell.position.set(0, 2.1, 1.1); g.add(bell);
    const bm = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.22, 12, 1, true), M.lamp); bm.position.y = -0.14; bell.add(bm);
    let swing = 0, lastMin = -1;
    g.userData.tick = (t, dt) => {
      const m = new Date().getMinutes();
      if (lastMin !== -1 && m !== lastMin && m % 15 === 0) swing = 1;
      lastMin = m;
      swing = Math.max(0, swing - dt * 0.35);
      bell.rotation.x = Math.sin(t * 6) * 0.55 * swing;
    };
    g.userData.react = () => { swing = 1; sound('bell'); };
    return g;
  };

  // 11. hot-air balloon: floats up and down over its basket pad; a tap sends it higher
  L.balloon = () => {
    const g = new THREE.Group();
    part(cyl(0.85, 0.9, 0.08, 18), g, 0, 0.04, 0);
    [[-0.6, -0.6], [0.6, 0.6], [-0.6, 0.6], [0.6, -0.6]].forEach(([x, z]) => part(cyl(0.05, 0.07, 0.15, 6), g, x, 0.15, z));
    const b = new THREE.Group(); g.add(b);
    part(box(0.38, 0.3, 0.38), b, 0, 0.15, 0, col(1, 7));
    const env = part(new THREE.SphereGeometry(0.72, 16, 12), b, 0, 1.35, 0, col(1, 4, 'soft')); env.scale.set(1, 1.15, 1);
    for (let i = 0; i < 6; i++) { const r = ring(0.72, 0.012); r.rotation.y = i / 6 * Math.PI; r.position.y = 1.35; r.scale.set(1, 1.15, 1); b.add(r); }
    [[-0.17, -0.17], [0.17, 0.17], [-0.17, 0.17], [0.17, -0.17]].forEach(([x, z]) => {
      const pts = [new THREE.Vector3(x, 0.3, z), new THREE.Vector3(x * 2.4, 0.78, z * 2.4)];
      b.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), M.line));
    });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 8), col(2, 6)); flame.position.y = 0.45; flame.userData.smoke = true; b.add(flame);
    let lift = 0;
    g.userData.tick = (t, dt) => {
      lift = Math.max(0, lift - dt * 0.25);
      b.position.y = 0.55 + Math.sin(t * 0.5) * 0.3 + lift * 2;
      b.rotation.y = Math.sin(t * 0.2) * 0.3;
      flame.scale.setScalar(0.8 + Math.random() * 0.4);
    };
    g.userData.react = () => { lift = 1; sound('whoosh'); };
    return g;
  };

  // 12. village gate: pillars, an arch, a sign board and two lanterns
  L.gate = () => {
    const g = new THREE.Group();
    [-1.2, 1.2].forEach(x => {
      part(box(0.42, 2.0, 0.42), g, x, 1.0, 0);
      part(box(0.55, 0.12, 0.55), g, x, 2.06, 0);
      part(new THREE.ConeGeometry(0.36, 0.35, 4), g, x, 2.3, 0, M.soft).rotation.y = Math.PI / 4;
    });
    const arch = part(new THREE.TorusGeometry(1.2, 0.09, 8, 28, Math.PI), g, 0, 2.0, 0); arch.scale.y = 0.45;
    part(box(1.3, 0.38, 0.08), g, 0, 2.05, 0.06, M.soft);
    bar(g, 0.9, 0.04, 0.09, 0, 2.05, 0.1);
    const lan = [-0.75, 0.75].map(x => {
      const p = new THREE.Group(); p.position.set(x, 1.95, 0.1); g.add(p);
      bar(p, 0.015, 0.25, 0.015, 0, -0.12, 0);
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), M.lamp); l.position.y = -0.3; l.scale.y = 1.3; p.add(l);
      return p;
    });
    g.userData.tick = (t) => lan.forEach((p, i) => { p.rotation.z = Math.sin(t * 1.5 + i) * 0.12; });
    g.userData.react = () => sound('chime');
    return g;
  };

  // ---- shops: a small building with an awning and something telling what it sells
  function awning(g, w, y, z, hue) {
    const n = 6, sw = w / n;
    for (let i = 0; i < n; i++) {
      const s = part(box(sw, 0.03, 0.42), g, -w / 2 + sw * (i + 0.5), y, z, i % 2 ? M.soft : col(hue, 5, 'soft'));
      s.rotation.x = 0.45;
    }
  }
  function shopBody(g, { w = 1.7, h = 1.15, d = 1.3, roof = 'gable', hue = 0 } = {}) {
    part(box(w, h, d), g, 0, h / 2, -0.15);
    if (roof === 'gable') part(gable(w + 0.2, 0.6, d + 0.2), g, 0, h, -0.15, M.soft);
    else if (roof === 'hip') part(hipRoof(w + 0.2, d + 0.2, 0.5, 0.5), g, 0, h, -0.15, M.soft);
    else part(box(w + 0.12, 0.12, d + 0.12), g, 0, h + 0.06, -0.15, M.soft);
    const fz = d / 2 - 0.15 + 0.03;
    part(box(0.34, 0.62, 0.05), g, 0.45, 0.31, fz, M.soft);
    windowOn(g, 0.6, 0.42, -0.35, 0.5, fz);
    awning(g, w * 0.95, h * 0.82, fz + 0.18, hue);
    return fz;
  }
  function sign(g, w, y, z, hue) { return part(box(w, 0.26, 0.05), g, 0, y, z, col(hue, 3)); }

  const S = {};
  S.bakery = () => {
    const g = new THREE.Group();
    const fz = shopBody(g, { hue: 1 });
    part(box(0.24, 0.6, 0.24), g, 0.5, 1.45, -0.4);
    sign(g, 0.8, 1.32, fz + 0.03, 2);
    const bread = part(new THREE.TorusGeometry(0.07, 0.035, 6, 12), g, -0.12, 1.32, fz + 0.08, col(2, 8)); bread.scale.x = 1.5;
    part(new THREE.SphereGeometry(0.07, 8, 6), g, 0.15, 1.32, fz + 0.08, col(2, 9)).scale.set(1.6, 0.8, 0.8);
    g.userData.tick = addSmoke(g, 0.5, 1.85, -0.4);
    g.userData.react = () => Mo && sound('chime');
    return g;
  };
  S.flowerShop = () => {
    const g = new THREE.Group();
    const fz = shopBody(g, { roof: 'flat', hue: 13 });
    sign(g, 0.9, 1.33, fz, 5);
    [-0.6, -0.2, 0.2, 0.6].forEach((x, i) => {
      part(cyl(0.1, 0.08, 0.16, 8), g, x, 0.08, fz + 0.35, col(1, 9));
      [[0, 0], [0.06, 0.05], [-0.06, 0.04]].forEach(([dx, dz], k) => {
        bar(g, 0.015, 0.16, 0.015, x + dx, 0.22, fz + 0.35 + dz);
        const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.055, 0), col([13, 3, 0, 11][(i + k) % 4], 4)); f.position.set(x + dx, 0.32, fz + 0.35 + dz); g.add(f);
      });
    });
    g.userData.react = () => sound('chime');
    return g;
  };
  S.cafe = () => {
    const g = new THREE.Group();
    const fz = shopBody(g, { hue: 5 });
    sign(g, 0.8, 1.3, fz, 6);
    part(cyl(0.08, 0.06, 0.12, 10), g, 0, 1.32, fz + 0.06, M.fill);
    const table = new THREE.Group(); table.position.set(0.05, 0, fz + 0.55); g.add(table);
    part(cyl(0.2, 0.2, 0.04, 12), table, 0, 0.36, 0); bar(table, 0.03, 0.36, 0.03, 0, 0.18, 0);
    bar(table, 0.025, 0.9, 0.025, 0, 0.75, 0);
    part(new THREE.ConeGeometry(0.42, 0.25, 8, 1, true), table, 0, 1.2, 0, col(5, 4, 'soft'));
    [-0.32, 0.32].forEach(x => { part(box(0.16, 0.03, 0.16), table, x, 0.24, 0); bar(table, 0.02, 0.24, 0.02, x, 0.12, 0); part(box(0.16, 0.16, 0.02), table, x, 0.33, -0.08); });
    g.userData.react = () => sound('chime');
    return g;
  };
  S.bookstore = () => {
    const g = new THREE.Group();
    const fz = shopBody(g, { h: 1.6, hue: 10, roof: 'hip' });
    windowOn(g, 0.3, 0.3, -0.4, 1.2, fz); windowOn(g, 0.3, 0.3, 0.4, 1.2, fz);
    [0, 5, 8, 1, 11].forEach((h, i) => part(box(0.07, 0.2 + (i % 2) * 0.05, 0.12), g, -0.55 + i * 0.09, 0.42, fz + 0.04, col(h, 6)));
    const book = new THREE.Group(); book.position.set(0, 1.78, fz + 0.12); g.add(book);
    [-1, 1].forEach(s => { const p = part(box(0.22, 0.28, 0.02), book, s * 0.1, 0, 0, M.fill); p.rotation.y = -s * 0.35; });
    g.userData.react = () => sound('chime');
    return g;
  };
  S.postOffice = () => {
    const g = new THREE.Group();
    const fz = shopBody(g, { roof: 'hip', hue: 0 });
    sign(g, 0.8, 1.28, fz, 0);
    const mb = new THREE.Group(); mb.position.set(-0.65, 0, fz + 0.45); g.add(mb);
    part(cyl(0.14, 0.14, 0.55, 12), mb, 0, 0.32, 0, col(0, 6));
    part(new THREE.SphereGeometry(0.14, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mb, 0, 0.6, 0, col(0, 6));
    bar(mb, 0.16, 0.025, 0.02, 0, 0.42, 0.14);
    bar(g, 0.03, 1.6, 0.03, 0.8, 0.8, fz + 0.2);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.22), M.flag); fl.position.set(0.98, 1.45, fz + 0.2); g.add(fl);
    g.userData.tick = (t) => { fl.rotation.y = Math.sin(t * 2.5) * 0.4; };
    g.userData.react = () => sound('chime');
    return g;
  };
  S.iceCream = () => {
    const g = new THREE.Group();
    part(box(1.2, 0.6, 0.7), g, 0, 0.42, 0, col(13, 3));
    part(box(1.3, 0.06, 0.8), g, 0, 0.75, 0);
    [[-0.45, 0.3], [0.45, 0.3], [-0.45, -0.3], [0.45, -0.3]].forEach(([x, z]) => { const w = new THREE.Mesh(cyl(0.12, 0.12, 0.05, 12), M.blue); w.rotation.x = Math.PI / 2; w.position.set(x, 0.12, z + (z > 0 ? 0.06 : -0.06)); g.add(w); });
    bar(g, 0.03, 1.1, 0.03, 0, 1.3, 0);
    part(new THREE.ConeGeometry(0.75, 0.32, 10, 1, true), g, 0, 1.9, 0, col(8, 3, 'soft'));
    const cone = new THREE.Group(); cone.position.set(-0.5, 0.78, 0.15); g.add(cone);
    part(new THREE.ConeGeometry(0.1, 0.3, 10), cone, 0, 0.1, 0, col(2, 5)).rotation.x = Math.PI;
    part(new THREE.SphereGeometry(0.11, 10, 8), cone, 0, 0.3, 0, col(13, 4));
    part(new THREE.SphereGeometry(0.09, 10, 8), cone, 0, 0.45, 0, col(5, 3));
    g.userData.tick = (t) => { cone.rotation.y = t * 0.8; };
    g.userData.react = () => sound('chime');
    return g;
  };
  S.market = () => {
    const g = new THREE.Group();
    [-0.95, 0, 0.95].forEach((x, i) => {
      part(box(0.85, 0.08, 0.6), g, x, 0.5, 0.15);
      [[-0.38, -0.2], [0.38, -0.2], [-0.38, 0.4], [0.38, 0.4]].forEach(([dx, dz]) => bar(g, 0.04, dz < 0 ? 1.15 : 0.95, 0.04, x + dx, (dz < 0 ? 1.15 : 0.95) / 2, 0.15 + dz));
      const a = part(box(0.9, 0.04, 0.8), g, x, 1.08, 0.15, col([0, 5, 9][i], 4, 'soft')); a.rotation.x = 0.25;
      for (let k = 0; k < 5; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), col([0, 3, 1][i] + (k % 2), 5)); f.position.set(x - 0.25 + k * 0.12, 0.6, 0.18); g.add(f); }
      part(box(0.3, 0.2, 0.25), g, x + 0.2, 0.1, 0.65, col(2, 8));
    });
    g.userData.react = () => sound('chime');
    return g;
  };
  S.library = () => {
    const g = new THREE.Group();
    part(box(2.6, 1.3, 1.3), g, 0, 0.65, -0.25);
    part(gable(2.0, 0.55, 0.5), g, 0, 1.3, 0.55, M.soft);
    part(box(2.8, 0.1, 1.5), g, 0, 1.35, -0.25, M.soft);
    [0.55, 0.42, 0.29].forEach((z, i) => part(box(2.0 - i * 0.2, 0.08, 0.3), g, 0, 0.04 + i * 0.08, z + 0.25));
    [-0.75, -0.25, 0.25, 0.75].forEach(x => part(cyl(0.07, 0.07, 1.2, 10), g, x, 0.85, 0.55));
    part(box(2.0, 0.1, 0.5), g, 0, 1.3, 0.55);
    const r = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), M.win); r.position.set(0, 1.5, 0.81); g.add(r);
    archDoor(g, 0.36, 0.66, 0, 0.25, 0.41);
    [-1.0, 1.0].forEach(x => windowOn(g, 0.3, 0.42, x, 0.7, 0.41));
    g.userData.react = () => sound('chime');
    return g;
  };

  const NAMES = {
    windmill: '풍차', lighthouse: '등대', clockTower: '시계탑', ferrisWheel: '관람차', waterwheel: '물레방아', observatory: '천문대',
    station: '기차역', treehouse: '트리하우스', pavilion: '정자', church: '종탑 교회', balloon: '열기구', gate: '마을 대문',
    bakery: '빵집', flowerShop: '꽃집', cafe: '카페', bookstore: '책방', postOffice: '우체국', iceCream: '아이스크림', market: '시장', library: '도서관',
  };
  Object.entries({ ...L, ...S }).forEach(([ref, fn]) => Mo.register(ref, NAMES[ref], fn, 1));
})(this);
