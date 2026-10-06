"use client";

import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { useMemo, useState } from "react";
import type { Muscle } from "@/lib/domain/types";
import type { HeatCell, HeatStatus } from "./body-map-2d";

type V3 = [number, number, number];

interface Part {
  shape: "sphere" | "capsule" | "box";
  position: V3;
  scale: V3;
  rotation?: V3;
  /** Also place a copy at -x. */
  mirror?: boolean;
  /** Capsule length. */
  length?: number;
}

/**
 * Stylised low-poly figure built from primitives: a dark "suit" mannequin with
 * muscle plates layered on top. Each muscle is one or more ellipsoids, so new
 * regions are just data. Units ≈ 0.5 m, y up, +z faces the viewer.
 */
const BASE: Part[] = [
  { shape: "sphere", position: [0, 3.25, 0], scale: [0.25, 0.3, 0.27] },
  { shape: "capsule", position: [0, 2.93, -0.02], scale: [0.12, 1, 0.12], length: 0.14 },
  { shape: "capsule", position: [0, 2.25, 0], scale: [0.44, 1, 0.27], length: 0.62 },
  { shape: "sphere", position: [0, 1.6, 0], scale: [0.38, 0.26, 0.26] },
  { shape: "capsule", position: [0.71, 2.33, 0], scale: [0.11, 1, 0.11], length: 0.46, rotation: [0, 0, 0.1], mirror: true },
  { shape: "capsule", position: [0.79, 1.74, 0.02], scale: [0.09, 1, 0.09], length: 0.46, rotation: [0, 0, 0.04], mirror: true },
  { shape: "sphere", position: [0.82, 1.35, 0.03], scale: [0.08, 0.11, 0.06], mirror: true },
  { shape: "capsule", position: [0.22, 1.17, 0], scale: [0.16, 1, 0.16], length: 0.58, mirror: true },
  { shape: "sphere", position: [0.22, 0.83, 0.03], scale: [0.11, 0.1, 0.11], mirror: true },
  { shape: "capsule", position: [0.23, 0.46, 0], scale: [0.105, 1, 0.105], length: 0.56, mirror: true },
  { shape: "box", position: [0.23, 0.05, 0.08], scale: [0.16, 0.08, 0.32], mirror: true },
];

const MUSCLE_PARTS: Record<Muscle, Part[]> = {
  chest: [{ shape: "sphere", position: [0.19, 2.5, 0.23], scale: [0.23, 0.16, 0.075], rotation: [0, 0.25, -0.12], mirror: true }],
  frontDelts: [{ shape: "sphere", position: [0.58, 2.64, 0.1], scale: [0.12, 0.13, 0.09], mirror: true }],
  sideDelts: [{ shape: "sphere", position: [0.68, 2.62, 0], scale: [0.09, 0.15, 0.12], mirror: true }],
  rearDelts: [{ shape: "sphere", position: [0.58, 2.64, -0.1], scale: [0.12, 0.13, 0.09], mirror: true }],
  biceps: [{ shape: "sphere", position: [0.72, 2.3, 0.08], scale: [0.085, 0.2, 0.075], rotation: [0, 0, 0.1], mirror: true }],
  triceps: [{ shape: "sphere", position: [0.73, 2.32, -0.07], scale: [0.09, 0.22, 0.08], rotation: [0, 0, 0.1], mirror: true }],
  forearms: [{ shape: "sphere", position: [0.79, 1.8, 0.02], scale: [0.095, 0.23, 0.095], rotation: [0, 0, 0.04], mirror: true }],
  upperBack: [
    { shape: "sphere", position: [0.17, 2.72, -0.12], scale: [0.2, 0.13, 0.11], rotation: [0, 0, 0.35], mirror: true },
    { shape: "sphere", position: [0, 2.45, -0.24], scale: [0.17, 0.21, 0.07] },
  ],
  lats: [{ shape: "sphere", position: [0.3, 2.2, -0.15], scale: [0.15, 0.32, 0.1], rotation: [0, -0.3, 0.22], mirror: true }],
  lowerBack: [{ shape: "sphere", position: [0.09, 1.85, -0.24], scale: [0.075, 0.19, 0.06], mirror: true }],
  abs: [
    { shape: "sphere", position: [0.075, 2.2, 0.255], scale: [0.07, 0.075, 0.035], mirror: true },
    { shape: "sphere", position: [0.075, 2.03, 0.26], scale: [0.07, 0.075, 0.035], mirror: true },
    { shape: "sphere", position: [0.075, 1.85, 0.25], scale: [0.07, 0.085, 0.035], mirror: true },
  ],
  obliques: [{ shape: "sphere", position: [0.3, 1.97, 0.12], scale: [0.08, 0.22, 0.11], rotation: [0, 0.4, 0], mirror: true }],
  glutes: [{ shape: "sphere", position: [0.16, 1.52, -0.17], scale: [0.17, 0.17, 0.13], mirror: true }],
  quads: [{ shape: "sphere", position: [0.24, 1.16, 0.08], scale: [0.15, 0.33, 0.1], rotation: [0, 0, 0.04], mirror: true }],
  adductors: [{ shape: "sphere", position: [0.1, 1.24, 0.02], scale: [0.06, 0.24, 0.08], mirror: true }],
  hamstrings: [{ shape: "sphere", position: [0.23, 1.15, -0.09], scale: [0.14, 0.32, 0.1], mirror: true }],
  calves: [{ shape: "sphere", position: [0.23, 0.55, -0.07], scale: [0.1, 0.21, 0.1], mirror: true }],
};

