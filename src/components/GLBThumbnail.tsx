'use client'
import { useEffect, useRef, useState } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { useGLTF, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Suspense } from 'react'

function ModelCapture({ 
  glbPath, 
  onCapture 
}: { 
  glbPath: string
  onCapture: (dataUrl: string) => void 
}) {
  const { scene: gltfScene } = useGLTF(glbPath)
  const { gl, scene, camera } = useThree()
  const captured = useRef(false)

  useEffect(() => {
    // Center and fit model
    const box = new THREE.Box3().setFromObject(gltfScene)
    const center = new THREE.Vector3()
    const size = new THREE.Vector3()
    box.getCenter(center)
    box.getSize(size)
    
    gltfScene.position.sub(center)
    
    const maxDim = Math.max(size.x, size.y, size.z)
    const cam = camera as THREE.PerspectiveCamera
    cam.position.set(maxDim, maxDim * 0.8, maxDim * 1.5)
    cam.lookAt(0, 0, 0)
    cam.updateProjectionMatrix()
  }, [gltfScene, camera])

  useFrame(() => {
    if (captured.current) return
    captured.current = true
    
    gl.render(scene, camera)
    const dataUrl = gl.domElement.toDataURL('image/png')
    onCapture(dataUrl)
  })

  return (
    <>
      <ambientLight intensity={2} />
      <directionalLight position={[5, 5, 5]} intensity={1.5} />
      <primitive object={gltfScene} />
    </>
  )
}

interface GLBThumbnailProps {
  glbPath: string
  width?: number
  height?: number
  className?: string
  style?: React.CSSProperties
}

export function GLBThumbnail({ 
  glbPath, 
  width = 80, 
  height = 80,
  className,
  style
}: GLBThumbnailProps) {
  const [thumbnail, setThumbnail] = useState<string | null>(null)

  if (thumbnail) {
    return (
      <img 
        src={thumbnail} 
        width={width} 
        height={height}
        className={className}
        style={{ objectFit: 'contain', ...style }}
        alt="3D furniture preview"
      />
    )
  }

  return (
    <div style={{ width, height, position: 'relative' }}>
      <Canvas
        gl={{ 
          alpha: true, 
          preserveDrawingBuffer: true,
          antialias: true 
        }}
        style={{ 
          width, 
          height,
          background: 'transparent' 
        }}
        camera={{ fov: 45 }}
      >
        <Suspense fallback={null}>
          <ModelCapture 
            glbPath={glbPath} 
            onCapture={setThumbnail} 
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
