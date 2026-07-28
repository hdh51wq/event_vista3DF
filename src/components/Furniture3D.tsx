"use client";

import { useGLTF } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { yawPitchToPosition } from "@/lib/yawPitchToPosition";

export interface Furniture3DProps {
  glbPath: string;
  yaw: number;
  pitch: number;
  scale?: number;
  rotationY?: number;
  radius?: number;
}

export function Furniture3D({
  glbPath,
  yaw,
  pitch,
  scale = 3.0,
  rotationY = 0,
  radius = 5,
}: Furniture3DProps) {
  const { scene } = useGLTF(glbPath);
  const ref = useRef<THREE.Group>(null);

  const clonedScene = useMemo(() => {
    const clone = scene.clone();

    clone.traverse((child: THREE.Object3D) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (!mesh.material) {
          mesh.material = new THREE.MeshStandardMaterial({
            color: "#8B5A3C",
            roughness: 0.8,
            metalness: 0.1,
          });
        }
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          material.side = THREE.FrontSide;
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    return clone;
  }, [scene]);

  const position = yawPitchToPosition(yaw, pitch, radius);
  const facingYaw = yaw + Math.PI;

  return (
    <group
      ref={ref}
      position={position}
      rotation={[0, facingYaw + rotationY, 0]}
      scale={[scale, scale, scale]}
    >
      <primitive object={clonedScene} />
    </group>
  );
}

useGLTF.preload("/furniture/sofa.glb");
useGLTF.preload("/furniture/chair.glb");
useGLTF.preload("/furniture/table.glb");
