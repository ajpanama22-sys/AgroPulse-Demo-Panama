"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

/** Dona en volumen — cada porción es un anillo extruido con bisel real
 * (ExtrudeGeometry + bevelEnabled), no un plano pintado. Gira despacio
 * sobre su eje; colores vívidos con un toque de metalness para que el
 * bisel capture la luz. Usado en el comparador para mostrar composición
 * (EBITDA/Ingresos por unidad) de un período. */
export default function Donut3D({ data, size = 260 }: { data: DonutSlice[]; size?: number }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || data.length === 0) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
    camera.position.set(0, 3.6, 5.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(4, 6, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.4);
    rim.position.set(-5, 3, -4);
    scene.add(rim);

    const group = new THREE.Group();
    group.rotation.x = -Math.PI / 2.6;
    scene.add(group);

    const total = data.reduce((s, d) => s + Math.max(d.value, 0), 0) || 1;
    const innerR = 1.15;
    const outerR = 2.1;
    const depth = 0.55;
    const gap = 0.025;
    let angle = -Math.PI / 2;

    for (const d of data) {
      const frac = Math.max(d.value, 0) / total;
      const span = frac * Math.PI * 2 - gap;
      const start = angle;
      const end = angle + Math.max(span, 0.001);

      const shape = new THREE.Shape();
      shape.moveTo(Math.cos(start) * outerR, Math.sin(start) * outerR);
      shape.absarc(0, 0, outerR, start, end, false);
      shape.absarc(0, 0, innerR, end, start, true);

      const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.07, bevelSegments: 4, curveSegments: 32 });
      geo.translate(0, 0, -depth / 2);
      const color = new THREE.Color(d.color);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.4, emissive: color, emissiveIntensity: 0.12 });
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);

      angle = end + gap;
    }

    let raf: number;
    const animate = () => {
      group.rotation.z += 0.006;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    };
  }, [data, size]);

  return <div ref={mountRef} style={{ width: size, height: size }} />;
}
