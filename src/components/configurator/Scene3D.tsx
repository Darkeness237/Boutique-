"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Product } from "@/lib/product";
import type { StepKey } from "@/lib/configurator";

// Les fournisseurs ne fournissent pas de modèles 3D. Chaque pièce est d'abord dessinée à partir de ses
// caractéristiques (format, longueur, nombre de barrettes…), puis remplacée par sa vraie photo, détourée,
// dès qu'elle est chargée : on voit exactement le produit choisi. Unité : 1 = 1 cm.

type Parts = Partial<Record<StepKey, Product>>;
export type View = "pc" | "desk";

const C = {
  board: 0x2f3a52,
  pcb: 0x24493a,
  metal: 0x9aa3b2,
  dark: 0x16181d,
  accent: 0x4552d9,
  green: 0x22a845,
  ghost: 0x8590ff,
  wood: 0x6b4a32,
};

const isRgb = (p?: Product) => !!p && /rgb|argb/i.test(p.name);

/** Longueur probable d'une carte graphique (cm), d'après son modèle. */
function gpuLength(name: string): number {
  if (/50[89]0|RX 9070|5070 Ti|Triple|Gaming X|Master|Strix|Suprim/i.test(name)) return 32;
  if (/5070|9060 XT|4070/i.test(name)) return 28;
  if (/Low Profile|LP\b|GT ?7[13]0|ITX|Mini|Slim/i.test(name)) return 17;
  return 24;
}

function screenInches(name: string): number {
  const m = name.match(/(\d{2}(?:[.,]\d)?) ?(?:"|''|pouces|po\b)/i);
  const v = m ? Number(m[1].replace(",", ".")) : 27;
  return v >= 17 && v <= 57 ? v : 27;
}

function mat(color: number, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.2, ...opts });
}

function box(w: number, h: number, d: number, material: THREE.Material) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Contour fantôme d'un emplacement vide (montre où ira la pièce). */
function ghost(w: number, h: number, d: number) {
  const g = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
    new THREE.LineBasicMaterial({ color: C.ghost, transparent: true, opacity: 0.35 }),
  );
  return g;
}

function fan(radius: number, rgb: boolean) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.08, 8, 32), mat(C.dark));
  g.add(frame);
  const blades = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.92, 24), mat(0x2a2f3a, { side: THREE.DoubleSide }));
  g.add(blades);
  if (rgb) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.95, radius * 0.04, 8, 32),
      new THREE.MeshStandardMaterial({ color: C.accent, emissive: C.accent, emissiveIntensity: 1.6 }),
    );
    g.add(ring);
  }
  return g;
}


type PhotoMode = "stand" | "flat";

/** Marque un groupe comme « pièce à remplacer par sa photo ». */
function slot(parent: THREE.Object3D, product: Product | undefined, mode: PhotoMode = "stand"): THREE.Group {
  const g = new THREE.Group();
  if (product?.image_url) g.userData.photo = { url: product.image_url, mode };
  parent.add(g);
  return g;
}

type Cutout = { texture: THREE.Texture; aspect: number };
const cutouts = new Map<string, Promise<Cutout | null>>();

