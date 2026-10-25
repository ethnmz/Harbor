"use client";

/**
 * The glass mascots, ported from the "AI Agent Mascot Models" Figma Make file (src/Mascots.tsx).
 * Geometry and materials are unchanged; Harbor adds several mascots per canvas, a transparent
 * background, a hop on `cue`, a lighter quality for small sizes, and pausing.
 * Only ever loaded on the client (see mascot.tsx).
 */
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, Float, Lightformer, MeshTransmissionMaterial, OrbitControls } from "@react-three/drei";
import { useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { MASCOTS, type MascotKind } from "@/lib/mascots";

const INK = "#151515";

// Global pointer so every canvas reacts to the cursor anywhere on the page.
const mouse = { x: 0, y: 0 };
if (typeof window !== "undefined") {
  window.addEventListener(
    "pointermove",
    (e) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    },
    { passive: true },
  );
}

const tintOf = (color: string) => new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.86);

type Quality = { samples: number; resolution: number };

const Glass = ({ bg, q }: { bg: THREE.Color; q: Quality }) => (
  <MeshTransmissionMaterial
    background={bg}
    samples={q.samples}
    resolution={q.resolution}
    transmission={1}
    roughness={0.06}
    thickness={0.8}
    ior={1.45}
    chromaticAberration={0.1}
    anisotropy={0.2}
    distortion={0.12}
    distortionScale={0.4}
    temporalDistortion={0.04}
    clearcoat={1}
    clearcoatRoughness={0.04}
  />
);
const Ink = () => <meshPhysicalMaterial color={INK} roughness={0.12} metalness={0.2} clearcoat={1} clearcoatRoughness={0.04} />;
const Glow = ({ color, intensity = 2.2 }: { color: string; intensity?: number }) => (
  <meshStandardMaterial color={color} emissive={color} emissiveIntensity={intensity} toneMapped={false} />
);

type AgentProps = { color: string; bg: THREE.Color; q: Quality };

function Face({ z, y = 0, color, offset = 0 }: { z: number; y?: number; color: string; offset?: number }) {
  const ref = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  useFrame(({ clock }, d) => {
    const g = ref.current;
    if (!g || !eyes.current) return;
    g.position.x = THREE.MathUtils.damp(g.position.x, mouse.x * 0.06, 10, d);
    g.position.y = THREE.MathUtils.damp(g.position.y, y + mouse.y * 0.05, 10, d);
    const blink = (clock.elapsedTime + offset) % 4 < 0.13 ? 0.12 : 1;
    eyes.current.children.forEach((c) => (c.scale.y = THREE.MathUtils.damp(c.scale.y, blink, 30, d)));
  });
  return (
    <group ref={ref} position={[0, y, z]}>
      <group ref={eyes}>
        {[-1, 1].map((i) => (
          <mesh key={i} position={[i * 0.17, 0, 0]}>
            <capsuleGeometry args={[0.055, 0.1, 8, 16]} />
            <Ink />
          </mesh>
        ))}
      </group>
      {[-1, 1].map((i) => (
        <mesh key={i} position={[i * 0.33, -0.13, -0.02]} scale={[1, 0.6, 0.3]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <Glow color={color} intensity={1.4} />
        </mesh>
      ))}
    </group>
  );
}

/** Orbit: a glass pebble with an antenna and a little moon on a ring. */
function OrbitAgent({ color, bg, q }: AgentProps) {
  const ring = useRef<THREE.Group>(null);
  const bead = useRef<THREE.Mesh>(null);
  useFrame(({ clock }, d) => {
    if (ring.current) ring.current.rotation.z += d * 0.8;
    if (bead.current) bead.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 4) * 0.15);
  });
  return (
    <group>
      <mesh scale={[1.1, 0.92, 0.8]}>
        <sphereGeometry args={[1, 64, 64]} />
        <Glass bg={bg} q={q} />
      </mesh>
      <mesh position={[0.15, 1.08, 0]} rotation={[0, 0, -0.25]}>
        <cylinderGeometry args={[0.025, 0.025, 0.4, 12]} />
        <Ink />
      </mesh>
      <mesh ref={bead} position={[0.21, 1.3, 0]}>
        <sphereGeometry args={[0.09, 24, 24]} />
        <Glow color={color} />
      </mesh>
      <group rotation={[1.2, 0.3, 0]}>
        <group ref={ring}>
          <mesh>
            <torusGeometry args={[1.42, 0.022, 12, 96]} />
            <Ink />
          </mesh>
          <mesh position={[1.42, 0, 0]}>
            <sphereGeometry args={[0.1, 24, 24]} />
            <Glow color={color} />
          </mesh>
        </group>
      </group>
      <Face z={0.8} y={0.08} color={color} />
    </group>
  );
}

