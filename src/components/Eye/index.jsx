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
  const eyeRef = useRef();
  const socketRef = useRef();

  const { scene } = useGLTF(fullEyeModel);
  const outer = scene.getObjectByName('Outer')
  const inner = scene.getObjectByName('Inner');
  const [lastTargetLookedAt, setLastTargetLookedAt] = useState({ x: 0.5, y: 0.5 });
  const currentQuat = useRef(new Quaternion());
  const targetQuat = useRef(new Quaternion());

  useFrame(() => {
    if (!target) return;

    const dx = target.x - lastTargetLookedAt.x;
    const dy = target.y - lastTargetLookedAt.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Only update when the target moves enough
    if (
      Math.abs(dx) > movementThreshold.x ||
      Math.abs(dy) > movementThreshold.y ||
      dist > Math.sqrt(movementThreshold.x ** 2 + movementThreshold.y ** 2)
    ) {
      const lookDir = new Vector3(
        (target.x - 0.5) * 2, // doubled movement range
        -(target.y - 0.5) * .5,
        1
      ).normalize();

      const quat = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), lookDir);
      targetQuat.current.copy(quat);
      setLastTargetLookedAt({ x: target.x, y: target.y });
    }

    // Smooth eye SLERP
    currentQuat.current.slerp(targetQuat.current, slerpSpeed);
    if (eyeRef.current) eyeRef.current.quaternion.copy(currentQuat.current);

    // Apply 1/8th rotation to socket
    if (socketRef.current) {
      const socketQuat = new Quaternion().slerpQuaternions(
        new Quaternion(),
        currentQuat.current,
        socketInfluence
      );
      socketRef.current.quaternion.copy(socketQuat);
    }
  });

  return (
    <>
      <primitive ref={socketRef} object={outer.clone()} />
      <primitive ref={eyeRef} object={inner.clone()} />
    </>
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
          // resolutionScale={0.25}
          resolutionX={512}
          resolutionY={512}
        />
        <ToneMapping
          adaptive={true} // toggle adaptive luminance map usage
          // resolution={256} // texture resolution of the luminance map
          middleGrey={0.6} // middle grey factor
          maxLuminance={2.0} // maximum luminance
          averageLuminance={.15} // average luminance
          adaptationRate={5.0} // luminance adaptation rate
        />
      </EffectComposer>
      <OrbitControls />
    </Canvas>
  );
}
