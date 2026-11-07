import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const ThreeEscrowVisual: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    const width = currentMount.clientWidth || 300;
    const height = currentMount.clientHeight || 300;

    let renderer: THREE.WebGLRenderer | null = null;
    let animationFrameId: number;
    let coreGeometry: THREE.IcosahedronGeometry | null = null;
    let coreMaterial: THREE.MeshBasicMaterial | null = null;
    let cageGeometry: THREE.IcosahedronGeometry | null = null;
    let cageMaterial: THREE.MeshBasicMaterial | null = null;

    try {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.z = 4.5;

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default' });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      currentMount.appendChild(renderer.domElement);

      // Inner Core - Electric Blue (#1F61EF)
      coreGeometry = new THREE.IcosahedronGeometry(1.2, 1);
      coreMaterial = new THREE.MeshBasicMaterial({
        color: 0x1F61EF,
        wireframe: true,
        transparent: true,
        opacity: 0.75,
      });
      const core = new THREE.Mesh(coreGeometry, coreMaterial);
      scene.add(core);

      // Outer Cage - Soft Silver (#E8EAE6)
      cageGeometry = new THREE.IcosahedronGeometry(1.8, 0);
      cageMaterial = new THREE.MeshBasicMaterial({
        color: 0xE8EAE6,
        wireframe: true,
        transparent: true,
        opacity: 0.35,
      });
      const cage = new THREE.Mesh(cageGeometry, cageMaterial);
      scene.add(cage);

      const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        core.rotation.x += 0.005;
        core.rotation.y += 0.007;
        cage.rotation.x -= 0.003;
        cage.rotation.y -= 0.004;
        if (renderer) {
          renderer.render(scene, camera);
        }
      };
      animate();

      const handleResize = () => {
        if (!currentMount || !renderer) return;
        const newWidth = currentMount.clientWidth;
        const newHeight = currentMount.clientHeight;
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
      };

      window.addEventListener('resize', handleResize);

      return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', handleResize);
        if (renderer && currentMount.contains(renderer.domElement)) {
          currentMount.removeChild(renderer.domElement);
        }
        coreGeometry?.dispose();
        coreMaterial?.dispose();
        cageGeometry?.dispose();
        cageMaterial?.dispose();
        renderer?.dispose();
      };
    } catch (e) {
      console.warn('WebGL initialization skipped:', e);
      return () => {};
    }
  }, []);

  return (
    <div
      ref={mountRef}
      className="w-full h-64 md:h-80 flex items-center justify-center overflow-hidden"
    />
  );
};