/** Charge une photo et retire le fond blanc (remplissage depuis les bords, l'intérieur blanc du produit est gardé). */
function loadCutout(url: string): Promise<Cutout | null> {
  let p = cutouts.get(url);
  if (p) return p;
  p = new Promise<Cutout | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onerror = () => resolve(null);
    img.onload = () => {
      try {
        const scale = Math.min(1, 640 / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h);
        const px = data.data;
        const isBg = (i: number) => {
          const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
          return r > 232 && g > 232 && b > 232 && Math.max(r, g, b) - Math.min(r, g, b) < 20;
        };
        const seen = new Uint8Array(w * h);
        const stack: number[] = [];
        for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
        for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
        while (stack.length) {
          const i = stack.pop()!;
          if (seen[i] || !isBg(i)) continue;
          seen[i] = 1;
          px[i * 4 + 3] = 0;
          const x = i % w;
          if (x > 0) stack.push(i - 1);
          if (x < w - 1) stack.push(i + 1);
          if (i >= w) stack.push(i - w);
          if (i < w * (h - 1)) stack.push(i + w);
        }
        // Recadrage sur le produit.
        let x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++)
            if (px[(y * w + x) * 4 + 3] > 0) {
              if (x < x0) x0 = x;
              if (x > x1) x1 = x;
              if (y < y0) y0 = y;
              if (y > y1) y1 = y;
            }
        if (x1 < x0) return resolve(null);
        ctx.putImageData(data, 0, 0);
        const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
        const out = document.createElement("canvas");
        out.width = cw;
        out.height = ch;
        out.getContext("2d")!.drawImage(canvas, x0, y0, cw, ch, 0, 0, cw, ch);
        const texture = new THREE.CanvasTexture(out);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        resolve({ texture, aspect: cw / ch });
      } catch {
        resolve(null); // Image sans autorisation CORS : la forme dessinée reste affichée.
      }
    };
    img.src = url;
  });
  cutouts.set(url, p);
  return p;
}

/** Remplace chaque pièce marquée par sa photo détourée, à sa place et à sa taille réelle. */
function applyPhotos(root: THREE.Object3D, stillCurrent: () => boolean) {
  root.updateMatrixWorld(true);
  const tagged: THREE.Object3D[] = [];
  root.traverse((o) => o.userData.photo && tagged.push(o));
  for (const obj of tagged) {
    const { url, mode } = obj.userData.photo as { url: string; mode: PhotoMode };
    const bounds = new THREE.Box3().setFromObject(obj);
    if (bounds.isEmpty()) continue;
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    loadCutout(url).then((cut) => {
      if (!cut || !stillCurrent()) return;
      const big = Math.max(size.x, size.y, size.z);
      if (mode === "flat") {
        // Posée à plat (clavier) : la photo vue de dessus, à la largeur de la pièce.
        const w = size.x;
        const d = Math.min(w / cut.aspect, size.z * 1.6);
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(d * cut.aspect, d),
          new THREE.MeshBasicMaterial({ map: cut.texture, alphaTest: 0.5, toneMapped: false, side: THREE.DoubleSide }),
        );
        plane.rotation.x = -Math.PI / 2;
        plane.position.set(center.x, bounds.min.y + 0.3, center.z);
        root.add(plane);
      } else {
        // Debout, toujours tournée vers le visiteur : on voit la photo du produit sous tous les angles.
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: cut.texture, alphaTest: 0.5, toneMapped: false }));
        const [sw, sh] = cut.aspect >= 1 ? [big, big / cut.aspect] : [big * cut.aspect, big];
        sprite.scale.set(sw, sh, 1);
        sprite.center.set(0.5, 0);
        sprite.position.set(center.x, bounds.min.y, center.z);
        root.add(sprite);
      }
      obj.visible = false;
    });
  }
}