/** Facet: a hexagonal crystal with a pulsing core. */
function FacetAgent({ color, bg, q }: AgentProps) {
  const core = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => {
    const pts = [
      [0, -1.25],
      [0.72, -0.55],
      [0.78, 0.5],
      [0, 1.25],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const g = new THREE.LatheGeometry(pts, 6).toNonIndexed();
    g.computeVertexNormals();
    return g;
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (core.current) {
      core.current.scale.setScalar(1 + Math.sin(t * 2.2) * 0.12);
      core.current.rotation.set(t * 0.6, t * 0.9, 0);
    }
  });
  return (
    <group>
      <mesh geometry={geometry} rotation={[0, Math.PI / 6, 0]}>
        <Glass bg={bg} q={q} />
      </mesh>
      <mesh ref={core} position={[0, -0.3, -0.1]}>
        <octahedronGeometry args={[0.26, 0]} />
        <Glow color={color} intensity={2.6} />
      </mesh>
      <Face z={0.68} y={0.28} color={color} offset={1.4} />
    </group>
  );
}

/** Murmur: a speech bubble that is always mid-thought. */
function MurmurAgent({ color, bg, q }: AgentProps) {
  const dots = useRef<THREE.Group>(null);
  const geometry = useMemo(() => {
    const [w, h, r] = [2, 1.35, 0.4];
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2);
    s.lineTo(-w / 2 + 0.5, -h / 2);
    s.lineTo(-w / 2 + 0.18, -h / 2 - 0.45);
    s.lineTo(-w / 2 + 0.95, -h / 2);
    s.lineTo(w / 2 - r, -h / 2);
    s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r);
    s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    s.lineTo(-w / 2 + r, h / 2);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    s.lineTo(-w / 2, -h / 2 + r);
    s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.14, bevelSegments: 8, curveSegments: 24 });
    g.translate(0, 0, -0.25);
    return g;
  }, []);
  useFrame(({ clock }) => {
    dots.current?.children.forEach((c, i) => {
      c.position.y = -0.22 + Math.max(0, Math.sin(clock.elapsedTime * 5 - i * 0.9)) * 0.12;
    });
  });
  return (
    <group position={[0, 0.1, 0]}>
      <mesh geometry={geometry}>
        <Glass bg={bg} q={q} />
      </mesh>
      <group ref={dots}>
        {[-1, 0, 1].map((i) => (
          <mesh key={i} position={[i * 0.3, -0.22, 0]}>
            <sphereGeometry args={[0.09, 24, 24]} />
            <Glow color={color} />
          </mesh>
        ))}
      </group>
      <Face z={0.4} y={0.22} color={color} offset={2.6} />
    </group>
  );
}

const AGENTS = { orbit: OrbitAgent, facet: FacetAgent, murmur: MurmurAgent };

function Reactive({ interactive, children }: { interactive: boolean; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  useFrame((_, d) => {
    const g = ref.current;
    if (!g) return;
    g.scale.setScalar(THREE.MathUtils.damp(g.scale.x, hover ? 1.1 : 1, 8, d));
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, mouse.x * 0.4, 4, d);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, -mouse.y * 0.25, 4, d);
  });
  return (
    <group
      ref={ref}
      onPointerOver={() => {
        setHover(true);
        if (interactive) document.body.style.cursor = "grab";
      }}
      onPointerOut={() => {
        setHover(false);
        if (interactive) document.body.style.cursor = "";
      }}
    >
      {children}
    </group>
  );
}

