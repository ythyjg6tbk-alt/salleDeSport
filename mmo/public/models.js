"use strict";
/* =========================================================================
   Fabriques de modèles 3D low-poly (cel-shadé) pour Les 5 Gardiens.
   Aucune ressource externe : tout est généré avec des primitives Three.js.
   ========================================================================= */

var Models = (function () {
  var toonGradient = null;

  function initToon() {
    var c = document.createElement("canvas");
    c.width = 4; c.height = 1;
    var ctx = c.getContext("2d");
    var img = ctx.createImageData(4, 1);
    [70, 140, 205, 255].forEach(function (v, i) {
      img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    });
    ctx.putImageData(img, 0, 0);
    toonGradient = new THREE.CanvasTexture(c);
    toonGradient.minFilter = THREE.NearestFilter;
    toonGradient.magFilter = THREE.NearestFilter;
  }

  function toon(color, opts) {
    opts = opts || {};
    var m = new THREE.MeshToonMaterial({ color: color, gradientMap: toonGradient });
    if (opts.transparent) { m.transparent = true; m.opacity = opts.opacity != null ? opts.opacity : 0.6; }
    return m;
  }
  function shiny(color, metalness, roughness) {
    return new THREE.MeshStandardMaterial({ color: color, metalness: metalness, roughness: roughness, flatShading: true });
  }
  function glow(color, emissive, intensity) {
    return new THREE.MeshStandardMaterial({ color: color, emissive: emissive, emissiveIntensity: intensity, flatShading: true });
  }
  function addEyes(group, y, z, spacing, eyeColor) {
    var eyeMat = toon(eyeColor || 0x1c1712);
    [-spacing, spacing].forEach(function (x) {
      var eye = new THREE.Mesh(new THREE.SphereGeometry(0.034, 6, 6), eyeMat);
      eye.position.set(x, y, z);
      group.add(eye);
    });
  }
  function mesh(geo, mat, x, y, z, rx, ry, rz) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    if (rz) m.rotation.z = rz;
    return m;
  }

  // ======================================================== HEROS (5 classes)

  function buildSamurai() {
    var group = new THREE.Group();
    var fur = toon(0x6b4a2f), furDark = toon(0x4f3521), snoutMat = toon(0xc98a6b);
    var armor = shiny(0x232733, 0.2, 0.55);
    var trim = glow(0xffb54a, 0x2a1c05, 0.4);
    var cape = toon(0xb3273c); cape.side = THREE.DoubleSide;
    var blade = shiny(0xd7dbe0, 0.5, 0.3);
    var tuskMat = toon(0xf3f0e6);

    var torso = mesh(new THREE.BoxGeometry(0.62, 0.62, 0.4), fur, 0, 1.05, 0);
    group.add(torso);
    group.add(mesh(new THREE.BoxGeometry(0.5, 0.46, 0.1), armor, 0, 1.08, 0.24));
    group.add(mesh(new THREE.BoxGeometry(0.54, 0.08, 0.11), trim, 0, 1.28, 0.25));
    var capeMesh = mesh(new THREE.PlaneGeometry(0.5, 0.7), cape, 0, 0.95, -0.22, 0.25);
    group.add(capeMesh);
    group.add(mesh(new THREE.BoxGeometry(0.42, 0.36, 0.42), furDark, 0, 1.58, 0.05));
    group.add(mesh(new THREE.BoxGeometry(0.22, 0.18, 0.24), snoutMat, 0, 1.5, 0.28));
    addEyes(group, 1.6, 0.28, 0.12);
    [-0.16, 0.16].forEach(function (x) {
      group.add(mesh(new THREE.ConeGeometry(0.03, 0.14, 5), tuskMat, x, 1.42, 0.36, Math.PI / 2.4));
      group.add(mesh(new THREE.ConeGeometry(0.1, 0.2, 5), furDark, x, 1.82, -0.02));
    });
    group.add(mesh(new THREE.TorusGeometry(0.19, 0.035, 6, 12, Math.PI), trim, 0, 1.78, 0.02, Math.PI));
    [-0.42, 0.42].forEach(function (x) { group.add(mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.55, 6), fur, x, 0.95, 0)); });

    var legL = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.6, 6), furDark, -0.16, 0.3, 0);
    var legR = legL.clone(); legR.position.x = 0.16;
    group.add(legL, legR);
    group.add(mesh(new THREE.BoxGeometry(0.07, 0.07, 0.95), blade, -0.05, 1.15, -0.35, 0.5));

    group.userData = { legs: [legL, legR], torso: torso, torsoBaseY: torso.position.y };
    return group;
  }

  function buildPriestess() {
    var group = new THREE.Group();
    var furLight = toon(0xd9b98a), robeMat = toon(0xf2ead8), sashMat = toon(0x5a8fd6);
    var antlerMat = toon(0xe8d9c0), woodMat = toon(0x6b4a2f), snoutMat = toon(0xc9a276);
    var orbGlow = glow(0xdff1ff, 0x9fd2ff, 0.85);

    group.add(mesh(new THREE.CylinderGeometry(0.22, 0.42, 1.0, 10), robeMat, 0, 0.68, 0));
    group.add(mesh(new THREE.TorusGeometry(0.26, 0.045, 6, 14), sashMat, 0, 0.92, 0, Math.PI / 2));
    var chest = mesh(new THREE.BoxGeometry(0.4, 0.34, 0.28), furLight, 0, 1.14, 0);
    group.add(chest);
    group.add(mesh(new THREE.BoxGeometry(0.36, 0.32, 0.36), furLight, 0, 1.56, 0.02));
    group.add(mesh(new THREE.BoxGeometry(0.16, 0.13, 0.18), snoutMat, 0, 1.49, 0.22));
    addEyes(group, 1.6, 0.2, 0.1);
    [-0.13, 0.13].forEach(function (x) {
      var ear = mesh(new THREE.ConeGeometry(0.09, 0.18, 5), furLight, x * 1.5, 1.74, -0.02, 0, 0, x > 0 ? -0.4 : 0.4);
      group.add(ear);
      group.add(mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.3, 5), antlerMat, x, 1.92, -0.04, 0, 0, x > 0 ? -0.32 : 0.32));
      group.add(mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.15, 5), antlerMat, x * 1.6, 2.08, -0.04, 0, 0, x > 0 ? -0.95 : 0.95));
    });
    [-0.3, 0.3].forEach(function (x) { group.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.48, 6), robeMat, x, 1.0, 0)); });
    group.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 6), woodMat, 0.4, 0.85, 0.08));
    group.add(mesh(new THREE.IcosahedronGeometry(0.1, 0), orbGlow, 0.4, 1.55, 0.08));

    group.userData = { torso: chest, torsoBaseY: chest.position.y };
    return group;
  }

  function buildNinja() {
    var group = new THREE.Group();
    var furOrange = toon(0xe8792c), furWhite = toon(0xf5ede0), garb = toon(0x2b2440), maskMat = toon(0x1a1626);
    var scarfMat = toon(0xb3273c); scarfMat.side = THREE.DoubleSide;
    var bladeMat = shiny(0xd7dbe0, 0.55, 0.3);

    var torso = mesh(new THREE.BoxGeometry(0.46, 0.5, 0.3), garb, 0, 1.0, 0);
    group.add(torso);
    group.add(mesh(new THREE.BoxGeometry(0.2, 0.32, 0.05), furWhite, 0, 0.98, 0.18));
    group.add(mesh(new THREE.BoxGeometry(0.36, 0.32, 0.38), furOrange, 0, 1.5, 0.05));
    group.add(mesh(new THREE.BoxGeometry(0.17, 0.14, 0.2), furWhite, 0, 1.42, 0.26));
    group.add(mesh(new THREE.BoxGeometry(0.38, 0.09, 0.14), maskMat, 0, 1.55, 0.2));
    addEyes(group, 1.55, 0.3, 0.09);
    [-0.15, 0.15].forEach(function (x) {
      group.add(mesh(new THREE.ConeGeometry(0.1, 0.24, 4), furOrange, x, 1.8, -0.02));
      group.add(mesh(new THREE.ConeGeometry(0.06, 0.09, 4), maskMat, x, 1.9, -0.02));
    });
    group.add(mesh(new THREE.PlaneGeometry(0.28, 0.46), scarfMat, 0, 1.12, -0.18, 0.3));
    [-0.27, 0.27].forEach(function (x) { group.add(mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.42, 6), garb, x, 0.95, 0)); });

    var legL = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.48, 6), garb, -0.12, 0.24, 0);
    var legR = legL.clone(); legR.position.x = 0.12;
    group.add(legL, legR);
    group.add(mesh(new THREE.ConeGeometry(0.15, 0.65, 6), furOrange, 0, 0.72, -0.32, -1.3));
    group.add(mesh(new THREE.SphereGeometry(0.09, 6, 6), furWhite, 0, 0.5, -0.58));
    group.add(mesh(new THREE.BoxGeometry(0.05, 0.05, 0.4), bladeMat, -0.05, 1.05, -0.22, 0.4));

    group.userData = { torso: torso, torsoBaseY: torso.position.y, legs: [legL, legR] };
    return group;
  }

  function buildMage() {
    var group = new THREE.Group();
    var furBrown = toon(0x7a5a3a), furTan = toon(0xd9c19f), robeMat = toon(0x3a6ea8);
    var woodMat = toon(0x5a3d24), noseMat = toon(0x2a1810);
    var crystalMat = glow(0xbfe9ff, 0x4fa6ff, 0.85);

    var torso = mesh(new THREE.SphereGeometry(0.36, 10, 8), furBrown, 0, 0.98, -0.04);
    torso.scale.set(1, 1.1, 0.9);
    group.add(torso);
    var belly = mesh(new THREE.SphereGeometry(0.3, 10, 8), furTan, 0, 0.95, 0.1);
    belly.scale.set(1, 1.1, 0.75);
    group.add(belly);
    group.add(mesh(new THREE.TorusGeometry(0.3, 0.075, 6, 16), robeMat, 0, 0.76, 0, Math.PI / 2));
    group.add(mesh(new THREE.SphereGeometry(0.25, 10, 8), furBrown, 0, 1.53, 0.02));
    group.add(mesh(new THREE.SphereGeometry(0.13, 8, 6), furTan, 0, 1.46, 0.19));
    group.add(mesh(new THREE.SphereGeometry(0.035, 6, 6), noseMat, 0, 1.49, 0.3));
    addEyes(group, 1.58, 0.2, 0.11);
    [-0.15, 0.15].forEach(function (x) { group.add(mesh(new THREE.SphereGeometry(0.07, 6, 6), furBrown, x, 1.73, 0)); });
    [-1, 1].forEach(function (side) {
      for (var w = 0; w < 2; w++) {
        group.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 4), furTan, side * 0.15, 1.45 - w * 0.03, 0.22, 0, 0, side * 1.4));
      }
    });
    [-0.32, 0.32].forEach(function (x) { group.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.36, 6), furBrown, x, 0.9, 0.04, 0, 0, x > 0 ? -0.3 : 0.3)); });

    var legL = mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.36, 6), furBrown, -0.13, 0.18, 0);
    var legR = legL.clone(); legR.position.x = 0.13;
    group.add(legL, legR);
    var tail = mesh(new THREE.ConeGeometry(0.12, 0.55, 6), furBrown, 0, 0.5, -0.36, -1.4);
    tail.scale.set(1.3, 1, 0.5);
    group.add(tail);
    group.add(mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.1, 6), woodMat, -0.42, 0.72, 0));
    group.add(mesh(new THREE.OctahedronGeometry(0.12, 0), crystalMat, -0.42, 1.34, 0));

    group.userData = { torso: torso, torsoBaseY: torso.position.y, legs: [legL, legR] };
    return group;
  }

  function buildBard() {
    var group = new THREE.Group();
    var scaleMat = toon(0x1f5f6b), scaleDark = toon(0x163f47), bellyMat = toon(0xe8c468);
    var wingMat = toon(0x2a7d8c), hornMat = toon(0xe8d9c0), luteMat = toon(0x8a5a2f);

    var torso = mesh(new THREE.BoxGeometry(0.48, 0.58, 0.34), scaleMat, 0, 1.05, 0);
    group.add(torso);
    group.add(mesh(new THREE.BoxGeometry(0.28, 0.46, 0.06), bellyMat, 0, 1.02, 0.19));
    group.add(mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.32, 6), scaleMat, 0, 1.48, 0.08, -0.3));
    group.add(mesh(new THREE.BoxGeometry(0.28, 0.26, 0.46), scaleMat, 0, 1.7, 0.22));
    group.add(mesh(new THREE.BoxGeometry(0.17, 0.15, 0.24), scaleDark, 0, 1.64, 0.46));
    addEyes(group, 1.76, 0.3, 0.1);
    [-0.09, 0.09].forEach(function (x) { group.add(mesh(new THREE.ConeGeometry(0.05, 0.26, 5), hornMat, x, 1.92, 0.1, -0.3, 0, x > 0 ? -0.2 : 0.2)); });
    [-1, 1].forEach(function (side) {
      var wing = mesh(new THREE.ConeGeometry(0.4, 0.85, 3), wingMat, side * 0.3, 1.22, -0.2, 1.6, 0, side * 0.55);
      wing.scale.set(0.55, 1, 0.15);
      group.add(wing);
    });
    [-0.29, 0.29].forEach(function (x) { group.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.4, 6), scaleMat, x, 0.95, 0.1, -0.5)); });

    var legL = mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.52, 6), scaleDark, -0.15, 0.26, 0);
    var legR = legL.clone(); legR.position.x = 0.15;
    group.add(legL, legR);
    group.add(mesh(new THREE.CylinderGeometry(0.02, 0.12, 1.05, 6), scaleMat, 0, 0.48, -0.52, 1.35));
    var luteBody = mesh(new THREE.SphereGeometry(0.15, 8, 6), luteMat, 0.4, 1.0, 0.18);
    luteBody.scale.set(1, 1.2, 0.4);
    group.add(luteBody);
    group.add(mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.48, 5), luteMat, 0.4, 1.28, 0.18));

    group.userData = { torso: torso, torsoBaseY: torso.position.y, legs: [legL, legR] };
    return group;
  }

  var HERO_BUILDERS = { samurai: buildSamurai, priestess: buildPriestess, ninja: buildNinja, mage: buildMage, bard: buildBard };
  function buildHero(classId) {
    var fn = HERO_BUILDERS[classId] || buildSamurai;
    return fn();
  }

  // ============================================================== MONSTRES

  function buildWolf() {
    var group = new THREE.Group();
    var fur = toon(0x6b6560), furDark = toon(0x47433f), fang = toon(0xf0ece0);
    var body = mesh(new THREE.BoxGeometry(0.5, 0.4, 0.85), fur, 0, 0.42, 0);
    group.add(body);
    group.add(mesh(new THREE.BoxGeometry(0.32, 0.28, 0.36), furDark, 0, 0.55, 0.5));
    group.add(mesh(new THREE.BoxGeometry(0.16, 0.14, 0.22), fur, 0, 0.5, 0.7));
    addEyes(group, 0.58, 0.62, 0.09, 0xd94a2f);
    [-0.12, 0.12].forEach(function (x) { group.add(mesh(new THREE.ConeGeometry(0.08, 0.18, 4), furDark, x, 0.72, 0.42)); });
    [[-0.18, 0.32], [0.18, 0.32], [-0.18, -0.28], [0.18, -0.28]].forEach(function (p) {
      group.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.42, 5), furDark, p[0], 0.21, p[1]));
    });
    group.add(mesh(new THREE.ConeGeometry(0.09, 0.4, 5), fur, 0, 0.55, -0.48, 1.1));
    group.userData = { torso: body, torsoBaseY: body.position.y };
    return group;
  }

  function buildCrow() {
    var group = new THREE.Group();
    var black = toon(0x1c1a1e), beakMat = toon(0xd99a3a);
    var body = mesh(new THREE.SphereGeometry(0.24, 8, 6), black, 0, 0.75, 0);
    body.scale.set(0.85, 1, 1.1);
    group.add(body);
    group.add(mesh(new THREE.ConeGeometry(0.07, 0.2, 5), beakMat, 0, 0.72, 0.28, Math.PI / 2));
    addEyes(group, 0.8, 0.2, 0.08, 0xff5c3c);
    [-1, 1].forEach(function (side) {
      var wing = mesh(new THREE.PlaneGeometry(0.5, 0.22), black, side * 0.24, 0.75, -0.05, 0, 0, side * 0.5);
      wing.material.side = THREE.DoubleSide;
      group.add(wing);
    });
    group.userData = { torso: body, torsoBaseY: body.position.y };
    return group;
  }

  function buildSpider() {
    var group = new THREE.Group();
    var body = toon(0x3a2a3a);
    var abdomen = mesh(new THREE.SphereGeometry(0.26, 8, 6), body, 0, 0.32, -0.14);
    group.add(abdomen);
    group.add(mesh(new THREE.SphereGeometry(0.16, 8, 6), body, 0, 0.33, 0.2));
    addEyes(group, 0.4, 0.34, 0.07, 0xff3c3c);
    for (var i = 0; i < 6; i++) {
      var side = i < 3 ? -1 : 1;
      var idx = i % 3;
      var leg = mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.55, 4), body, side * 0.3, 0.28, -0.1 + idx * 0.16, 0, 0, side * 1.1);
      group.add(leg);
    }
    group.userData = { torso: abdomen, torsoBaseY: abdomen.position.y };
    return group;
  }

  function buildGolem() {
    var group = new THREE.Group();
    var stone = toon(0x7a7a72), stoneDark = toon(0x5c5c56), mossMat = toon(0x5a7d4a);
    var core = glow(0x8fffea, 0x4fffdf, 0.7);
    var torso = mesh(new THREE.BoxGeometry(0.72, 0.75, 0.5), stone, 0, 1.05, 0);
    group.add(torso);
    group.add(mesh(new THREE.BoxGeometry(0.3, 0.18, 0.1), mossMat, 0.1, 1.15, 0.26));
    group.add(mesh(new THREE.BoxGeometry(0.44, 0.4, 0.44), stoneDark, 0, 1.68, 0));
    group.add(mesh(new THREE.IcosahedronGeometry(0.08, 0), core, 0, 1.68, 0.24));
    addEyes(group, 1.72, 0.2, 0.1, 0x0f0f10);
    [-0.5, 0.5].forEach(function (x) { group.add(mesh(new THREE.BoxGeometry(0.26, 0.7, 0.3), stone, x, 0.95, 0)); });
    var legL = mesh(new THREE.BoxGeometry(0.28, 0.55, 0.32), stoneDark, -0.2, 0.28, 0);
    var legR = legL.clone(); legR.position.x = 0.2;
    group.add(legL, legR);
    group.userData = { torso: torso, torsoBaseY: torso.position.y, legs: [legL, legR] };
    return group;
  }

  function buildSlime() {
    var group = new THREE.Group();
    var body = toon(0x7ed957);
    body.transparent = true; body.opacity = 0.82;
    var blob = mesh(new THREE.SphereGeometry(0.34, 10, 8), body, 0, 0.3, 0);
    blob.scale.set(1.15, 0.85, 1.15);
    group.add(blob);
    addEyes(group, 0.36, 0.28, 0.1, 0x1c3a12);
    group.userData = { torso: blob, torsoBaseY: blob.position.y, squish: true };
    return group;
  }

  function buildSpectre() {
    var group = new THREE.Group();
    var ghost = toon(0xcfe9ff, { transparent: true, opacity: 0.6 });
    var body = mesh(new THREE.ConeGeometry(0.32, 0.9, 8), ghost, 0, 0.6, 0);
    group.add(body);
    group.add(mesh(new THREE.SphereGeometry(0.22, 8, 6), ghost, 0, 1.1, 0));
    addEyes(group, 1.13, 0.16, 0.08, 0x6a2a8c);
    group.userData = { torso: body, torsoBaseY: body.position.y, floaty: true };
    return group;
  }

  function buildOni() {
    var group = new THREE.Group();
    var skin = toon(0x8c2e2e), skinDark = toon(0x6a1f1f), cloth = toon(0x2a241c), hornMat = toon(0xe8d9c0);
    var club = toon(0x4a3324);
    var scale = 1.5;
    var torso = mesh(new THREE.BoxGeometry(0.85, 0.9, 0.55), skin, 0, 1.5, 0);
    group.add(torso);
    group.add(mesh(new THREE.BoxGeometry(0.5, 0.35, 0.15), cloth, 0, 1.15, 0.28));
    group.add(mesh(new THREE.BoxGeometry(0.52, 0.48, 0.52), skinDark, 0, 2.2, 0));
    addEyes(group, 2.26, 0.28, 0.14, 0xffe14a);
    [-0.14, 0.14].forEach(function (x) { group.add(mesh(new THREE.ConeGeometry(0.07, 0.34, 5), hornMat, x, 2.55, 0, 0, 0, x > 0 ? -0.15 : 0.15)); });
    var armL = mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.85, 6), skin, -0.58, 1.4, 0);
    var armR = armL.clone(); armR.position.x = 0.58;
    group.add(armL, armR);
    var legL = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.8, 6), skinDark, -0.24, 0.4, 0);
    var legR = legL.clone(); legR.position.x = 0.24;
    group.add(legL, legR);
    var clubHandle = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 6), club, 0.7, 1.1, 0.2, 0, 0, 0.3);
    group.add(clubHandle);
    group.add(mesh(new THREE.SphereGeometry(0.22, 6, 6), club, 0.85, 1.55, 0.25));
    group.scale.setScalar(scale);
    group.userData = { torso: torso, torsoBaseY: torso.position.y, legs: [legL, legR] };
    return group;
  }

  var MONSTER_BUILDERS = {
    loup: buildWolf, corbeau: buildCrow, araignee: buildSpider,
    golem: buildGolem, vase: buildSlime, spectre: buildSpectre, oni: buildOni,
  };
  function buildMonster(templateId) {
    var fn = MONSTER_BUILDERS[templateId] || buildWolf;
    return fn();
  }

  // ==================================================================== PNJ

  function buildTreeElder() {
    var group = new THREE.Group();
    var trunk = toon(0x5a4030), canopy = toon(0x6a8f4a), faceMat = toon(0x2a1c12);
    var t = mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.3, 8), trunk, 0, 0.65, 0);
    group.add(t);
    group.add(mesh(new THREE.IcosahedronGeometry(0.55, 0), canopy, 0, 1.55, 0));
    group.add(mesh(new THREE.IcosahedronGeometry(0.36, 0), canopy, 0.3, 1.9, 0.1));
    group.add(mesh(new THREE.IcosahedronGeometry(0.34, 0), canopy, -0.32, 1.85, -0.12));
    addEyes(group, 1.05, 0.28, 0.09, 0x1c1006);
    group.add(mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.15, 5), faceMat, 0, 0.9, 0.3, Math.PI / 2));
    group.userData = { torso: t, torsoBaseY: t.position.y };
    return group;
  }

  function buildBlacksmith() {
    var group = new THREE.Group();
    var body = toon(0x7a5a42), apron = toon(0x4a4038), skin = toon(0xc9926a), hammerMat = toon(0x3a3530);
    var torso = mesh(new THREE.BoxGeometry(0.5, 0.55, 0.35), body, 0, 0.95, 0);
    group.add(torso);
    group.add(mesh(new THREE.BoxGeometry(0.34, 0.4, 0.05), apron, 0, 0.85, 0.19));
    group.add(mesh(new THREE.SphereGeometry(0.22, 8, 8), skin, 0, 1.42, 0));
    addEyes(group, 1.44, 0.19, 0.08);
    [-0.28, 0.28].forEach(function (x) { group.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.45, 6), body, x, 0.85, 0)); });
    var legL = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.45, 6), toon(0x2e2925), -0.14, 0.22, 0);
    var legR = legL.clone(); legR.position.x = 0.14;
    group.add(legL, legR);
    group.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), hammerMat, 0.4, 1.1, 0.15, 0, 0, 0.3));
    group.add(mesh(new THREE.BoxGeometry(0.18, 0.12, 0.12), hammerMat, 0.46, 1.32, 0.18));
    group.userData = { torso: torso, torsoBaseY: torso.position.y };
    return group;
  }

  function buildMistSage() {
    var group = new THREE.Group();
    var robe = toon(0x7a92a8), hoodMat = toon(0x566d80), woodMat = toon(0x5a4030);
    var glowMat = glow(0xdff1ff, 0xbfe9ff, 0.6);
    var robeMesh = mesh(new THREE.CylinderGeometry(0.2, 0.4, 1.3, 10), robe, 0, 0.85, 0);
    group.add(robeMesh);
    group.add(mesh(new THREE.ConeGeometry(0.28, 0.5, 8), hoodMat, 0, 1.7, 0));
    addEyes(group, 1.55, 0.2, 0.07, 0xdff1ff);
    group.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.5, 6), woodMat, 0.35, 1.0, 0.05));
    group.add(mesh(new THREE.IcosahedronGeometry(0.09, 0), glowMat, 0.35, 1.8, 0.05));
    group.userData = { torso: robeMesh, torsoBaseY: robeMesh.position.y };
    return group;
  }

  function buildPeakGuardian() {
    var group = new THREE.Group();
    var armor = shiny(0x3a3a42, 0.4, 0.4), goldTrim = glow(0xe0b84a, 0x3a2a05, 0.4), visor = toon(0x1c1c20);
    var torso = mesh(new THREE.BoxGeometry(0.62, 0.7, 0.4), armor, 0, 1.1, 0);
    group.add(torso);
    group.add(mesh(new THREE.BoxGeometry(0.66, 0.1, 0.42), goldTrim, 0, 1.4, 0));
    group.add(mesh(new THREE.BoxGeometry(0.4, 0.36, 0.4), armor, 0, 1.65, 0));
    group.add(mesh(new THREE.BoxGeometry(0.4, 0.08, 0.1), visor, 0, 1.68, 0.21));
    [-0.4, 0.4].forEach(function (x) {
      group.add(mesh(new THREE.BoxGeometry(0.22, 0.24, 0.22), armor, x, 1.42, 0));
      group.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.4, 6), armor, x, 1.05, 0));
    });
    var legL = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.55, 6), armor, -0.16, 0.28, 0);
    var legR = legL.clone(); legR.position.x = 0.16;
    group.add(legL, legR);
    group.add(mesh(new THREE.BoxGeometry(0.06, 0.9, 0.35), goldTrim, -0.42, 0.9, 0.15));
    group.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 5), toon(0x3a3530), 0.42, 1.2, 0));
    group.userData = { torso: torso, torsoBaseY: torso.position.y, legs: [legL, legR] };
    return group;
  }

  var NPC_BUILDERS = {
    ancien_chene: buildTreeElder, forgeron_1: buildBlacksmith, forgeron_2: buildBlacksmith,
    sage_brumes: buildMistSage, gardien_pic: buildPeakGuardian,
  };
  function buildNpc(npcId) {
    var fn = NPC_BUILDERS[npcId] || buildTreeElder;
    return fn();
  }

  // ============================================================ ENVIRONNEMENT

  function buildBlossomTree(scale) {
    var group = new THREE.Group();
    var trunkMat = toon(0x4a3324), leafMat = toon(0xf4b6c2);
    group.add(mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.6, 6), trunkMat, 0, 0.8, 0));
    for (var i = 0; i < 3; i++) {
      group.add(mesh(new THREE.IcosahedronGeometry(0.75 - i * 0.12, 0), leafMat, (Math.random() - 0.5) * 0.5, 1.7 + i * 0.5, (Math.random() - 0.5) * 0.5));
    }
    group.scale.setScalar(scale);
    return group;
  }
  function buildPineTree(scale) {
    var group = new THREE.Group();
    var trunkMat = toon(0x3a2c1e), leafMat = toon(0x2f4d34);
    group.add(mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.3, 6), trunkMat, 0, 0.65, 0));
    for (var i = 0; i < 3; i++) {
      group.add(mesh(new THREE.ConeGeometry(0.65 - i * 0.15, 0.85, 7), leafMat, 0, 1.5 + i * 0.55, 0));
    }
    group.scale.setScalar(scale);
    return group;
  }
  function buildDeadTree(scale) {
    var group = new THREE.Group();
    var mat = toon(0x4a4038);
    group.add(mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.6, 6), mat, 0, 0.8, 0));
    for (var i = 0; i < 4; i++) {
      var a = (i / 4) * Math.PI * 2;
      group.add(mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.6, 4), mat, Math.cos(a) * 0.2, 1.5 + i * 0.1, Math.sin(a) * 0.2, 0, 0, Math.cos(a) * 0.8));
    }
    group.scale.setScalar(scale);
    return group;
  }
  function buildRock(scale) {
    var mat = toon(0x6a6a64);
    var rock = mesh(new THREE.IcosahedronGeometry(0.5, 0), mat, 0, 0.3, 0);
    rock.scale.set(1, 0.7, 1);
    rock.rotation.y = Math.random() * Math.PI;
    rock.scale.multiplyScalar(scale);
    return rock;
  }
  function buildHut(scale) {
    var group = new THREE.Group();
    var wallMat = toon(0x8a7a5c), roofMat = toon(0x5a3d2a);
    group.add(mesh(new THREE.BoxGeometry(1.4, 1.1, 1.4), wallMat, 0, 0.55, 0));
    group.add(mesh(new THREE.ConeGeometry(1.15, 0.9, 4), roofMat, 0, 1.5, 0, 0, Math.PI / 4));
    group.scale.setScalar(scale);
    return group;
  }
  function buildWallSegment(scale) {
    var group = new THREE.Group();
    var stoneMat = toon(0x7a7a72), bannerMat = toon(0xb3273c);
    group.add(mesh(new THREE.BoxGeometry(1.6, 1.8, 0.6), stoneMat, 0, 0.9, 0));
    var banner = mesh(new THREE.PlaneGeometry(0.5, 1.0), bannerMat, 0, 1.2, 0.32);
    banner.material.side = THREE.DoubleSide;
    group.add(banner);
    group.scale.setScalar(scale);
    return group;
  }
  function buildLantern() {
    var group = new THREE.Group();
    var poleMat = toon(0x3a2a1c);
    var lampMat = glow(0xffcf7a, 0xffb54a, 0.9);
    group.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), poleMat, 0, 1.2, 0));
    var lamp = mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), lampMat, 0, 2.5, 0);
    group.add(lamp);
    group.userData = { lamp: lamp };
    return group;
  }
  function buildTorii(scale) {
    var group = new THREE.Group();
    var red = toon(0xc1440e), dark = toon(0x2a1810);
    [-1.7, 1.7].forEach(function (x) { group.add(mesh(new THREE.CylinderGeometry(0.24, 0.28, 4.4, 8), red, x, 2.2, 0)); });
    group.add(mesh(new THREE.BoxGeometry(4.6, 0.32, 0.5), red, 0, 4.35, 0));
    group.add(mesh(new THREE.BoxGeometry(5.2, 0.22, 0.7), dark, 0, 4.6, 0));
    group.add(mesh(new THREE.BoxGeometry(3.6, 0.26, 0.32), dark, 0, 3.55, 0));
    group.scale.setScalar(scale || 1);
    return group;
  }
  function buildPortalRing() {
    var group = new THREE.Group();
    var ringMat = glow(0xffb54a, 0xffb54a, 1.1);
    ringMat.side = THREE.DoubleSide;
    var ring = mesh(new THREE.RingGeometry(0.9, 1.15, 24), ringMat, 0, 0.03, 0, -Math.PI / 2);
    group.add(ring);
    group.userData = { ring: ring };
    return group;
  }

  return {
    initToon: initToon, toon: toon, shiny: shiny, glow: glow, addEyes: addEyes, mesh: mesh,
    buildHero: buildHero, buildMonster: buildMonster, buildNpc: buildNpc,
    buildBlossomTree: buildBlossomTree, buildPineTree: buildPineTree, buildDeadTree: buildDeadTree,
    buildRock: buildRock, buildHut: buildHut, buildWallSegment: buildWallSegment,
    buildLantern: buildLantern, buildTorii: buildTorii, buildPortalRing: buildPortalRing,
  };
})();
