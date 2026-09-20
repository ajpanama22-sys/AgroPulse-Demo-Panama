"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export interface OrbitSlice {
  label: string;
  value: number;
  color: string;
}

/** Barras orbitales en volumen — el elemento "premium" del panel: EBITDA
 * por unidad de negocio girando lentamente, mismo lenguaje visual que
 * ZiMPLIFIKA/FLOTIA pero en la paleta charcoal/naranja del cliente. */
export default function OrbitBars3D({ data }: { data: OrbitSlice[] }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || data.length === 0) return;

    const width = mount.clientWidth || 300;
    const height = mount.clientHeight || 260;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(6.4, 5.4, 8.6);
    camera.lookAt(0, 1.6, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(5, 8, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xef7d1e, 0.5);
    rim.position.set(-6, 4, -4);
    scene.add(rim);

    const base = new THREE.Mesh(
      new THREE.CircleGeometry(4.6, 48),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.05, transparent: true, opacity: 0.5 }),
    );
    base.rotation.x = -Math.PI / 2;
    scene.add(base);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(4.55, 4.62, 64),
      new THREE.MeshBasicMaterial({ color: 0xef7d1e, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }),
    );
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);

    const maxVal = Math.max(...data.map((d) => d.value), 0.01);
    const group = new THREE.Group();
    const n = data.length;
    const radius = 2.6;

    data.forEach((d, i) => {
      const angle = (i / n) * Math.PI * 2;
      const barHeight = (d.value / maxVal) * 4.2 + 0.15;
      const geo = new THREE.BoxGeometry(0.85, barHeight, 0.85);
      const color = new THREE.Color(d.color);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.25, emissive: color, emissiveIntensity: 0.18 });
      const bar = new THREE.Mesh(geo, mat);
      bar.position.set(Math.cos(angle) * radius, barHeight / 2, Math.sin(angle) * radius);
      group.add(bar);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.9), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 }));
      cap.position.set(Math.cos(angle) * radius, barHeight + 0.03, Math.sin(angle) * radius);
      group.add(cap);
    });

    scene.add(group);

    let raf: number;
    const animate = () => {
      group.rotation.y += 0.0032;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      const w = mount.clientWidth,
        h = mount.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [data]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}
"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export interface OrbitSlice {
  label: string;
  value: number;
  color: string;
}

/** Barras orbitales en volumen — el elemento "premium" del panel: EBITDA
 * por unidad de negocio girando lentamente, mismo lenguaje visual que
 * ZiMPLIFIKA/FLOTIA pero en la paleta charcoal/naranja del cliente. */
export default function OrbitBars3D({ data }: { data: OrbitSlice[] }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || data.length === 0) return;

    const width = mount.clientWidth || 300;
    const height = mount.clientHeight || 260;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(6.4, 5.4, 8.6);
    camera.lookAt(0, 1.6, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(5, 8, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xef7d1e, 0.5);
    rim.position.set(-6, 4, -4);
    scene.add(rim);

    const base = new THREE.Mesh(
      new THREE.CircleGeometry(4.6, 48),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.05, transparent: true, opacity: 0.5 }),
    );
    base.rotation.x = -Math.PI / 2;
    scene.add(base);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(4.55, 4.62, 64),
      new THREE.MeshBasicMaterial({ color: 0xef7d1e, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }),
    );
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);

    const maxVal = Math.max(...data.map((d) => d.value), 0.01);
    const group = new THREE.Group();
    const n = data.length;
    const radius = 2.6;

    data.forEach((d, i) => {
      const angle = (i / n) * Math.PI * 2;
      const barHeight = (d.value / maxVal) * 4.2 + 0.15;
      const geo = new THREE.BoxGeometry(0.85, barHeight, 0.85);
      const color = new THREE.Color(d.color);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.25, emissive: color, emissiveIntensity: 0.18 });
      const bar = new THREE.Mesh(geo, mat);
      bar.position.set(Math.cos(angle) * radius, barHeight / 2, Math.sin(angle) * radius);
      group.add(bar);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.9), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 }));
      cap.position.set(Math.cos(angle) * radius, barHeight + 0.03, Math.sin(angle) * radius);
      group.add(cap);
    });

    scene.add(group);

    let raf: number;
    const animate = () => {
      group.rotation.y += 0.0032;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      const w = mount.clientWidth,
        h = mount.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [data]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}
"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export interface OrbitSlice {
  label: string;
  value: number;
  color: string;
}

/** Barras orbitales en volumen — el elemento "premium" del panel: EBITDA
 * por unidad de negocio girando lentamente, mismo lenguaje visual que
 * ZiMPLIFIKA/FLOTIA pero en la paleta charcoal/naranja de JHS. */
export default function OrbitBars3D({ data }: { data: OrbitSlice[] }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || data.length === 0) return;

    const width = mount.clientWidth || 300;
    const height = mount.clientHeight || 260;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(6.4, 5.4, 8.6);
    camera.lookAt(0, 1.6, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(5, 8, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xef7d1e, 0.5);
    rim.position.set(-6, 4, -4);
    scene.add(rim);

    const base = new THREE.Mesh(
      new THREE.CircleGeometry(4.6, 48),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.05, transparent: true, opacity: 0.5 }),
    );
    base.rotation.x = -Math.PI / 2;
    scene.add(base);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(4.55, 4.62, 64),
      new THREE.MeshBasicMaterial({ color: 0xef7d1e, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }),
    );
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);

    const maxVal = Math.max(...data.map((d) => d.value), 0.01);
    const group = new THREE.Group();
    const n = data.length;
    const radius = 2.6;

    data.forEach((d, i) => {
      const angle = (i / n) * Math.PI * 2;
      const barHeight = (d.value / maxVal) * 4.2 + 0.15;
      const geo = new THREE.BoxGeometry(0.85, barHeight, 0.85);
      const color = new THREE.Color(d.color);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.25, emissive: color, emissiveIntensity: 0.18 });
      const bar = new THREE.Mesh(geo, mat);
      bar.position.set(Math.cos(angle) * radius, barHeight / 2, Math.sin(angle) * radius);
      group.add(bar);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.9), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 }));
      cap.position.set(Math.cos(angle) * radius, barHeight + 0.03, Math.sin(angle) * radius);
      group.add(cap);
    });

    scene.add(group);

    let raf: number;
    const animate = () => {
      group.rotation.y += 0.0032;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      const w = mount.clientWidth,
        h = mount.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [data]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}
