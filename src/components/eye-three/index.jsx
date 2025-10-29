import React, { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, useGLTF, Float } from "@react-three/drei";
import { Vector3, Quaternion } from "three";
import {
  EffectComposer,
  Bloom,
  DepthOfField,
} from "@react-three/postprocessing";
import eyeModel from "../../assets/models/the-eye.glb";

const movementThreshold = { x: 0.02, y: 0.02 }; // only react to meaningful shifts
const slerpSpeed = 0.08; // how quickly the eye turns

function Eyeball({ target }) {
  const group = useRef();
  const { scene } = useGLTF(eyeModel);

  const [lastTargetLookedAt, setLastTargetLookedAt] = useState({ x: 0.5, y: 0.5 });
  const currentQuat = useRef(new Quaternion());
  const targetQuat = useRef(new Quaternion());

  useFrame(() => {
    if (!group.current || !target) return;

    const dx = target.x - lastTargetLookedAt.x;
    const dy = target.y - lastTargetLookedAt.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Update only if target moved enough
    if (
      Math.abs(dx) > movementThreshold.x ||
      Math.abs(dy) > movementThreshold.y ||
      dist > Math.sqrt(movementThreshold.x ** 2 + movementThreshold.y ** 2)
    ) {
      // Double the motion range for a more noticeable effect
      const lookDir = new Vector3(
        (target.x - 0.5) * 2, // exaggerated motion
        -(target.y - 0.5) * 2,
        1
      ).normalize();

      const quat = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), lookDir);
      targetQuat.current.copy(quat);
      setLastTargetLookedAt({ x: target.x, y: target.y });
    }

    // Smooth SLERP to avoid abrupt changes
    currentQuat.current.slerp(targetQuat.current, slerpSpeed);
    group.current.quaternion.copy(currentQuat.current);
  });

  return (
    <Float
      speed={2} // slight gentle float
      rotationIntensity={0}
      floatIntensity={2}
    >
      <primitive ref={group} object={scene} />
    </Float>
  );
}

export default function Eye2({ target }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 40, near: 4, far: 6 }}
      gl={{ antialias: true }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 2, 2]} intensity={1.8} />
      <Eyeball target={target} />
      <Environment preset="sunset" />

      {/* Postprocessing */}
      <EffectComposer>
        <Bloom
          intensity={0.8}
          luminanceThreshold={0.4}
          luminanceSmoothing={0.25}
        />
        <DepthOfField
          focusDistance={0.0125}   // Focus just in front of the eye (≈ z=4.5)
          focalLength={0.05}     // Narrow focus band for shallow DOF
          bokehScale={16}       // Slightly softened blur radius
          height={480}
          debug={true}
        />
      </EffectComposer>
    </Canvas>
  );
}
