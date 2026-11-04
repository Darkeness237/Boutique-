"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Product } from "@/lib/product";
import type { StepKey } from "@/lib/configurator";

// Vue 3D stylisée : les fournisseurs ne fournissent pas de modèles 3D, chaque pièce est donc dessinée à partir
// de ses caractéristiques (format, longueur, nombre de barrettes, éclairage RGB…). Unité : 1 = 1 cm.

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

/** Tour PC complète, posée à l'origine (base au sol). */
function buildTower(parts: Parts, showGhosts: boolean): THREE.Group {
  const tower = new THREE.Group();
  const caseP = parts.case;
  const size = caseP?.subcategory === "mini-tour" ? [20, 40, 40] : caseP?.subcategory === "grand-tour" ? [24, 54, 50] : [22, 47, 45];
  const [W, H, D] = size;

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
    const b = box(0.3, bw, 24.4, mat(C.board, { metalness: 0.3 }));
    b.position.set(-W / 2 + 1.2, boardY, -D / 2 + 13.5);
    tower.add(b);
    // Dissipateurs des étages d'alimentation.
    const vrm = box(1.2, 2.5, 10, mat(C.metal, { metalness: 0.8, roughness: 0.3 }));
    vrm.position.set(-W / 2 + 2, boardY + bw / 2 - 3, -D / 2 + 10);
    tower.add(vrm);
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
    tower.add(c);
  }
  const water = parts.cooler?.subcategory === "watercooling" || /watercooling|aio|liquid/i.test(parts.cooler?.name ?? "");
  if (parts.cooler && !water) {
    const fins = new THREE.Group();
    for (let i = 0; i < 18; i++) {
      const fin = box(0.15, 12, 12, mat(C.metal, { metalness: 0.85, roughness: 0.3 }));
      fin.position.set(i * 0.5, 0, 0);
      fins.add(fin);
    }
    fins.position.set(cpuPos.x + 2.5, cpuPos.y + 1, cpuPos.z);
    tower.add(fins);
    const f = fan(5.8, isRgb(parts.cooler));
    f.rotation.y = Math.PI / 2;
    f.position.set(cpuPos.x + 2.5, cpuPos.y + 1, cpuPos.z + 6.5);
    tower.add(f);
  } else if (parts.cooler && water) {
    const pump = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 2, 24), mat(C.dark));
    pump.rotation.z = Math.PI / 2;
    pump.position.set(cpuPos.x + 1.3, cpuPos.y, cpuPos.z);
    tower.add(pump);
    const len = /420|3x140/i.test(parts.cooler.name) ? 45 : /360|3x120/i.test(parts.cooler.name) ? 39 : 27;
    const rad = box(12, 2.7, Math.min(len, D - 4), mat(C.dark, { metalness: 0.5 }));
    rad.position.set(0, H - 2.5, 0);
    tower.add(rad);
    const n = Math.round(Math.min(len, D - 4) / 12.5);
    for (let i = 0; i < n; i++) {
      const f = fan(5.6, isRgb(parts.cooler));
      f.rotation.x = Math.PI / 2;
      f.position.set(0, H - 4.2, -Math.min(len, D - 4) / 2 + 6.2 + i * 12.5);
      tower.add(f);
    }
  } else if (showGhosts && parts.cpu) {
    const g = ghost(10, 12, 12);
    g.position.set(cpuPos.x + 5, cpuPos.y + 1, cpuPos.z);
    tower.add(g);
  }

  // Mémoire : barrettes à droite du processeur.
  if (parts.ram) {
    const count = Number(parts.ram.name.match(/(\d) ?x/i)?.[1] ?? 2);
    for (let i = 0; i < Math.min(count, 4); i++) {
      const stick = box(3.2, 13.3, 0.7, mat(C.dark, { metalness: 0.5 }));
      stick.position.set(cpuPos.x + 1.8, cpuPos.y, cpuPos.z + 6 + i * 1.1);
      if (isRgb(parts.ram)) {
        const glow = box(0.6, 13.3, 0.72, new THREE.MeshStandardMaterial({ color: C.accent, emissive: C.accent, emissiveIntensity: 1.4 }));
        glow.position.set(1.6, 0, 0);
        stick.add(glow);
      }
      tower.add(stick);
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
      tower.add(m2);
    } else {
      const drive = box(7, 1, 10, mat(C.metal, { metalness: 0.7 }));
      drive.position.set(2, 3, D / 2 - 9);
      tower.add(drive);
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
    tower.add(g);
  } else if (showGhosts && parts.board) {
    const g = ghost(5, 12, 24);
    g.position.set(-W / 2 + 4.5, gpuY, -D / 2 + 13);
    tower.add(g);
  }

  // Alimentation en bas, à l'arrière.
  if (parts.psu) {
    const psu = box(15, 8.6, 14, mat(0x1b1e25, { metalness: 0.4 }));
    psu.position.set(-W / 2 + 8, 4.8, -D / 2 + 8);
    tower.add(psu);
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
  if (!parts.screen) screen.traverse((o) => o instanceof THREE.Mesh && ((o.material as THREE.Material).opacity = 0.35, ((o.material as THREE.Material).transparent = true)));
  desk.add(screen);

  if (parts.keyboard) {
    const kb = box(44, 2.5, 14, mat(0x2c313d));
    kb.position.set(-5, 77, 18);
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
    desk.add(chair);
  }

  // La tour, posée au sol à droite du bureau.
  const tower = buildTower(parts, false);
  tower.position.set(100, 0, -5);
  desk.add(tower);
  return desk;
}

function disposeGroup(g: THREE.Object3D) {
  g.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
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