/** A hop with a squash and a full turn whenever `cue` changes (step transitions, celebrations). */
function Hop({ cue, delay, children }: { cue: number; delay: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const seen = useRef(cue);
  const start = useRef<number | null>(null);
  useFrame(({ clock }) => {
    const g = ref.current;
    if (!g) return;
    if (cue !== seen.current) {
      seen.current = cue;
      start.current = clock.elapsedTime + delay;
    }
    if (start.current === null) return;
    const t = (clock.elapsedTime - start.current) / 0.65;
    if (t < 0) return;
    if (t >= 1) {
      g.position.y = 0;
      g.rotation.y = 0;
      g.scale.setScalar(1);
      start.current = null;
      return;
    }
    const squash = 1 + Math.sin(t * Math.PI * 2) * 0.07;
    g.position.y = Math.sin(t * Math.PI) * 0.45;
    g.rotation.y = t * Math.PI * 2;
    g.scale.set(1 / squash, squash, 1 / squash);
  });
  return <group ref={ref}>{children}</group>;
}

/** Abstract glossy shapes behind the glass so there is something to refract. */
function Backdrop({ color }: { color: string }) {
  const mat = <meshPhysicalMaterial color={color} roughness={0.2} clearcoat={1} clearcoatRoughness={0.05} />;
  return (
    <group position={[0, 0, -1]}>
      <mesh position={[0.95, 0.75, 0]}>
        <sphereGeometry args={[0.75, 48, 48]} />
        {mat}
      </mesh>
      <mesh position={[-1.05, -0.55, 0.2]}>
        <sphereGeometry args={[0.32, 32, 32]} />
        {mat}
      </mesh>
      <mesh position={[-0.6, 0.9, -0.3]} rotation={[0.4, 0.3, 0]}>
        <torusGeometry args={[0.38, 0.11, 24, 64]} />
        {mat}
      </mesh>
      <mesh position={[0.5, -0.95, -0.2]} rotation={[0, 0, 0.5]}>
        <capsuleGeometry args={[0.13, 0.7, 8, 24]} />
        <meshPhysicalMaterial color="#ffffff" roughness={0.15} clearcoat={1} />
      </mesh>
    </group>
  );
}

export type MascotSceneProps = {
  kinds: MascotKind[];
  cue?: number;
  interactive?: boolean;
  backdrop?: boolean;
  quality?: "high" | "low";
  paused?: boolean;
  still?: boolean;
  onReady?: () => void;
};

export default function MascotScene({ kinds, cue = 0, interactive = false, backdrop = true, quality = "high", paused = false, still = false, onReady }: MascotSceneProps) {
  const n = kinds.length;
  const q = quality === "high" ? { samples: 6, resolution: 512 } : { samples: 3, resolution: 256 };
  const tints = useMemo(() => kinds.map((k) => tintOf(MASCOTS[k].color)), [kinds]);
  const lead = MASCOTS[kinds[0]].color;
  return (
    <Canvas
      camera={{ position: [0, 0, 5.6 + (n - 1) * 2.8], fov: 35 }}
      dpr={[1, 1.5]}
      gl={{ alpha: true, antialias: true }}
      frameloop={paused ? "never" : still ? "demand" : "always"}
      onCreated={() => onReady?.()}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 4, 5]} intensity={1.2} />
      {/* Local studio lighting for glossy reflections (no HDR download). */}
      <Environment resolution={256}>
        <Lightformer form="rect" intensity={4} position={[0, 5, 4]} rotation-x={Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="rect" intensity={3} position={[5, 1, 3]} rotation-y={-Math.PI / 2} scale={[2, 6, 1]} />
        <Lightformer form="circle" intensity={2} position={[-5, 0, 2]} rotation-y={Math.PI / 2} scale={3} />
        <Lightformer form="ring" color={lead} intensity={6} position={[0, -3, 5]} scale={4} />
      </Environment>
      {kinds.map((kind, i) => {
        const Agent = AGENTS[kind];
        const { color } = MASCOTS[kind];
        return (
          <group key={kind} position={[(i - (n - 1) / 2) * 2.75, 0, 0]}>
            {backdrop && <Backdrop color={color} />}
            <Float speed={still ? 0 : 2} rotationIntensity={still ? 0 : 0.25} floatIntensity={still ? 0 : 0.6}>
              <Hop cue={cue} delay={i * 0.09}>
                <Reactive interactive={interactive}>
                  <Agent color={color} bg={tints[i]} q={q} />
                </Reactive>
              </Hop>
            </Float>
          </group>
        );
      })}
      <ContactShadows position={[0, -1.6, 0]} opacity={0.3} scale={5 * n} blur={2.4} far={3} color={lead} />
      {interactive && <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 3} maxPolarAngle={(2 * Math.PI) / 3} />}
    </Canvas>
  );
}
