import React, { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, useGLTF, Float, OrbitControls } from "@react-three/drei";
import { Vector3, Quaternion, CineonToneMapping, ReinhardToneMapping, ACESFilmicToneMapping } from "three";
import * as THREE from 'three';
import { EffectComposer, Bloom, DepthOfField, Noise, ToneMapping } from "@react-three/postprocessing";
import fullEyeModel from "../../assets/models/eye.glb";

const movementThreshold = { x: 0.02, y: 0.02 }; // only react to meaningful shifts
const slerpSpeed = 0.08; // how quickly the eye turns
const socketInfluence = 0.125; // 1/8th rotation strength

function EyeAssembly({ target }) {
  const groupRef = useRef();
  const eyeRef = useRef();
  const socketRef = useRef();

  const { scene } = useGLTF(fullEyeModel);
  const outer = scene.getObjectByName("Outer");
  const inner = scene.getObjectByName("Inner");

  const [lastTargetLookedAt, setLastTargetLookedAt] = useState({ x: 0.5, y: 0.5 });
  const currentQuat = useRef(new Quaternion());
  const targetQuat = useRef(new Quaternion());

  // 👁️ group-level depth pulse (subtle + quick)
  const zOffset = useRef(0);
  const targetZ = useRef(0);
  const timer = useRef(0);
  const nextTrigger = useRef(Math.random() * 5000 + 5000); // 5–10s between pulses

  useFrame((state, delta) => {
    if (!target) return;

    // --- Eye rotation logic ---
    const dx = target.x - lastTargetLookedAt.x;
    const dy = target.y - lastTargetLookedAt.y;
    const dist = Math.sqrt(dx * dx + dy * dy);


    if (
      Math.abs(dx) > movementThreshold.x ||
      Math.abs(dy) > movementThreshold.y ||
      dist > Math.sqrt(movementThreshold.x ** 2 + movementThreshold.y ** 2)
    ) {
      const lookDir = new Vector3(
        (target.x - 0.5) * 2,
        (target.y - 0.5) * 2 - .15,
        1
      ).normalize();

      const quat = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), lookDir);
      targetQuat.current.copy(quat);
      setLastTargetLookedAt({ x: target.x, y: target.y });
    }

    currentQuat.current.slerp(targetQuat.current, slerpSpeed);
    if (eyeRef.current) eyeRef.current.quaternion.copy(currentQuat.current);
    if (socketRef.current) {
      const socketQuat = new Quaternion().slerpQuaternions(
        new Quaternion(),
        currentQuat.current,
        socketInfluence
      );
      socketRef.current.quaternion.copy(socketQuat);
    }

    // --- Random pulse movement for whole group ---
    timer.current += delta * 1000;
    if (timer.current > nextTrigger.current) {
      targetZ.current = -Math.random() * 0.8; // only 80% as deep
      nextTrigger.current = timer.current + Math.random() * 5000 + 5000; // 5–10s next pulse
    }

    zOffset.current += (targetZ.current - zOffset.current) * 0.5;

    // when close to target, start returning forward
    if (Math.abs(targetZ.current - zOffset.current) < 0.02 && targetZ.current !== 0) {
      targetZ.current = 0;
    }

    // apply to the full model
    if (groupRef.current) groupRef.current.position.z = zOffset.current;
  });

  return (
    <group ref={groupRef}>
      <primitive ref={socketRef} object={outer.clone()} />
      <primitive ref={eyeRef} object={inner.clone()} />
    </group>
  );
}


export default function Eye({ target }) {
  return (
    <Canvas
      dpr={1}
      camera={{ position: [0, 0, 3], fov: 40, near: 0.1, far: 6 }}
    >
      <Float speed={2} rotationIntensity={1} floatIntensity={1}>
        <EyeAssembly target={target} />
      </Float>
      <Environment preset="warehouse" />
      <EffectComposer>
        <Bloom
          intensity={1.8}
          luminanceThreshold={0.5}
          luminanceSmoothing={0.25}
        />
        <DepthOfField
          worldFocusDistance={2.25}
          focalLength={0.01}
          bokehScale={4}
          resolutionX={512}
          resolutionY={512}
        />
        <ToneMapping
          adaptive={true} // toggle adaptive luminance map usage
          middleGrey={1} // middle grey factor
          maxLuminance={2.0} // maximum luminance
          averageLuminance={.15} // average luminance
          adaptationRate={5.0} // luminance adaptation rate
        />
      </EffectComposer>
      <OrbitControls />
    </Canvas>
  );
}