/** Tour PC complète, posée à l'origine (base au sol). */
function buildTower(parts: Parts, showGhosts: boolean): THREE.Group {
  const tower = new THREE.Group();
  const caseP = parts.case;
  const size = caseP?.subcategory === "mini-tour" ? [20, 40, 40] : caseP?.subcategory === "grand-tour" ? [24, 54, 50] : [22, 47, 45];
  const [W, H, D] = size;
  // Photos des pièces seulement dans la vue « intérieur » ; dans le setup, la tour entière prend la photo du boîtier.
  const part = (p: Product | undefined) => slot(tower, showGhosts ? p : undefined);

  // Boîtier : châssis sombre, panneau vitré côté visiteur.
  if (caseP || !showGhosts) {
    const shell = new THREE.Group();
    const side = box(0.4, H, D, mat(C.dark, { metalness: 0.4 }));
    side.position.set(-W / 2, H / 2, 0);
    const top = box(W, 0.4, D, mat(C.dark, { metalness: 0.4 }));
    top.position.set(0, H, 0);
    const bottom = box(W, 0.4, D, mat(C.dark, { metalness: 0.4 }));
    bottom.position.set(0, 0.2, 0);
    const back = box(W, H, 0.4, mat(C.dark, { metalness: 0.4 }));
    back.position.set(0, H / 2, -D / 2);
    const front = box(W, H, 0.6, mat(0x20242d, { metalness: 0.3 }));
    front.position.set(0, H / 2, D / 2);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, H, D),
      new THREE.MeshStandardMaterial({ color: 0xbfd4ff, transparent: true, opacity: 0.1, roughness: 0.05, depthWrite: false }),
    );
    glass.position.set(W / 2, H / 2, 0);
    shell.add(side, top, bottom, back, front, glass);
    // Éclairage intérieur, comme une bande LED : sans lui les pièces restent dans l'ombre du boîtier.
    const led = new THREE.PointLight(isRgb(caseP) ? 0xa9b2ff : 0xffffff, 120, 0, 1.2);
    led.position.set(W / 2 + 6, H * 0.5, 0);
    shell.add(led);
    // Ventilateurs en façade.
    for (let i = 0; i < 3; i++) {
      const f = fan(5.6, isRgb(caseP));
      f.position.set(0, H * 0.25 + i * 12, D / 2 - 1);
      shell.add(f);
    }
    tower.add(shell);
  } else {
    const g = ghost(W, H, D);
    g.position.set(0, H / 2, 0);
    tower.add(g);
  }

  // Carte mère contre la paroi gauche.
  const atx = !/micro|m-atx|matx|\bm\b|itx/i.test(parts.board?.name ?? "");
  const bw = atx ? 30.5 : 24.4;
  const boardY = H - 4 - bw / 2;
  if (parts.board) {
    const host = part(parts.board);
    const b = box(0.3, bw, 24.4, mat(C.board, { metalness: 0.3 }));
    b.position.set(-W / 2 + 1.2, boardY, -D / 2 + 13.5);
    host.add(b);
    // Dissipateurs des étages d'alimentation.
    const vrm = box(1.2, 2.5, 10, mat(C.metal, { metalness: 0.8, roughness: 0.3 }));
    vrm.position.set(-W / 2 + 2, boardY + bw / 2 - 3, -D / 2 + 10);
    host.add(vrm);
  } else if (showGhosts) {
    const g = ghost(0.3, bw, 24.4);
    g.position.set(-W / 2 + 1.2, boardY, -D / 2 + 13.5);
    tower.add(g);
  }

  // Processeur et refroidissement.
  const cpuPos = new THREE.Vector3(-W / 2 + 1.6, boardY + bw / 2 - 9, -D / 2 + 16);
  if (parts.cpu) {
    const c = box(0.4, 4, 4, mat(C.metal, { metalness: 0.9, roughness: 0.25 }));
    c.position.copy(cpuPos);
    part(parts.cpu).add(c);
  }
  const water = parts.cooler?.subcategory === "watercooling" || /watercooling|aio|liquid/i.test(parts.cooler?.name ?? "");
  const coolerHost = part(parts.cooler);
  if (parts.cooler && !water) {
    const fins = new THREE.Group();
    for (let i = 0; i < 18; i++) {
      const fin = box(0.15, 12, 12, mat(C.metal, { metalness: 0.85, roughness: 0.3 }));
      fin.position.set(i * 0.5, 0, 0);
      fins.add(fin);
    }
    fins.position.set(cpuPos.x + 2.5, cpuPos.y + 1, cpuPos.z);
    coolerHost.add(fins);
    const f = fan(5.8, isRgb(parts.cooler));
    f.rotation.y = Math.PI / 2;
    f.position.set(cpuPos.x + 2.5, cpuPos.y + 1, cpuPos.z + 6.5);
    coolerHost.add(f);
  } else if (parts.cooler && water) {
    const pump = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 2, 24), mat(C.dark));
    pump.rotation.z = Math.PI / 2;
    pump.position.set(cpuPos.x + 1.3, cpuPos.y, cpuPos.z);
    coolerHost.add(pump);
    const len = /420|3x140/i.test(parts.cooler.name) ? 45 : /360|3x120/i.test(parts.cooler.name) ? 39 : 27;
    const rad = box(12, 2.7, Math.min(len, D - 4), mat(C.dark, { metalness: 0.5 }));
    rad.position.set(0, H - 2.5, 0);
    coolerHost.add(rad);
    const n = Math.round(Math.min(len, D - 4) / 12.5);
    for (let i = 0; i < n; i++) {
      const f = fan(5.6, isRgb(parts.cooler));
      f.rotation.x = Math.PI / 2;
      f.position.set(0, H - 4.2, -Math.min(len, D - 4) / 2 + 6.2 + i * 12.5);
      coolerHost.add(f);
    }
  } else if (showGhosts && parts.cpu) {
    const g = ghost(10, 12, 12);
    g.position.set(cpuPos.x + 5, cpuPos.y + 1, cpuPos.z);
    tower.add(g);
  }

  // Mémoire : barrettes à droite du processeur.
  if (parts.ram) {
    const host = part(parts.ram);
    const count = Number(parts.ram.name.match(/(\d) ?x/i)?.[1] ?? 2);
    for (let i = 0; i < Math.min(count, 4); i++) {
      const stick = box(3.2, 13.3, 0.7, mat(C.dark, { metalness: 0.5 }));
      stick.position.set(cpuPos.x + 1.8, cpuPos.y, cpuPos.z + 6 + i * 1.1);
      if (isRgb(parts.ram)) {
        const glow = box(0.6, 13.3, 0.72, new THREE.MeshStandardMaterial({ color: C.accent, emissive: C.accent, emissiveIntensity: 1.4 }));
        glow.position.set(1.6, 0, 0);
        stick.add(glow);
      }
      host.add(stick);
    }
  } else if (showGhosts && parts.board) {
    const g = ghost(3.2, 13.3, 4.4);
    g.position.set(cpuPos.x + 1.8, cpuPos.y, cpuPos.z + 7.6);
    tower.add(g);
  }

  // Stockage NVMe sur la carte mère, ou SSD 2,5"/disque dur à l'avant en bas.
  if (parts.storage) {
    if (parts.storage.subcategory === "ssd-nvme") {
      const m2 = box(0.3, 2.2, 8, mat(C.pcb));
      m2.position.set(-W / 2 + 1.5, boardY - 4, -D / 2 + 14);
      part(parts.storage).add(m2);
    } else {
      const drive = box(7, 1, 10, mat(C.metal, { metalness: 0.7 }));
      drive.position.set(2, 3, D / 2 - 9);
      part(parts.storage).add(drive);
    }
  }

  // Carte graphique : horizontale, sous le processeur.
  const gpuY = boardY - 7;
  if (parts.gpu) {
    const L = gpuLength(parts.gpu.name);
    const g = new THREE.Group();
    const body = box(5, 12, L, mat(0x232833, { metalness: 0.5 }));
    g.add(body);
    const nFans = L >= 30 ? 3 : 2;
    for (let i = 0; i < nFans; i++) {
      const f = fan(4.2, isRgb(parts.gpu));
      f.rotation.y = Math.PI / 2;
      f.position.set(2.6, 0, -L / 2 + L / (nFans * 2) + (i * L) / nFans);
      g.add(f);
    }
    const plate = box(0.2, 12, L, mat(C.metal, { metalness: 0.8 }));
    plate.position.set(-2.6, 0, 0);
    g.add(plate);
    g.position.set(-W / 2 + 4.5, gpuY, -D / 2 + 1 + L / 2);
    part(parts.gpu).add(g);
  } else if (showGhosts && parts.board) {
    const g = ghost(5, 12, 24);
    g.position.set(-W / 2 + 4.5, gpuY, -D / 2 + 13);
    tower.add(g);
  }

  // Alimentation en bas, à l'arrière.
  if (parts.psu) {
    const psu = box(15, 8.6, 14, mat(0x1b1e25, { metalness: 0.4 }));
    psu.position.set(-W / 2 + 8, 4.8, -D / 2 + 8);
    part(parts.psu).add(psu);
  } else if (showGhosts && parts.board) {
    const g = ghost(15, 8.6, 14);
    g.position.set(-W / 2 + 8, 4.8, -D / 2 + 8);
    tower.add(g);
  }
  return tower;
}

