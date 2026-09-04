"use client";

// ===== مدل سه‌بعدی نان بستنی فانتزی (R3F) =====
// دو لایه بیسکویت طلایی + بستنی وانیلی بین‌شان + خرده‌های پسته و شکلات
// چرخش مستقیماً به میزان اسکرول وصل است (نه انیمیشن خودکار)

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RoundedBox, ContactShadows, Float } from "@react-three/drei";
import type { Group, PerspectiveCamera } from "three";

export type ProgressRef = { current: number };

function Biscuit({ y, color }: { y: number; color: string }) {
  return (
    <RoundedBox
      args={[2.7, 0.52, 2.7]}
      radius={0.17}
      smoothness={5}
      position={[0, y, 0]}
      castShadow
    >
      <meshStandardMaterial color={color} roughness={0.92} metalness={0.02} />
    </RoundedBox>
  );
}

function Crumb({
  position,
  color,
  size = 0.07,
}: {
  position: [number, number, number];
  color: string;
  size?: number;
}) {
  return (
    <mesh position={position} castShadow>
      <icosahedronGeometry args={[size, 1]} />
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  );
}

export function IcecreamBread({ progressRef }: { progressRef: ProgressRef }) {
  const group = useRef<Group>(null);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const k = Math.min(1, dt * 7);
    // یک دور کامل + کمی بیشتر در طول اسکرول هیرو
    const targetY = 0.55 + progressRef.current * Math.PI * 2.2;
    const targetX = 0.16 + Math.sin(progressRef.current * Math.PI) * 0.14;
    g.rotation.y += (targetY - g.rotation.y) * k;
    g.rotation.x += (targetX - g.rotation.x) * k;
  });

  return (
    <group ref={group} position={[0, -0.62, 0]} scale={0.92}>
      <Float speed={1.6} rotationIntensity={0.05} floatIntensity={0.35} floatingRange={[-0.05, 0.08]}>
        {/* بستنی وانیلی وسط — کمی پهن‌تر تا حس فشرده شدن بدهد */}
        <RoundedBox args={[2.88, 0.62, 2.88]} radius={0.28} smoothness={6} position={[0, -0.02, 0]} castShadow>
          <meshPhysicalMaterial
            color="#fdf3dd"
            roughness={0.38}
            clearcoat={0.5}
            clearcoatRoughness={0.5}
            sheen={0.4}
            sheenColor="#ffffff"
          />
        </RoundedBox>

        <Biscuit y={0.42} color="#b97e4b" />
        <Biscuit y={-0.46} color="#a96f3f" />

        {/* خرده‌های پسته روی بیسکویت بالا */}
        <Crumb position={[0.55, 0.72, 0.5]} color="#7fb069" />
        <Crumb position={[-0.7, 0.7, 0.25]} color="#93c47d" size={0.06} />
        <Crumb position={[0.1, 0.74, -0.55]} color="#6a9a55" size={0.055} />
        {/* تراشه شکلات */}
        <Crumb position={[-0.35, 0.73, 0.72]} color="#4a2c17" size={0.08} />
        <Crumb position={[0.85, 0.69, -0.2]} color="#4a2c17" size={0.06} />

        {/* قطره‌های بستنی لبه‌ها */}
        <mesh position={[1.38, -0.05, 0.3]} castShadow>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshPhysicalMaterial color="#fdf3dd" roughness={0.35} clearcoat={0.5} />
        </mesh>
        <mesh position={[-1.36, -0.08, -0.35]} castShadow>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshPhysicalMaterial color="#fdf3dd" roughness={0.35} clearcoat={0.5} />
        </mesh>
      </Float>

      <ContactShadows position={[0, -1.35, 0]} opacity={0.3} scale={9} blur={2.6} far={3} color="#6b4226" />
    </group>
  );
}

export function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.75} color="#fff2df" />
      <directionalLight position={[4, 6, 3]} intensity={1.35} color="#fff4e0" />
      <directionalLight position={[-5, 2.5, -3]} intensity={0.4} color="#ffe3c0" />
      <spotLight position={[0, 7, -6]} intensity={0.55} angle={0.6} penumbra={1} color="#ffd9a8" />
    </>
  );
}

/** دوربین واکنش‌گرا — در موبایل عقب‌تر تا مدل کامل دیده شود */
export function CameraFit() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    // eslint-disable-next-line react-hooks/immutability -- الگوی استاندارد R3F: موتیشن مستقیم آبجکت three.js
    cam.position.z = size.width < 640 ? 13 : size.width < 1024 ? 9 : 6.4;
    // eslint-disable-next-line react-hooks/immutability -- همان الگو
    cam.position.y = 0.3;
    cam.updateProjectionMatrix();
  }, [camera, size.width]);
  return null;
}