const COLORS: Record<HeatStatus, string> = {
  untrained: "#c0473f",
  below: "#cf9a38",
  hit: "#3fa487",
};

function expand(parts: Part[]): Part[] {
  return parts.flatMap((p) =>
    p.mirror
      ? [
          p,
          {
            ...p,
            position: [-p.position[0], p.position[1], p.position[2]] as V3,
            rotation: p.rotation ? ([p.rotation[0], -p.rotation[1], -p.rotation[2]] as V3) : undefined,
          },
        ]
      : [p],
  );
}

function Shape({ part, children }: { part: Part; children: React.ReactNode }) {
  if (part.shape === "capsule") {
    return (
      // Capsules: scale[0] is the radius, scale[2] / scale[0] squashes depth; height comes from `length`.
      <mesh position={part.position} rotation={part.rotation} scale={[1, 1, part.scale[2] / part.scale[0]]} castShadow>
        <capsuleGeometry args={[part.scale[0], part.length ?? 0.5, 8, 16]} />
        {children}
      </mesh>
    );
  }
  if (part.shape === "box") {
    return (
      <mesh position={part.position} rotation={part.rotation} scale={part.scale} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        {children}
      </mesh>
    );
  }
  return (
    <mesh position={part.position} rotation={part.rotation} scale={part.scale} castShadow>
      <sphereGeometry args={[1, 28, 20]} />
      {children}
    </mesh>
  );
}

function MuscleMesh({
  muscle,
  cell,
  selected,
  hovered,
  onSelect,
  onHover,
}: {
  muscle: Muscle;
  cell: HeatCell;
  selected: boolean;
  hovered: boolean;
  onSelect: (m: Muscle) => void;
  onHover: (m: Muscle | null) => void;
}) {
  const parts = useMemo(() => expand(MUSCLE_PARTS[muscle]), [muscle]);
  const color = COLORS[cell.status];
  const glow = selected ? 0.55 : hovered ? 0.35 : cell.status === "below" ? 0.08 + 0.12 * cell.fraction : 0.14;
  return (
    <group
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
      {parts.map((p, i) => (
        <Shape key={i} part={p}>
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} roughness={0.55} metalness={0.1} />
        </Shape>
      ))}
    </group>
  );
}

export default function BodyMap3D({
  heat,
  selected,
  onSelect,
}: {
  heat: Record<Muscle, HeatCell>;
  selected: Muscle | null;
  onSelect: (m: Muscle) => void;
}) {
  const [hovered, setHovered] = useState<Muscle | null>(null);
  const [interacted, setInteracted] = useState(false);
  const base = useMemo(() => expand(BASE), []);
  const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div className="relative h-full w-full" style={{ cursor: hovered ? "pointer" : "grab", touchAction: "none" }}>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 1.85, 7.4], fov: 32 }} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.55} />
        <hemisphereLight args={["#b9c7d6", "#0b0d11", 0.9]} />
        <directionalLight position={[2.5, 5, 4]} intensity={2} color="#f3e6cf" castShadow />
        <directionalLight position={[-3, 3, -4]} intensity={1.1} color="#7fa6c9" />
        <spotLight position={[0, 7, 1]} angle={0.5} penumbra={0.8} intensity={18} color="#e2b04a" />
        <group position={[0, -0.05, 0]}>
          {base.map((p, i) => (
            <Shape key={i} part={p}>
              <meshStandardMaterial color="#323a46" roughness={0.55} metalness={0.12} />
            </Shape>
          ))}
          {(Object.keys(MUSCLE_PARTS) as Muscle[]).map((m) => (
            <MuscleMesh
              key={m}
              muscle={m}
              cell={heat[m]}
              selected={selected === m}
              hovered={hovered === m}
              onSelect={onSelect}
              onHover={setHovered}
            />
          ))}
        </group>
        <ContactShadows position={[0, -0.02, 0]} opacity={0.6} scale={4} blur={2.4} far={1.5} />
        <OrbitControls
          target={[0, 1.72, 0]}
          enablePan={false}
          minDistance={3}
          maxDistance={10}
          minPolarAngle={0.35}
          maxPolarAngle={1.75}
          autoRotate={!interacted && !reduceMotion}
          autoRotateSpeed={0.8}
          onStart={() => setInteracted(true)}
        />
      </Canvas>
      <p className="pointer-events-none absolute bottom-2 left-0 right-0 text-center text-xs text-fog">
        Drag to rotate · pinch to zoom · tap a muscle
      </p>
    </div>
  );
}
