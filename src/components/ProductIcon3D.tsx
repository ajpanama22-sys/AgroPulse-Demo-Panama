"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type ProductoTipo = "huevo" | "pollo" | "cerdo" | "aba";

const MODELO: Record<"huevo" | "pollo" | "cerdo", string> = {
  huevo: "/models/huevo.glb",
  pollo: "/models/pollo.glb",
  cerdo: "/models/cerdo.glb",
};

// Los .glb son mallas sin textura ("white_mesh") — se pintan acá con el
// color real de cada producto en vez de dejarlas en gris de placeholder.
const COLOR: Record<"huevo" | "pollo" | "cerdo", number> = {
  huevo: 0xf7efe0,
  pollo: 0xd9a15c,
  cerdo: 0xeda8b8,
};

const gltfCache = new Map<string, Promise<THREE.Object3D>>();
function cargarModelo(url: string): Promise<THREE.Object3D> {
  if (!gltfCache.has(url)) {
    gltfCache.set(
      url,
      new Promise((resolve, reject) => {
        new GLTFLoader().load(url, (gltf) => resolve(gltf.scene), undefined, reject);
      }),
    );
  }
  return gltfCache.get(url)!;
}

function groundShadow(radius: number, opacity = 0.2) {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 48),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

export default function ProductIcon3D({ tipo, size = 120 }: { tipo: ProductoTipo; size?: number }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let cancelado = false;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 0.9, 5.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xfff4e6, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(3, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.5);
    fill.position.set(-4, 2, 3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffd9a8, 0.7);
    rim.position.set(-2, 3, -5);
    scene.add(rim);

    const group = new THREE.Group();
    scene.add(group);
    let raf: number;
    const clock = new THREE.Clock();

    if (tipo === "aba") {
      buildSilo(group);
    } else {
      group.add(groundShadow(1.3));
      cargarModelo(MODELO[tipo]).then((original) => {
        if (cancelado) return;
        const obj = original.clone(true);
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshPhysicalMaterial({ color: COLOR[tipo], roughness: 0.4, metalness: 0.05, clearcoat: 0.5, clearcoatRoughness: 0.3 });
          }
        });
        const box = new THREE.Box3().setFromObject(obj);
        const sizeVec = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        obj.position.sub(center);
        const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z) || 1;
        const modelo = new THREE.Group();
        modelo.add(obj);
        modelo.scale.setScalar(2.1 / maxDim);
        modelo.position.y = -0.15;
        group.add(modelo);
      });
    }

    const animate = () => {
      const t = clock.getElapsedTime();
      group.rotation.y = t * 0.7;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelado = true;
      cancelAnimationFrame(raf);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m.dispose());
        }
      });
    };
  }, [tipo, size]);

  return <div ref={mountRef} style={{ width: size, height: size, overflow: "hidden" }} />;
}

function buildSilo(group: THREE.Group) {
  const shadow = groundShadow(0.62, 0.18);
  shadow.position.y = -0.85;
  group.add(shadow);

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#c7cdd2";
  ctx.fillRect(0, 0, 64, 64);
  for (let x = 0; x < 64; x += 6) {
    const grad = ctx.createLinearGradient(x, 0, x + 6, 0);
    grad.addColorStop(0, "#b7bec4");
    grad.addColorStop(0.5, "#e4e8eb");
    grad.addColorStop(1, "#b7bec4");
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, 6, 64);
  }
  const corrugated = new THREE.CanvasTexture(canvas);
  corrugated.wrapS = THREE.RepeatWrapping;
  corrugated.repeat.set(10, 1);

  const scale = 0.62;
  const silo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72 * scale, 0.78 * scale, 1.7 * scale, 32),
    new THREE.MeshPhysicalMaterial({ map: corrugated, roughness: 0.45, metalness: 0.55, clearcoat: 0.3 }),
  );
  group.add(silo);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.82 * scale, 0.55 * scale, 32), new THREE.MeshPhysicalMaterial({ color: 0x8f979c, roughness: 0.35, metalness: 0.6, clearcoat: 0.4 }));
  roof.position.y = 1.12 * scale;
  group.add(roof);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * scale, 0.06 * scale, 0.22 * scale, 12), new THREE.MeshStandardMaterial({ color: 0x4f6b5c, roughness: 0.4 }));
  cap.position.y = 1.5 * scale;
  group.add(cap);

  for (const y of [0.35 * scale, -0.35 * scale]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.76 * scale, 0.028 * scale, 8, 32), new THREE.MeshStandardMaterial({ color: 0x4f6b5c, roughness: 0.4, metalness: 0.4 }));
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    group.add(band);
  }

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.62 * scale, 0.7 * scale, 0.35 * scale, 4), new THREE.MeshStandardMaterial({ color: 0x8b8f8c, roughness: 0.6 }));
  base.rotation.y = Math.PI / 4;
  base.position.y = -1.02 * scale;
  group.add(base);
}
