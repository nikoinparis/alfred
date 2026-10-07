"use client";

import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { MUSCLE_META } from "@/lib/domain/muscles";
import { MUSCLES, type Muscle } from "@/lib/domain/types";
import { cn } from "@/lib/cn";
import type { HeatCell, HeatStatus } from "./body-map-2d";

/**
 * Anatomical écorché built from BodyParts3D (© DBCLS, CC BY 4.0) by scripts/body-model/build.mjs.
 * Every app muscle group is its own mesh, named by its key, so colouring and picking are by name.
 */
const MODEL_URL = "/models/body.glb";

const HEAT: Record<HeatStatus, string> = {
  untrained: "#d0675f",
  below: "#dcae55",
  hit: "#55b597",
};

/** Pastel study palette, in the spirit of colour-coded anatomy references. */
const ANATOMY: Record<Muscle, string> = {
  chest: "#e89a8f",
  frontDelts: "#d98fb4",
  sideDelts: "#cc8fc0",
  rearDelts: "#b98fc9",
  triceps: "#9f9ad6",
  biceps: "#b48ad1",
  forearms: "#8fc9a0",
  upperBack: "#e6a07f",
  lats: "#8fa6d9",
  lowerBack: "#d6b07a",
  abs: "#e8857f",
  obliques: "#8f9fd1",
  glutes: "#d68fa8",
  quads: "#e8988a",
  hamstrings: "#a3c98f",
  adductors: "#c6a3d6",
  calves: "#8fc4c9",
};

const NEUTRAL: Record<string, { color: string; roughness: number }> = {
  otherMuscles: { color: "#b9a6a1", roughness: 0.7 },
  tendons: { color: "#e6dccb", roughness: 0.55 },
  bones: { color: "#e3d8c4", roughness: 0.6 },
  skin: { color: "#d8c3b2", roughness: 0.65 },
};

export type BodyColorMode = "heat" | "anatomy";

