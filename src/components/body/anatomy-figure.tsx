"use client";

import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { Environment, Lightformer, useGLTF } from "@react-three/drei";
import { Suspense, useLayoutEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { MUSCLE_META } from "@/lib/domain/muscles";
import { MUSCLES, type Muscle } from "@/lib/domain/types";
import { cn } from "@/lib/cn";

/**
 * Anatomical figure (BodyParts3D, © DBCLS, CC BY 4.0; built by scripts/body-model/build.mjs),
 * shown as front and back side by side with a fixed orthographic camera, so it reads like an
 * anatomy plate rather than a 3D toy. Each muscle group is its own mesh, picked by name.
 */
export const MODEL_URL = "/models/body.glb";

export type HeatStatus = "untrained" | "below" | "hit";
export interface HeatCell {
  status: HeatStatus;
  /** 0–1, fraction of target. */
  fraction: number;
}

/** "light": ivory bones/tendons like an écorché plate. "muted": everything not coloured recedes. */
type Tone = "light" | "muted";

const NEUTRAL: Record<Tone, Record<string, string>> = {
  light: { otherMuscles: "#a99a96", tendons: "#e8e0d2", bones: "#e2d8c6", skin: "#d6c4b4", muscle: "#a99a96" },
  muted: { otherMuscles: "#363d47", tendons: "#4a515c", bones: "#4a515c", skin: "#414852", muscle: "#3a424d" },
};

interface FigureProps {
  /** Colour per muscle; return null to draw it neutral. */
  colorOf: (m: Muscle) => string | null;
  tone?: Tone;
  selected?: Muscle | null;
  onSelect?: (m: Muscle) => void;
  className?: string;
  /** Show "Front"/"Back" captions. */
  captions?: boolean;
}

/** Zooms the orthographic camera so both figures fill the canvas, re-fitting on resize. */
function FitCamera() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    // World extents: two figures ~0.75 m wide each with a gap, ~1.82 m tall.
    const zoom = Math.min(size.width / 1.62, size.height / 1.9);
    // three.js cameras are mutable scene objects; updating them in place is the intended API.
    // eslint-disable-next-line react-hooks/immutability
    camera.zoom = zoom;
    camera.position.set(0, 0.9, 5);
    camera.lookAt(0, 0.9, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size, invalidate]);
  return null;
}

function Bodies({
  colorOf,
  tone,
  selected,
  onSelect,
  onHover,
  hovered,
}: Required<Pick<FigureProps, "colorOf" | "tone">> & {
  selected: Muscle | null;
  onSelect?: (m: Muscle) => void;
  onHover: (m: Muscle | null) => void;
  hovered: Muscle | null;
}) {
  const gltf = useGLTF(MODEL_URL, false, true);
  const meshes = useMemo(() => {
    // Positions are quantized (KHR_mesh_quantization), so each mesh carries a dequantizing transform.
    const out: { name: string; geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh)
        out.push({ name: o.name || o.parent?.name || "", geometry: (o as THREE.Mesh).geometry, matrix: o.matrixWorld.clone() });
    });
    return out;
  }, [gltf]);
  const neutral = NEUTRAL[tone];

  const parts = meshes.map(({ name, geometry, matrix }) => {
    const muscle = (MUSCLES as readonly string[]).includes(name) ? (name as Muscle) : null;
    const color = muscle ? (colorOf(muscle) ?? neutral.muscle) : (neutral[name] ?? neutral.otherMuscles);
    const isSel = muscle !== null && selected === muscle;
    const isHover = muscle !== null && hovered === muscle;
    return { name, geometry, matrix, muscle, color, isSel, isHover };
  });

  const view = (rotation: number, x: number) => (
    <group position={[x, 0, 0]} rotation={[0, rotation, 0]}>
      {parts.map(({ name, geometry, matrix, muscle, color, isSel, isHover }) => (
        <mesh
          key={name}
          geometry={geometry}
          matrixAutoUpdate={false}
          matrix={matrix}
          onClick={
            muscle && onSelect
              ? (e: ThreeEvent<MouseEvent>) => {
                  e.stopPropagation();
                  onSelect(muscle);
                }
              : undefined
          }
          onPointerOver={
            muscle && onSelect
              ? (e: ThreeEvent<PointerEvent>) => {
                  e.stopPropagation();
                  onHover(muscle);
                }
              : undefined
          }
          onPointerOut={muscle && onSelect ? () => onHover(null) : undefined}
        >
          <meshStandardMaterial
            color={color}
            roughness={muscle ? 0.58 : 0.7}
            metalness={0}
            emissive={color}
            emissiveIntensity={isSel ? 0.32 : isHover ? 0.18 : 0}
            side={muscle === "abs" || muscle === "lats" || muscle === "lowerBack" || name === "skin" ? THREE.DoubleSide : THREE.FrontSide}
          />
        </mesh>
      ))}
    </group>
  );

  return (
    <>
      {view(0, -0.39)}
      {view(Math.PI, 0.39)}
    </>
  );
}

export function AnatomyFigure({ colorOf, tone = "light", selected = null, onSelect, className, captions = true }: FigureProps) {
  const [hovered, setHovered] = useState<Muscle | null>(null);
  return (
    <div className={cn("relative", className)} style={{ cursor: hovered ? "pointer" : "default" }}>
      <Canvas
        orthographic
        camera={{ position: [0, 0.9, 5], zoom: 100, near: 0.1, far: 20 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        frameloop="demand"
      >
        <FitCamera />
        <ambientLight intensity={0.35} />
        <directionalLight position={[1.2, 3, 4]} intensity={1.5} color="#fff6ec" />
        <directionalLight position={[-1.5, 1.5, -4]} intensity={1.2} color="#bcd2f0" />
        <Suspense fallback={null}>
          <Environment resolution={128}>
            <Lightformer intensity={1.2} position={[0, 3, 4]} scale={[6, 2, 1]} />
            <Lightformer intensity={0.8} position={[0, 2, -4]} rotation-y={Math.PI} scale={[6, 2, 1]} color="#cfe0ff" />
          </Environment>
          <Bodies colorOf={colorOf} tone={tone} selected={selected} onSelect={onSelect} onHover={setHovered} hovered={hovered} />
        </Suspense>
      </Canvas>
      {captions && (
        <div className="pointer-events-none absolute inset-x-0 bottom-1 grid grid-cols-2 text-center text-xs font-semibold text-fog">
          <span>Front</span>
          <span>Back</span>
        </div>
      )}
      {hovered && (
        <p className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-bone">
          {MUSCLE_META[hovered].label}
        </p>
      )}
    </div>
  );
}

useGLTF.preload(MODEL_URL, false, true);
