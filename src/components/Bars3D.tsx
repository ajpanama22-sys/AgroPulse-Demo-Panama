"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export interface Bar3DDatum {
  label: string;
  value: number;
  meta?: number;
}

/** Barras en volumen con bisel real (ExtrudeGeometry), color naranja de
 * marca con degradé de intensidad, más una línea de meta flotando sobre
 * cada barra — reemplaza el bar chart 2D plano por uno que realmente gira
 * en el espacio para leerse "vivo" en vez de una imagen estática. */
export default function Bars3D({ data, height = 260 }: { data: Bar3DDatum[]; height?: number }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || data.length === 0) return;

    const width = mount.clientWidth || 480;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 3.6, 10.5);
    camera.lookAt(0, 1.1, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(4, 7, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xef7d1e, 0.5);
    rim.position.set(-5, 3, -4);
    scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, transparent: true, opacity: 0.4 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    scene.add(floor);

    const n = data.length;
    const maxVal = Math.max(...data.map((d) => Math.max(d.value, d.meta ?? 0)), 1);
    const spacing = 1.5;
    const totalWidth = (n - 1) * spacing;
    const group = new THREE.Group();

    const roundedBoxShape = (w: number, d: number, r: number) => {
      const shape = new THREE.Shape();
      shape.moveTo(-w / 2 + r, -d / 2);
      shape.lineTo(w / 2 - r, -d / 2);
      shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + r);
      shape.lineTo(w / 2, d / 2 - r);
      shape.quadraticCurveTo(w / 2, d / 2, w / 2 - r, d / 2);
      shape.lineTo(-w / 2 + r, d / 2);
      shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - r);
      shape.lineTo(-w / 2, -d / 2 + r);
      shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + r, -d / 2);
      return shape;
    };

    data.forEach((d, i) => {
      const barHeight = (d.value / maxVal) * 2.6 + 0.05;
      const shape = roundedBoxShape(0.75, 0.75, 0.12);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: barHeight, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3, curveSegments: 8 });
      geo.rotateX(-Math.PI / 2);
      const t = i / Math.max(n - 1, 1);
      const color = new THREE.Color("#ef7d1e").lerp(new THREE.Color("#ffbf80"), 1 - t * 0.5);
      const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0.15, clearcoat: 0.5, emissive: color, emissiveIntensity: 0.08 });
      const bar = new THREE.Mesh(geo, mat);
      bar.position.set(i * spacing - totalWidth / 2, 0, 0);
      group.add(bar);

      if (d.meta) {
        const metaHeight = (d.meta / maxVal) * 2.6;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.02, 8, 24), new THREE.MeshBasicMaterial({ color: 0x3c3c3a, transparent: true, opacity: 0.4 }));
        ring.rotation.x = Math.PI / 2;
        ring.position.set(i * spacing - totalWidth / 2, metaHeight, 0);
        group.add(ring);
      }
    });

    scene.add(group);

    let raf: number;
    const clock = new THREE.Clock();
    const baseY = -0.4;
    group.position.y = baseY;
    const animate = () => {
      const t = clock.getElapsedTime();
      group.rotation.y = Math.sin(t * 0.25) * 0.18;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      const w = mount.clientWidth;
      if (!w) return;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [data, height]);

  return (
    <div style={{ position: "relative", width: "100%", height }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", pointerEvents: "none", flexDirection: "column", justifyContent: "space-between" }}>
        <div style={{ display: "flex", paddingTop: 4 }}>
          {data.map((d, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#3c3c3a" }}>{Math.round(d.value).toLocaleString("en-US")}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", paddingBottom: 6 }}>
          {data.map((d, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center" }}>
              <span style={{ fontSize: 11, color: "#736f64" }}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
