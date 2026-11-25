"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

export interface PanoramaViewerHandle {
  /** The live Marzipano RectilinearView — use to project coords */
  getView: () => MarzipanoView | null;
  /** The container element — needed for bounds */
  getContainer: () => HTMLDivElement | null;
  /** The live Marzipano Viewer instance */
  getViewer: () => unknown | null;
}

/** Minimal typings for the parts of Marzipano we actually use */
export interface MarzipanoView {
  yaw: () => number;
  pitch: () => number;
  fov: () => number;
  setParameters: (p: { yaw: number; pitch: number; fov: number }) => void;
  coordinatesToScreen: (
    coords: { yaw: number; pitch: number },
    dest?: { x: number; y: number }
  ) => { x: number; y: number } | null;
  screenToCoordinates: (
    screen: { x: number; y: number },
    dest?: { yaw: number; pitch: number }
  ) => { yaw: number; pitch: number } | null;
}

/**
 * Polyhaven panoramas are huge (Grand Hall is 8192x4096, ~6 MB; Dancing
 * Hall is ~42 MB) and dl.polyhaven.org sends no CORS headers, so Marzipano
 * loading them directly is both slow and broken (black view).
 *
 * Route those through Next.js' built-in image optimizer, which fetches and
 * resizes server-side and serves the result same-origin:
 *  - same-origin bytes, so no CORS problem for Marzipano;
 *  - 8192px wide down to 3840px (the widest the optimizer allows by
 *    default — w=4096 is rejected), ~6 MB down to under 1 MB;
 *  - Vercel caches the optimized image, so repeat visits are fast.
 * Everything else (Cloudinary, data URLs, relative paths) passes through
 * untouched.
 */
function resolvePanoramaSrc(src: string): string {
  try {
    const host = new URL(src).hostname;
    const isPolyhaven =
      host === "dl.polyhaven.org" ||
      host === "polyhaven.org" ||
      host.endsWith(".polyhaven.org") ||
      host.endsWith(".polyhaven.com");
    if (isPolyhaven) {
      return `/_next/image?url=${encodeURIComponent(src)}&w=3840&q=75`;
    }
  } catch {
    // Relative URLs, data URLs, etc. — leave as-is.
  }
  return src;
}

interface PanoramaViewerProps {
  src: string;
  className?: string;
}

const PanoramaViewer = forwardRef<PanoramaViewerHandle, PanoramaViewerProps>(
  function PanoramaViewer({ src, className }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<MarzipanoView | null>(null);
    const viewerRef = useRef<unknown>(null);

    useImperativeHandle(ref, () => ({
      getView: () => viewRef.current,
      getContainer: () => containerRef.current,
      getViewer: () => viewerRef.current,
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      let destroyed = false;

      // Start downloading the panorama right away, in parallel with the
      // Marzipano import below — previously the download only started
      // after the import finished, and the viewer showed nothing until
      // the whole file arrived. Marzipano reuses the cached image.
      const resolvedSrc = resolvePanoramaSrc(src);
      const preload = new Image();
      preload.src = resolvedSrc;

      import("marzipano").then((Marzipano) => {
        if (destroyed || !containerRef.current) return;

        if (viewerRef.current) {
          (viewerRef.current as { destroy: () => void }).destroy();
          viewerRef.current = null;
          viewRef.current = null;
        }

        const viewer = new Marzipano.Viewer(containerRef.current, {
          controls: { mouseViewMode: "drag" },
        });
        viewerRef.current = viewer;

        const source = Marzipano.ImageUrlSource.fromString(resolvedSrc);
        const geometry = new Marzipano.EquirectGeometry([{ width: 3840 }]);

        const limiter = Marzipano.RectilinearView.limit.vfov(
          (30 * Math.PI) / 180,
          (120 * Math.PI) / 180
        );

        const view = new Marzipano.RectilinearView(
          { yaw: 0, pitch: 0, fov: (90 * Math.PI) / 180 },
          limiter
        );

        viewRef.current = view as unknown as MarzipanoView;

        const scene = viewer.createScene({ source, geometry, view });
        scene.switchTo({ transitionDuration: 1000 });
      });

      return () => {
        destroyed = true;
        viewRef.current = null;
        if (viewerRef.current) {
          (viewerRef.current as { destroy: () => void }).destroy();
          viewerRef.current = null;
        }
      };
    }, [src]);

    return (
      <div
        ref={containerRef}
        className={`w-full h-full ${className ?? ""}`}
        style={{ minHeight: 0, cursor: "grab" }}
      />
    );
  }
);

export default PanoramaViewer;