function Body({
  heat,
  selected,
  hovered,
  mode,
  onSelect,
  onHover,
}: {
  heat: Record<Muscle, HeatCell>;
  selected: Muscle | null;
  hovered: Muscle | null;
  mode: BodyColorMode;
  onSelect: (m: Muscle) => void;
  onHover: (m: Muscle | null) => void;
}) {
  const gltf = useGLTF(MODEL_URL, false, true);
  const meshes = useMemo(() => {
    const out: { name: string; geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh;
        out.push({ name: mesh.name || mesh.parent?.name || "", geometry: mesh.geometry, matrix: mesh.matrixWorld.clone() });
      }
    });
    return out;
  }, [gltf]);

  return (
    <group>
      {meshes.map(({ name, geometry, matrix }) => {
        const muscle = (MUSCLES as readonly string[]).includes(name) ? (name as Muscle) : null;
        if (!muscle) {
          const n = NEUTRAL[name] ?? NEUTRAL.otherMuscles;
          return (
            <mesh key={name} geometry={geometry} matrixAutoUpdate={false} matrix={matrix} castShadow receiveShadow>
              <meshStandardMaterial color={n.color} roughness={n.roughness} metalness={0} />
            </mesh>
          );
        }
        const cell = heat[muscle];
        const base = mode === "heat" ? HEAT[cell.status] : ANATOMY[muscle];
        const isSel = selected === muscle;
        const isHover = hovered === muscle;
        const dim = selected !== null && !isSel;
        return (
          <mesh
            key={name}
            geometry={geometry}
            matrixAutoUpdate={false}
            matrix={matrix}
            castShadow
            receiveShadow
            onClick={(e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              onSelect(muscle);
            }}
            onPointerOver={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              onHover(muscle);
            }}
            onPointerOut={() => onHover(null)}
          >
            <meshStandardMaterial
              color={base}
              roughness={0.62}
              metalness={0}
              emissive={base}
              emissiveIntensity={isSel ? 0.35 : isHover ? 0.2 : 0}
              transparent={dim}
              opacity={dim ? 0.55 : 1}
              side={muscle === "abs" || muscle === "lats" ? THREE.DoubleSide : THREE.FrontSide}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/** Swings the camera to face the front or back when `side` changes; free orbiting otherwise. */
function CameraRig({ side, target }: { side: "front" | "back"; target: [number, number, number] }) {
  const { camera, controls } = useThree() as unknown as {
    camera: THREE.Camera;
    controls: { target: THREE.Vector3; update: () => void } | null;
  };
  const goal = useRef<number | null>(null);
  useEffect(() => {
    goal.current = side === "front" ? 0 : Math.PI;
  }, [side]);
  useFrame((_, dt) => {
    if (goal.current === null || !controls) return;
    const t = new THREE.Vector3(...target);
    const offset = camera.position.clone().sub(t);
    const radius = Math.hypot(offset.x, offset.z);
    const angle = Math.atan2(offset.x, offset.z);
    let diff = goal.current - angle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    if (Math.abs(diff) < 0.002) {
      goal.current = null;
      return;
    }
    const next = angle + diff * Math.min(1, dt * 7);
    camera.position.set(t.x + Math.sin(next) * radius, camera.position.y, t.z + Math.cos(next) * radius);
    controls.update();
  });
  return null;
}

const TARGET: [number, number, number] = [0, 0.88, 0];

export default function BodyMap3D({
  heat,
  selected,
  onSelect,
  side = "front",
}: {
  heat: Record<Muscle, HeatCell>;
  selected: Muscle | null;
  onSelect: (m: Muscle) => void;
  side?: "front" | "back";
}) {
  const [hovered, setHovered] = useState<Muscle | null>(null);
  const [interacted, setInteracted] = useState(false);
  const [mode, setMode] = useState<BodyColorMode>("heat");
  const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div className="relative h-full w-full" style={{ cursor: hovered ? "pointer" : "grab", touchAction: "none" }}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0.95, 4.1], fov: 30 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.25} />
        <directionalLight position={[1.5, 3, 2.5]} intensity={1.6} color="#fff4e6" castShadow shadow-mapSize={[1024, 1024]} />
        <directionalLight position={[-2, 2, -2.5]} intensity={0.9} color="#9ab8d8" />
        <Environment resolution={256}>
          <Lightformer intensity={1.4} position={[0, 3, 3]} scale={[6, 2, 1]} color="#ffffff" />
          <Lightformer intensity={0.6} position={[-4, 1, 0]} rotation-y={Math.PI / 2} scale={[4, 3, 1]} color="#c9d8ea" />
          <Lightformer intensity={0.5} position={[4, 1, -1]} rotation-y={-Math.PI / 2} scale={[4, 3, 1]} color="#f2dcc0" />
        </Environment>
        <Suspense fallback={null}>
          <Body heat={heat} selected={selected} hovered={hovered} mode={mode} onSelect={onSelect} onHover={setHovered} />
        </Suspense>
        <ContactShadows position={[0, 0.001, 0]} opacity={0.55} scale={2.5} blur={2.6} far={1} />
        <OrbitControls
          makeDefault
          target={TARGET}
          enablePan={false}
          minDistance={1.2}
          maxDistance={5}
          minPolarAngle={0.3}
          maxPolarAngle={1.75}
          autoRotate={!interacted && !reduceMotion}
          autoRotateSpeed={0.7}
          onStart={() => setInteracted(true)}
        />
        <CameraRig side={side} target={TARGET} />
      </Canvas>

      <div className="absolute left-3 top-3 flex rounded-full bg-black/40 p-[3px] text-xs font-semibold backdrop-blur-md">
        {(["heat", "anatomy"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={cn("h-8 rounded-full px-3 transition-colors", mode === m ? "bg-white/20 text-bone" : "text-fog-2")}
          >
            {m === "heat" ? "This week" : "Anatomy"}
          </button>
        ))}
      </div>
      {hovered && (
        <p className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold backdrop-blur-md">
          {MUSCLE_META[hovered].label}
        </p>
      )}
      <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-xs text-fog">
        Drag to rotate · pinch to zoom · tap a muscle
      </p>
    </div>
  );
}

useGLTF.preload(MODEL_URL, false, true);
