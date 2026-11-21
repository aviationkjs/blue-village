// Theme park rides (about five houses tall) and park props. Browser only (needs THREE and BV.Models).
// Built in grid units around the footprint centre; front faces +z. Each ride has small riders,
// light bulbs that glow at night, its own ride cycle (tick) and a reaction when tapped in the appreciate view.
(function (root) {
  const Mo = root.BV.Models;
  const { M, part, box, bar, paintMat, code } = Mo;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const col = (hue, tone, base = 'fill') => paintMat(code(hue, tone), base);
  const cyl = (rt, rb, h, seg = 14) => new THREE.CylinderGeometry(rt, rb, h, seg);
  const sound = (...names) => { const S = root.BV.Sound; names.forEach(n => { if (S && S[n]) S[n](); }); };
  const smooth = x => x * x * (3 - 2 * x);
  const clamp01 = x => Math.max(0, Math.min(1, x));

  // ---- bulbs: shared coloured materials that brighten and twinkle at night
  const BULB_HEX = [0xff6b6b, 0xffd43b, 0x69db7c, 0x4dabf7, 0xb197fc, 0xf783ac];
  const BULBS = BULB_HEX.map(h => ({ m: new THREE.MeshBasicMaterial({ color: h }), base: new THREE.Color(h) }));
  const bulbGeo = new THREE.SphereGeometry(0.07, 8, 6);
  let bulbClock = -1, party = 0;
  function bulbTick(t, night, dt) {
    if (t === bulbClock) return; bulbClock = t;
    party = Math.max(0, party - (dt || 0) * 0.2);
    BULBS.forEach((b, i) => {
      const tw = 0.5 + 0.5 * Math.sin(t * (3 + party * 6) + i * 1.3);
      b.m.color.copy(b.base).multiplyScalar(0.55 + night * (0.3 + 0.35 * tw) + party * 0.4 * tw);
    });
  }
  function bulb(parent, x, y, z, i, s = 1) { const m = new THREE.Mesh(bulbGeo, BULBS[i % BULBS.length].m); m.position.set(x, y, z); m.scale.setScalar(s); parent.add(m); return m; }
  function bulbRing(parent, r, y, n, s = 1) { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; bulb(parent, Math.cos(a) * r, y, Math.sin(a) * r, i, s); } }

  // ---- riders: tiny seated people
  const SKIN = () => col(2, 1);
  function rider(parent, x, y, z, i) {
    const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g);
    const b = new THREE.Mesh(box(0.11, 0.13, 0.09), col([0, 8, 5, 11, 1, 13][i % 6], 4)); b.position.y = 0.065; g.add(b);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), SKIN()); h.position.y = 0.18; g.add(h);
    return g;
  }
  // a smooth closed track: centre curve plus two rails, ties and supports
  function track(parent, pts, { gauge = 0.15, railR = 0.045, tieEvery = 4, supportEvery = 14, samples = 360 } = {}) {
    const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
    const L = [], R = [], ties = [], sup = [];
    let side = V3(0, 0, 1);
    for (let i = 0; i < samples; i++) {
      const u = i / samples, p = curve.getPointAt(u), tg = curve.getTangentAt(u);
      const s = new THREE.Vector3().crossVectors(tg, V3(0, 1, 0)); if (s.length() > 0.25) side = s.normalize();
      L.push(p.clone().addScaledVector(side, gauge)); R.push(p.clone().addScaledVector(side, -gauge));
      if (i % tieEvery === 0) ties.push(L[i].x, L[i].y, L[i].z, R[i].x, R[i].y, R[i].z);
      if (i % supportEvery === 0 && p.y > 0.6) sup.push(p);
    }
    [L, R].forEach(list => parent.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(list, true), samples, railR, 5, true), M.blue)));
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(ties, 3)); parent.add(new THREE.LineSegments(tg, M.line));
    sup.forEach(p => { const h = p.y - 0.06; part(cyl(0.035, 0.05, h, 6), parent, p.x, h / 2, p.z); });
    return curve;
  }
  // a car on a curve, facing along it
  const X = V3(1, 0, 0);
  function placeOn(obj, curve, u, lift = 0.12) {
    const uu = ((u % 1) + 1) % 1, p = curve.getPointAt(uu), tg = curve.getTangentAt(uu);
    obj.position.set(p.x, p.y + lift, p.z);
    obj.quaternion.setFromUnitVectors(X, tg);
    return p;
  }

  const RIDES = {};

  // 1. roller coaster: lift hill to 9, a drop, a vertical loop, station stop
  RIDES.coaster = () => {
    const g = new THREE.Group();
    const pts = [[-2.6, 1.2, 0.6], [-1.6, 0.7, 1.15], [-0.6, 0.9, 1.2], [0.4, 2.0, 1.25], [0.6, 3.6, 1.3], [-0.3, 4.5, 1.35], [-1.1, 3.6, 1.4], [-0.9, 2.0, 1.45], [0.2, 0.9, 1.5],
      [1.4, 0.6, 1.55], [2.3, 0.6, 1.5], [2.8, 0.9, 0.6], [2.6, 1.6, -0.8], [1.8, 2.6, -1.5], [0.4, 5.2, -1.6], [-0.9, 8.0, -1.6], [-1.7, 9.0, -1.45], [-2.5, 8.1, -1.1], [-2.85, 4.6, -0.3], [-2.8, 2.2, 0.2]].map(a => V3(...a));
    const curve = track(g, pts);
    const len = curve.getLength();
    part(box(1.4, 0.4, 0.8), g, 1.85, 0.2, 1.6);
    [[1.2, 1.25], [2.5, 1.25], [1.2, 1.95], [2.5, 1.95]].forEach(([x, z]) => bar(g, 0.05, 1.3, 0.05, x, 0.85, z));
    part(box(1.6, 0.06, 1.0), g, 1.85, 1.52, 1.6, col(0, 4, 'soft'));
    for (let i = 0; i < 6; i++) bulb(g, 1.1 + i * 0.3, 1.47, 2.12, i);
    const cars = [0, 1, 2].map(k => {
      const c = new THREE.Group(); g.add(c);
      part(box(0.5, 0.2, 0.34), c, 0, 0.1, 0, col([0, 8, 3][k], 5));
      if (k === 0) part(new THREE.ConeGeometry(0.15, 0.25, 8), c, 0.33, 0.1, 0, col(0, 5)).rotation.z = -Math.PI / 2;
      [-0.1, 0.1].forEach((z, j) => rider(c, -0.05, 0.18, z, k * 2 + j));
      return c;
    });
    let u = 0, wait = 0, waited = false, rush = 0;
    g.userData.tick = (t, dt, night) => {
      bulbTick(t, night, dt);
      const p = curve.getPointAt(u), tg = curve.getTangentAt(u);
      const inStation = p.z > 1.3 && p.x > 1.2 && p.x < 2.4 && p.y < 0.9;
      const lift = p.z < -1.2 && tg.y > 0.15;
      if (inStation && !waited) { wait = rush ? 0 : 2.5; waited = true; }
      if (!inStation) waited = false;
      if (wait > 0) { wait -= dt; } else {
        const v = lift ? 1.3 : inStation ? 1.2 : 2.0 + Math.sqrt(Math.max(0, 2 * 9.8 * (9.2 - p.y))) * 0.55;
        u = (u + v * dt / len) % 1;
      }
      rush = Math.max(0, rush - dt * 0.1);
      cars.forEach((c, k) => placeOn(c, curve, u - k * 0.6 / len));
    };
    g.userData.react = () => { wait = 0; rush = 1; sound('cheer'); };
    return g;
  };

  // 2. drop tower: the ring of seats climbs to the top, waits, then falls
  RIDES.dropTower = () => {
    const g = new THREE.Group();
    part(box(1.7, 0.3, 1.7), g, 0, 0.15, 0);
    part(cyl(0.28, 0.34, 10.2), g, 0, 5.25, 0);
    for (let y = 1.2; y < 10; y += 1.1) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.02, 4, 16), M.blue); r.rotation.x = Math.PI / 2; r.position.y = y; g.add(r); }
    part(cyl(0.55, 0.42, 0.5), g, 0, 10.6, 0, col(0, 5, 'soft'));
    bar(g, 0.04, 0.8, 0.04, 0, 11.2, 0); bulb(g, 0, 11.65, 0, 0, 1.6);
    bulbRing(g, 0.56, 10.4, 12);
    const car = new THREE.Group(); g.add(car);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.09, 8, 24), col(3, 5)); ring.rotation.x = Math.PI / 2; car.add(ring);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, s = new THREE.Group(); s.position.set(Math.cos(a) * 0.68, 0, Math.sin(a) * 0.68); s.rotation.y = -a + Math.PI / 2; car.add(s);
      part(box(0.24, 0.3, 0.06), s, 0, 0.05, -0.08, col(8, 5)); rider(s, 0, -0.08, 0.02, i);
    }
    bulbRing(car, 0.55, 0.12, 8, 0.8);
    let ph = 0;
    const T = 15;
    g.userData.tick = (t, dt, night) => {
      bulbTick(t, night, dt);
      const before = ph; ph = (ph + dt) % T;
      let y;
      if (ph < 2) y = 0.55;
      else if (ph < 8) y = 0.55 + 8.6 * smooth((ph - 2) / 6);
      else if (ph < 9.6) y = 9.15;
      else if (ph < 10.4) { const k = (ph - 9.6) / 0.8; y = 9.15 - 8.3 * k * k; }
      else if (ph < 11.6) { const k = (ph - 10.4) / 1.2; y = 0.85 + Math.sin(k * Math.PI * 2) * 0.25 * (1 - k) - k * 0.3; }
      else y = 0.55;
      if (before < 9.6 && ph >= 9.6) sound('whoosh');
      car.position.y = y;
      car.rotation.y = t * 0.15;
    };
    g.userData.react = () => { if (ph < 8) ph = 8; sound('cheer'); };
    return g;
  };

  // 3. pirate ship: swings like a pendulum, higher and higher
  RIDES.viking = () => {
    const g = new THREE.Group();
    const PY = 7.4, ARM = 5.9;
    [-0.75, 0.75].forEach(z => [-1, 1].forEach(s => { const L = Math.hypot(1.7, PY); const b = part(cyl(0.07, 0.09, L, 8), g, s * 0.85, PY / 2, z); b.rotation.z = s * Math.atan2(1.7, PY); }));
    part(cyl(0.08, 0.08, 1.7, 10), g, 0, PY, 0).rotation.x = Math.PI / 2;
    const pivot = new THREE.Group(); pivot.position.y = PY; g.add(pivot);
    [-0.5, 0.5].forEach(z => [-1, 1].forEach(s => { const L = Math.hypot(1.2, ARM); const b = bar(pivot, 0.06, L, 0.06, s * 0.6, -ARM / 2, z); b.rotation.z = -s * Math.atan2(1.2, ARM); }));
    const hs = new THREE.Shape(); hs.moveTo(-1.9, 0.5); hs.quadraticCurveTo(0, -0.7, 1.9, 0.5); hs.lineTo(1.55, 0.62); hs.lineTo(-1.55, 0.62); hs.closePath();
    const hull = new THREE.ExtrudeGeometry(hs, { depth: 1.0, bevelEnabled: false, curveSegments: 16 }); hull.translate(0, 0, -0.5);
    part(hull, pivot, 0, -ARM - 0.5, 0, col(1, 7));
    bar(pivot, 3.1, 0.05, 1.02, 0, -ARM + 0.13, 0).material = col(2, 4);
    [-1, 1].forEach(s => { const h = part(new THREE.ConeGeometry(0.16, 0.7, 6), pivot, s * 1.85, -ARM + 0.25, 0, col(5, 6)); h.rotation.z = -s * 0.5; });
    for (let i = 0; i < 6; i++) [-0.25, 0.25].forEach((z, j) => rider(pivot, -1.1 + i * 0.44, -ARM + 0.1, z, i + j));
    bulbRing(g, 0.12, PY + 0.2, 4);
    let amp = 0.3, boost = 0;
    g.userData.tick = (t, dt, night) => {
      bulbTick(t, night, dt);
      boost = Math.max(0, boost - dt * 0.06);
      const cyc = 0.5 - 0.5 * Math.cos(t * Math.PI * 2 / 20);
      amp += ((0.2 + 0.85 * Math.max(cyc, boost)) - amp) * Math.min(1, dt * 0.5);
      pivot.rotation.z = Math.sin(t * 1.25) * amp;
    };
    g.userData.react = () => { boost = 1; sound('cheer'); };
    return g;
  };

  // 4. swing ride: the top rises and spins, the swings fly outward
  RIDES.swingRide = () => {
    const g = new THREE.Group();
    part(cyl(1.45, 1.5, 0.2, 24), g, 0, 0.1, 0);
    part(cyl(0.2, 0.28, 7.0), g, 0, 3.6, 0);
    const top = new THREE.Group(); g.add(top);
    part(new THREE.ConeGeometry(1.25, 0.75, 16), top, 0, 0.55, 0, col(13, 3, 'soft'));
    part(cyl(1.25, 1.25, 0.18, 24), top, 0, 0.1, 0, col(8, 3));
    bulbRing(top, 1.27, 0.12, 16);
    bar(g, 0.03, 0.9, 0.03, 0, 7.6, 0); bulb(g, 0, 8.1, 0, 1, 1.5);
    const swings = [];
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2, arm = new THREE.Group(); arm.rotation.y = a; top.add(arm);
      const hang = new THREE.Group(); hang.position.set(1.05, 0, 0); arm.add(hang);
      bar(hang, 0.012, 1.7, 0.012, 0, -0.85, 0.06); bar(hang, 0.012, 1.7, 0.012, 0, -0.85, -0.06);
      part(box(0.18, 0.04, 0.18), hang, 0, -1.72, 0, col([0, 3, 5, 8, 11, 13][i % 6], 5));
      rider(hang, 0, -1.7, 0, i);
      swings.push(hang);
    }
    let w = 0, spin = 0, hurry = 0;
    g.userData.tick = (t, dt, night) => {
      bulbTick(t, night, dt);
      hurry = Math.max(0, hurry - dt * 0.08);
      const cyc = Math.max(clamp01(Math.sin(t * Math.PI * 2 / 24) * 1.4), hurry);
      w += (cyc * 1.6 - w) * Math.min(1, dt * 0.6);
      spin += w * dt;
      top.rotation.y = spin;
      top.position.y = 5.0 + 1.7 * clamp01(w / 1.6);
      const th = Math.min(1.05, Math.atan(w * w * 1.05 / 9.8 * 3));
      swings.forEach(s => { s.rotation.z = th; });
    };
    g.userData.react = () => { hurry = 1; sound('cheer'); };
    return g;
  };

  // 5. giant wheel: 16 cabins, rim bulbs that run like a rainbow at night
  RIDES.bigWheel = () => {
    const g = new THREE.Group();
    const R = 3.9, cy = 4.7;
    part(box(3.8, 0.12, 1.8), g, 0, 0.06, 0);
    [-0.55, 0.55].forEach(z => [-1, 1].forEach(s => { const L = Math.hypot(1.8, cy); const b = part(cyl(0.07, 0.1, L, 8), g, s * 0.9, cy / 2, z); b.rotation.z = s * Math.atan2(1.8, cy); }));
    part(cyl(0.14, 0.14, 1.3, 12), g, 0, cy, 0).rotation.x = Math.PI / 2;
    const wheel = new THREE.Group(); wheel.position.y = cy; g.add(wheel);
    [-0.35, 0.35].forEach(z => { [R, R * 0.55].forEach(r => { const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r === R ? 0.05 : 0.03, 6, 64), M.blue); ring.position.z = z; wheel.add(ring); }); });
    for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2; bulb(wheel, Math.cos(a) * R, Math.sin(a) * R, 0.4, i); }
    const cabins = [];
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2;
      [-0.35, 0.35].forEach(z => { const s = bar(wheel, 0.025, R, 0.025, Math.cos(a) * R / 2, Math.sin(a) * R / 2, z); s.rotation.z = a - Math.PI / 2; });
      bar(wheel, 0.03, 0.03, 0.8, Math.cos(a) * R, Math.sin(a) * R, 0);
      const cab = new THREE.Group(); cab.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); wheel.add(cab);
      part(box(0.38, 0.34, 0.38), cab, 0, -0.3, 0, col([0, 1, 3, 5, 8, 9, 11, 13][i % 8], 4, 'soft'));
      part(box(0.44, 0.05, 0.44), cab, 0, -0.1, 0);
      rider(cab, 0, -0.43, 0, i);
      cabins.push(cab);
    }
    let fast = 0;
    g.userData.tick = (t, dt, night) => {
      bulbTick(t, night, dt);
      fast = Math.max(0, fast - dt * 0.15);
      wheel.rotation.z += dt * (0.09 + fast * 0.25);
      cabins.forEach((c, i) => { c.rotation.z = -wheel.rotation.z + Math.sin(t * 1.1 + i) * 0.05; });
    };
    g.userData.react = () => { fast = 1; party = 1; sound('musicBox'); };
    return g;
  };

  // 6. spinning space ride: a ring of pods spins and tilts up high
  RIDES.spaceRide = () => {
    const g = new THREE.Group();
    part(cyl(1.45, 1.5, 0.25, 24), g, 0, 0.12, 0);
    part(box(0.55, 6.6, 0.55), g, 0, 3.4, -0.2);
    part(box(0.9, 0.5, 0.9), g, 0, 6.8, -0.2);
    const tilt = new THREE.Group(); tilt.position.set(0, 6.8, -0.2); g.add(tilt);
    const spin = new THREE.Group(); tilt.add(spin);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.06, 6, 40), M.blue); ring.rotation.x = Math.PI / 2; spin.add(ring);
    part(cyl(0.3, 0.3, 0.25, 12), spin, 0, 0, 0, col(9, 5));
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      const s = bar(spin, 1.4, 0.04, 0.04, Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7); s.rotation.y = -a;
      const pod = new THREE.Group(); pod.position.set(Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5); pod.rotation.y = -a; spin.add(pod);
      const shell = part(new THREE.SphereGeometry(0.2, 10, 8), pod, 0, 0, 0, col([8, 11, 13, 5, 3][i % 5], 4)); shell.scale.set(1.2, 0.8, 1);
      rider(pod, 0, 0.02, 0, i);
      bulb(pod, 0.2, 0.12, 0, i, 0.8);
    }
    let w = 0, hurry = 0, a = 0;
    g.userData.tick = (t, dt, night) => {
      bulbTick(t, night, dt);
      hurry = Math.max(0, hurry - dt * 0.08);
      const cyc = Math.max(clamp01(Math.sin(t * Math.PI * 2 / 22) * 1.5), hurry);
      w += (cyc * 2.4 - w) * Math.min(1, dt * 0.5);
      a += w * dt; spin.rotation.y = a;
      tilt.rotation.x = 1.1 * clamp01(w / 2.4 - 0.25) * 1.3;
    };
    g.userData.react = () => { hurry = 1; sound('cheer'); };
    return g;
  };

  // 7. log flume: logs climb the lift, wind down and splash into the pool
  RIDES.logFlume = () => {
    const g = new THREE.Group();
    const pts = [[-1.8, 0.35, 1.0], [0.0, 0.35, 1.15], [1.6, 0.4, 0.9], [2.15, 1.0, 0.2], [2.15, 4.0, -0.5], [2.0, 7.4, -1.0], [1.1, 7.6, -1.2], [-0.4, 7.2, -1.2], [-1.9, 6.6, -0.8], [-2.15, 6.0, 0.0],
      [-1.2, 5.6, 0.25], [0.4, 5.2, 0.05], [0.95, 4.8, -0.55], [-0.3, 2.3, -0.5], [-1.5, 0.5, 0.0], [-2.2, 0.35, 0.55]].map(a => V3(...a));
    const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
    const N = 300, pos = [], idx = [], L = [], Rr = [];
    let side = V3(0, 0, 1);
    for (let i = 0; i < N; i++) {
      const u = i / N, p = curve.getPointAt(u), tg = curve.getTangentAt(u);
      const s = new THREE.Vector3().crossVectors(tg, V3(0, 1, 0)); if (s.length() > 0.25) side = s.normalize();
      const a = p.clone().addScaledVector(side, 0.24), b = p.clone().addScaledVector(side, -0.24);
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      L.push(a.clone().setY(a.y + 0.14)); Rr.push(b.clone().setY(b.y + 0.14));
      const j = i * 2, k = ((i + 1) % N) * 2; idx.push(j, j + 1, k, j + 1, k + 1, k);
      if (i % 15 === 0 && p.y > 0.6) part(cyl(0.05, 0.07, p.y - 0.05, 6), g, p.x, (p.y - 0.05) / 2, p.z);
    }
    const ribbon = new THREE.BufferGeometry(); ribbon.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ribbon.setIndex(idx); ribbon.computeVertexNormals();
    const wm = M.water.clone(); wm.side = THREE.DoubleSide; const water = new THREE.Mesh(ribbon, M.water); water.material = wm; g.add(water);
    g.userData.waterMat = wm;
    [L, Rr].forEach(list => g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(list, true), N, 0.05, 5, true), col(2, 9))));
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.95, 28), M.water); pool.rotation.x = -Math.PI / 2; pool.position.set(-1.0, 0.05, 0.55); g.add(pool);
    const tower = part(box(0.9, 0.5, 0.9), g, 1.7, 7.7, -1.1, col(5, 3, 'soft')); bulbRing(g, 0.6, 7.45, 10);
    void tower;
    const len = curve.getLength();
    const logs = [0, 1, 2].map(k => {
      const lg = new THREE.Group(); g.add(lg);
      part(box(0.6, 0.18, 0.3), lg, 0, 0.12, 0, col(2, 9));
      part(new THREE.ConeGeometry(0.12, 0.25, 8), lg, 0.38, 0.14, 0, col(2, 9)).rotation.z = -Math.PI / 2;
      rider(lg, -0.1, 0.2, 0, k * 2); rider(lg, 0.12, 0.2, 0, k * 2 + 1);
      return { lg, u: k / 3, prevY: 0 };
    });
    const drops = [];
    for (let i = 0; i < 18; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), M.water); d.userData.smoke = true; d.visible = false; g.add(d); drops.push({ d, v: V3(0, 0, 0), life: 0 }); }
    function splash(at) { drops.forEach(o => { o.life = 1; o.d.visible = true; o.d.position.copy(at); o.v.set((Math.random() - 0.5) * 2.4, 1.5 + Math.random() * 2.2, (Math.random() - 0.5) * 2.4); }); }
    let hurry = 0;
    g.userData.tick = (t, dt, night) => {
      bulbTick(t, night, dt);
      wm.color.copy(M.water.color); // follow day/night like the other water
      hurry = Math.max(0, hurry - dt * 0.15);
      logs.forEach(o => {
        const p = curve.getPointAt(o.u), tg = curve.getTangentAt(o.u);
        const lift = p.x > 1.8 && tg.y > 0.2;
        const v = lift ? 1.0 + hurry * 2 : 0.9 + Math.sqrt(Math.max(0, 2 * 9.8 * (7.6 - p.y))) * 0.45;
        o.u = (o.u + v * dt / len) % 1;
        const q = placeOn(o.lg, curve, o.u, 0.02);
        if (o.prevY > 1.2 && q.y <= 0.7) { splash(q); if (root.BV.Sound && o.loud) sound('splash'); o.loud = false; }
        o.prevY = q.y;
      });
      drops.forEach(o => { if (o.life <= 0) return; o.life -= dt * 0.9; o.v.y -= 9.8 * dt * 0.6; o.d.position.addScaledVector(o.v, dt); if (o.life <= 0 || o.d.position.y < 0) { o.d.visible = false; o.life = 0; } });
    };
    g.userData.react = () => { hurry = 1; logs.forEach(o => { o.loud = true; }); sound('cheer'); };
    return g;
  };

  // 8. observation tower: a round glass cabin rises up the column while turning
  RIDES.obsTower = () => {
    const g = new THREE.Group();
    part(cyl(0.9, 1.0, 0.3, 20), g, 0, 0.15, 0);
    part(cyl(0.2, 0.26, 11.2), g, 0, 5.9, 0);
    part(cyl(0.45, 0.3, 0.6, 16), g, 0, 11.6, 0, col(8, 4, 'soft'));
    bar(g, 0.03, 1.0, 0.03, 0, 12.4, 0); bulb(g, 0, 12.95, 0, 0, 1.6);
    bulbRing(g, 0.47, 11.35, 10);
    const cab = new THREE.Group(); g.add(cab);
    part(cyl(0.95, 0.95, 0.5, 24), cab, 0, 0, 0, M.win);
    part(cyl(1.02, 1.02, 0.07, 24), cab, 0, 0.28, 0); part(cyl(1.02, 1.02, 0.07, 24), cab, 0, -0.28, 0);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; rider(cab, Math.cos(a) * 0.7, -0.25, Math.sin(a) * 0.7, i); bar(cab, 0.03, 0.5, 0.03, Math.cos(a) * 0.96, 0, Math.sin(a) * 0.96); }
    bulbRing(cab, 1.03, 0.32, 16, 0.8);
    let ph = 0; const T = 26;
    g.userData.tick = (t, dt, night) => {
      bulbTick(t, night, dt);
      ph = (ph + dt) % T;
      const k = ph < 3 ? 0 : ph < 11 ? smooth((ph - 3) / 8) : ph < 16 ? 1 : ph < 24 ? 1 - smooth((ph - 16) / 8) : 0;
      cab.position.y = 0.6 + k * 9.6;
      cab.rotation.y = t * 0.25;
    };
    g.userData.react = () => { if (ph < 3 || ph > 16) ph = 3; sound('chime'); };
    return g;
  };

  // 9. carousel: horses bob as the platform turns; a tall spire with lights on top
  RIDES.carousel = () => {
    const g = new THREE.Group();
    part(cyl(1.5, 1.5, 0.12, 28), g, 0, 0.06, 0);
    const plat = new THREE.Group(); g.add(plat);
    part(cyl(1.4, 1.42, 0.16, 28), plat, 0, 0.2, 0, col(8, 2));
    part(cyl(0.28, 0.3, 2.3, 12), plat, 0, 1.4, 0, col(13, 3));
    part(cyl(1.5, 1.5, 0.22, 28), plat, 0, 2.6, 0, col(13, 3));
    part(new THREE.ConeGeometry(1.65, 1.0, 16), plat, 0, 3.2, 0, col(13, 4, 'soft'));
    bulbRing(plat, 1.52, 2.6, 20);
    const horses = [];
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, h = new THREE.Group(); h.position.set(Math.cos(a) * 1.05, 0, Math.sin(a) * 1.05); h.rotation.y = -a; plat.add(h);
      bar(h, 0.025, 2.3, 0.025, 0, 1.4, 0).material = col(3, 4);
      const body = new THREE.Group(); h.add(body);
      const c = col([0, 3, 8, 11, 13, 5, 1, 9][i], 1);
      part(box(0.14, 0.15, 0.42), body, 0, 0, 0, c);
      const neck = part(box(0.1, 0.24, 0.1), body, 0, 0.13, 0.2, c); neck.rotation.x = 0.4;
      part(box(0.1, 0.1, 0.2), body, 0, 0.25, 0.3, c);
      [[-0.05, 0.15], [0.05, 0.15], [-0.05, -0.15], [0.05, -0.15]].forEach(([x, z]) => bar(body, 0.03, 0.2, 0.03, x, -0.15, z));
      if (i % 2 === 0) rider(body, 0, 0.06, -0.02, i);
      horses.push({ body, ph: i * 0.8 });
    }
    // tall spire so the carousel stands with the other big rides
    part(cyl(0.06, 0.1, 4.2, 8), g, 0, 5.8, 0);
    [5.0, 6.4].forEach((y, k) => { part(cyl(0.45 - k * 0.12, 0.45 - k * 0.12, 0.08, 16), g, 0, y, 0, col(3, 4)); bulbRing(g, 0.47 - k * 0.12, y + 0.06, 10); });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), M.flag); flag.position.set(0.25, 7.7, 0); g.add(flag);
    let fast = 0;
    g.userData.tick = (t, dt, night) => {
      bulbTick(t, night, dt);
      fast = Math.max(0, fast - dt * 0.2);
      plat.rotation.y += dt * (0.45 + fast * 0.6);
      horses.forEach(o => { o.body.position.y = 0.85 + Math.sin(t * 2.4 + o.ph) * 0.18; });
      flag.rotation.y = Math.sin(t * 2) * 0.4;
    };
    g.userData.react = () => { fast = 1; sound('musicBox'); };
    return g;
  };

  // ---- park props
  function signTexture(text) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 512, 128);
    x.strokeStyle = '#3f7fe8'; x.lineWidth = 10; x.strokeRect(6, 6, 500, 116);
    x.fillStyle = '#3f7fe8'; x.font = 'bold 72px "Jua", "Gowun Dodum", "Malgun Gothic", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 256, 68);
    const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4;
    return tex;
  }
  RIDES.parkArch = () => {
    const g = new THREE.Group();
    [-1.7, 1.7].forEach((x, k) => {
      part(cyl(0.3, 0.36, 3.6, 12), g, x, 1.8, 0, col(8, 2));
      part(new THREE.ConeGeometry(0.42, 0.7, 12), g, x, 3.95, 0, col(0, 4, 'soft'));
      bar(g, 0.02, 0.4, 0.02, x, 4.45, 0);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.2), M.flag); f.position.set(x + 0.16, 4.55, 0); f.userData.flag = k; g.add(f);
    });
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.08, 8, 32, Math.PI), M.blue); arch.position.y = 2.9; arch.scale.y = 0.55; g.add(arch);
    for (let i = 0; i <= 14; i++) { const a = i / 14 * Math.PI; bulb(g, Math.cos(a) * 1.7, 2.9 + Math.sin(a) * 1.7 * 0.55, 0.08, i); }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.58), new THREE.MeshBasicMaterial({ map: signTexture('파란 선 랜드') }));
    sign.position.set(0, 3.45, 0.12); g.add(sign);
    const back = sign.clone(); back.rotation.y = Math.PI; back.position.z = 0.08; g.add(back);
    part(box(2.4, 0.66, 0.06), g, 0, 3.45, 0.1);
    g.userData.tick = (t, dt, night) => { bulbTick(t, night, dt); g.children.forEach(o => { if (o.userData.flag !== undefined) o.rotation.y = Math.sin(t * 2.2 + o.userData.flag) * 0.4; }); };
    g.userData.react = () => { party = 1; sound('musicBox'); };
    return g;
  };

  const DECO = {};
  DECO.ticketBooth = () => {
    const g = new THREE.Group();
    part(box(0.7, 0.7, 0.6), g, 0, 0.35, 0, col(3, 2));
    const w = new THREE.Mesh(box(0.4, 0.25, 0.02), M.win); w.position.set(0, 0.5, 0.31); g.add(w);
    part(box(0.5, 0.04, 0.16), g, 0, 0.36, 0.36);
    part(new THREE.ConeGeometry(0.58, 0.4, 4), g, 0, 0.9, 0, col(0, 4, 'soft')).rotation.y = Math.PI / 4;
    bulb(g, 0, 1.15, 0, 1, 1.2);
    return g;
  };
  DECO.cottonCandy = () => {
    const g = new THREE.Group();
    part(box(0.6, 0.45, 0.4), g, 0, 0.32, 0, col(13, 2));
    [[-0.2, 0.2], [0.2, 0.2], [-0.2, -0.2], [0.2, -0.2]].forEach(([x, z]) => { const wh = new THREE.Mesh(cyl(0.07, 0.07, 0.03, 10), M.blue); wh.rotation.x = Math.PI / 2; wh.position.set(x, 0.07, z + Math.sign(z) * 0.03); g.add(wh); });
    [[-0.15, 3], [0, 13], [0.15, 8]].forEach(([x, h]) => { bar(g, 0.015, 0.3, 0.015, x, 0.7, 0); const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 1), col(h, 2, 'soft')); c.position.set(x, 0.9, 0); g.add(c); });
    return g;
  };
  DECO.balloonStand = () => {
    const g = new THREE.Group();
    part(box(0.4, 0.35, 0.3), g, 0, 0.18, 0, col(9, 3));
    const bs = [[-0.2, 0, 1.1, 0], [0.15, 0.1, 1.25, 3], [0, -0.12, 1.4, 8], [0.25, -0.05, 1.05, 13], [-0.05, 0.15, 1.2, 5]].map(([x, z, h, hue], i) => {
      const s = new THREE.Group(); s.position.set(0, 0.36, 0); g.add(s);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(0, 0, 0), V3(x, h - 0.36, z)]), M.line); s.add(line);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), col(hue, 4)); b.scale.y = 1.2; b.position.set(x, h - 0.26, z); s.add(b);
      return { s, ph: i };
    });
    g.userData.tick = (t) => bs.forEach(o => { o.s.rotation.z = Math.sin(t * 1.2 + o.ph) * 0.08; o.s.rotation.x = Math.cos(t * 0.9 + o.ph) * 0.06; });
    return g;
  };
  DECO.stringLights = () => {
    const g = new THREE.Group();
    [-0.45, 0.45].forEach(x => bar(g, 0.04, 1.5, 0.04, x, 0.75, 0));
    const pts = []; for (let i = 0; i <= 10; i++) { const x = -0.45 + i * 0.09; pts.push(V3(x, 1.45 - (1 - Math.pow((x / 0.45), 2)) * 0.25, 0)); }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), M.line));
    pts.forEach((p, i) => { if (i % 2) bulb(g, p.x, p.y - 0.06, 0, i, 0.9); });
    g.userData.tick = (t, dt, night) => bulbTick(t, night, dt);
    return g;
  };
  DECO.parkFence = () => {
    const g = new THREE.Group();
    [-0.42, 0, 0.42].forEach((x, i) => { part(box(0.07, 0.55, 0.07), g, x, 0.275, 0, col(8, 2)); bulb(g, x, 0.6, 0, i); });
    [0.2, 0.42].forEach(y => part(box(0.95, 0.05, 0.04), g, 0, y, 0, col(8, 2)));
    g.userData.tick = (t, dt, night) => bulbTick(t, night, dt);
    return g;
  };
  DECO.queueRail = () => {
    const g = new THREE.Group();
    [-0.4, 0, 0.4].forEach(x => { part(cyl(0.03, 0.03, 0.5, 8), g, x, 0.25, 0, col(3, 6)); part(cyl(0.08, 0.08, 0.03, 10), g, x, 0.015, 0, col(3, 6)); });
    [-1, 1].forEach(s => { const pts = []; for (let i = 0; i <= 8; i++) { const k = i / 8; pts.push(V3(s < 0 ? -0.4 + k * 0.4 : k * 0.4, 0.45 - Math.sin(k * Math.PI) * 0.1, 0)); } g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.015, 4), col(0, 6))); });
    return g;
  };

  const NAMES = {
    coaster: '롤러코스터', dropTower: '자이로드롭', viking: '바이킹', swingRide: '회전 그네', bigWheel: '대관람차', spaceRide: '회전 우주선',
    logFlume: '통나무 급류', obsTower: '회전 전망탑', carousel: '회전목마', parkArch: '파크 입구',
    ticketBooth: '매표소', cottonCandy: '솜사탕', balloonStand: '풍선 가게', stringLights: '줄 전구', parkFence: '파크 울타리', queueRail: '줄 서는 곳',
  };
  Object.entries(RIDES).forEach(([ref, fn]) => Mo.register(ref, NAMES[ref], fn, 1));
  Object.entries(DECO).forEach(([ref, fn]) => Mo.registerDeco(ref, NAMES[ref], fn));
  root.BV.Theme = { bulbTick };
})(this);
