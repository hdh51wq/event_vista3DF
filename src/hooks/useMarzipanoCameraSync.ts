import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export function useMarzipanoCameraSync(viewer: unknown) {
  const viewerRef = useRef(viewer);
  viewerRef.current = viewer;
  const { camera } = useThree();

  useFrame(() => {
    const v = viewerRef.current as { view?: () => { yaw: () => number; pitch: () => number; fov: () => number } } | null;
    if (!v?.view) return;

    const view = v.view();
    if (!view) return;

    const yaw = view.yaw();
    const pitch = view.pitch();
    const fov = view.fov();

    if (!(camera instanceof THREE.PerspectiveCamera)) return;

    camera.position.set(0, 0, 0);
    camera.rotation.order = "YXZ";
    camera.rotation.y = -yaw;
    camera.rotation.x = -pitch;
    camera.fov = THREE.MathUtils.radToDeg(fov);
    camera.updateProjectionMatrix();
  });
}