/** Bureau complet : écran, clavier, souris, casque, fauteuil et tour à côté. */
function buildDesk(parts: Parts): THREE.Group {
  const desk = new THREE.Group();
  const topMat = mat(0x5a4636, { roughness: 0.6 });
  const top = box(160, 3, 75, topMat);
  top.position.set(0, 74, 0);
  desk.add(top);
  for (const [x, z] of [[-76, -33], [76, -33], [-76, 33], [76, 33]]) {
    const leg = box(4, 73, 4, mat(C.dark, { metalness: 0.6 }));
    leg.position.set(x, 36.5, z);
    desk.add(leg);
  }
  const mousepad = box(80, 0.3, 32, mat(0x15171c, { roughness: 0.9 }));
  mousepad.position.set(10, 75.7, 18);
  desk.add(mousepad);

  // Écran : largeur d'après la diagonale (format 16:9).
  const inches = parts.screen ? screenInches(parts.screen.name) : 27;
  const diag = inches * 2.54;
  const sw = (diag * 16) / Math.hypot(16, 9);
  const sh = (diag * 9) / Math.hypot(16, 9);
  const screen = new THREE.Group();
  const panel = box(sw + 1.5, sh + 1.5, 2, mat(C.dark, { metalness: 0.4 }));
  const display = new THREE.Mesh(
    new THREE.PlaneGeometry(sw, sh),
    new THREE.MeshStandardMaterial({ color: 0x1b2a6b, emissive: 0x2a3fd0, emissiveIntensity: parts.screen ? 0.9 : 0.15 }),
  );
  display.position.z = 1.01;
  panel.add(display);
  panel.position.y = 75.5 + 12 + sh / 2;
  const stand = box(3, 14, 3, mat(C.metal, { metalness: 0.8 }));
  stand.position.y = 75.5 + 7;
  const foot = box(22, 1, 16, mat(C.metal, { metalness: 0.8 }));
  foot.position.y = 76;
  screen.add(panel, stand, foot);
  screen.position.set(0, 0, -20);
  if (parts.screen?.image_url) screen.userData.photo = { url: parts.screen.image_url, mode: "stand" };
  if (!parts.screen) screen.traverse((o) => o instanceof THREE.Mesh && ((o.material as THREE.Material).opacity = 0.35, ((o.material as THREE.Material).transparent = true)));
  desk.add(screen);

  if (parts.keyboard) {
    const kb = box(44, 2.5, 14, mat(0x2c313d));
    kb.position.set(-5, 77, 18);
    if (parts.keyboard.image_url) kb.userData.photo = { url: parts.keyboard.image_url, mode: "flat" };
    if (isRgb(parts.keyboard)) {
      const glow = box(42, 0.4, 12, new THREE.MeshStandardMaterial({ color: C.accent, emissive: C.accent, emissiveIntensity: 1.2 }));
      glow.position.y = 1.4;
      kb.add(glow);
    }
    desk.add(kb);
  }
  if (parts.mouse) {
    const mouse = new THREE.Mesh(new THREE.SphereGeometry(3.4, 24, 16), mat(0x2c313d));
    mouse.scale.set(0.9, 0.55, 1.6);
    mouse.position.set(30, 77.2, 18);
    if (parts.mouse.image_url) mouse.userData.photo = { url: parts.mouse.image_url, mode: "stand" };
    desk.add(mouse);
  }
  if (parts.headset) {
    const hs = new THREE.Group();
    const band = new THREE.Mesh(new THREE.TorusGeometry(9, 1.1, 10, 32, Math.PI), mat(0x2c313d));
    const l = box(3, 8, 7, mat(0x2c313d));
    l.position.set(-9, -1, 0);
    const r = box(3, 8, 7, mat(0x2c313d));
    r.position.set(9, -1, 0);
    hs.add(band, l, r);
    hs.position.set(-55, 90, -10);
    if (parts.headset.image_url) hs.userData.photo = { url: parts.headset.image_url, mode: "stand" };
    desk.add(hs);
  }
  if (parts.chair) {
    const chair = new THREE.Group();
    const seat = box(52, 8, 50, mat(0x2c313d));
    seat.position.y = 50;
    const back = box(52, 75, 8, mat(0x2c313d));
    back.position.set(0, 92, 25);
    const stripe = box(10, 75, 8.2, mat(C.accent));
    stripe.position.set(0, 92, 25);
    const post = box(5, 40, 5, mat(C.metal, { metalness: 0.8 }));
    post.position.y = 26;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 3, 5), mat(C.dark));
    base.position.y = 4;
    chair.add(seat, back, stripe, post, base);
    chair.position.set(0, 0, 75);
    if (parts.chair.image_url) chair.userData.photo = { url: parts.chair.image_url, mode: "stand" };
    desk.add(chair);
  }

  // La tour, posée au sol à droite du bureau.
  const tower = buildTower(parts, false);
  tower.position.set(100, 0, -5);
  if (parts.case?.image_url) tower.userData.photo = { url: parts.case.image_url, mode: "stand" };
  desk.add(tower);
  return desk;
}

function disposeGroup(g: THREE.Object3D) {
  g.traverse((o) => {
    if (o instanceof THREE.Sprite) {
      o.material.dispose(); // La texture reste en cache : elle resservira si la pièce est rechoisie.
    } else if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
      o.geometry.dispose();
      const m = o.material as THREE.Material | THREE.Material[];
      (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
    }
  });
}

export default function Scene3D({ parts, view }: { parts: Parts; view: View }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ setContent: (g: THREE.Object3D, v: View) => void } | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1c2230);
    scene.add(new THREE.HemisphereLight(0xe8edff, 0x3a4050, 1.8));
    const sun = new THREE.DirectionalLight(0xffffff, 2.6);
    sun.position.set(80, 160, 120);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -150;
    sun.shadow.camera.right = 150;
    sun.shadow.camera.top = 150;
    sun.shadow.camera.bottom = -150;
    scene.add(sun);
    const rim = new THREE.PointLight(0x8590ff, 400, 200);
    rim.position.set(-40, 60, 40);
    scene.add(rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(220, 48), mat(0x262d3d, { roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const camera = new THREE.PerspectiveCamera(40, 1, 1, 2000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 30;
    controls.maxDistance = 420;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    controls.autoRotate = !reduced;
    controls.autoRotateSpeed = 0.8;
    controls.addEventListener("start", () => (controls.autoRotate = false));

    let content: THREE.Object3D | null = null;
    let currentView: View | null = null;
    api.current = {
      setContent(g, v) {
        if (content) {
          scene.remove(content);
          disposeGroup(content);
        }
        content = g;
        scene.add(g);
        applyPhotos(g, () => content === g);
        if (v !== currentView) {
          currentView = v;
          if (v === "pc") {
            camera.position.set(95, 55, 75);
            controls.target.set(0, 24, 0);
          } else {
            camera.position.set(240, 175, 170);
            controls.target.set(10, 72, 0);
          }
          controls.update();
        }
      },
    };

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    // Rendu seulement quand la vue est à l'écran (économie de batterie).
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);
    renderer.setAnimationLoop(() => {
      if (!visible) return;
      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      io.disconnect();
      controls.dispose();
      if (content) disposeGroup(content);
      renderer.dispose();
      el.removeChild(renderer.domElement);
      api.current = null;
    };
  }, []);

  const key = JSON.stringify({ view, ids: Object.fromEntries(Object.entries(parts).map(([k, p]) => [k, p?.id])) });
  useEffect(() => {
    api.current?.setContent(view === "pc" ? buildTower(parts, true) : buildDesk(parts), view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <div ref={host} className="scene3d" role="img" aria-label={view === "pc" ? "Vue 3D de l'intérieur du PC" : "Vue 3D du setup complet"} />;
}
