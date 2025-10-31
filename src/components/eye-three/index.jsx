import React, { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, useGLTF, Float, OrbitControls } from "@react-three/drei";
import { Vector3, Quaternion } from "three";
import { EffectComposer, Bloom, DepthOfField, Noise } from "@react-three/postprocessing";
// import eyeModel from "../../assets/models/the-eye.glb";
import fullEyeModel from "../../assets/models/eye2.glb";

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
        -(target.y - 0.5) * 2,
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

export default function Eye2({ target }) {
  return (
    <Canvas
      dpr={0.75}
      camera={{ position: [0, 0, 3.5], fov: 40, near: 0.1, far: 6 }}
      gl={{ antialias: true }}
    >
      {/* <ambientLight intensity={0.6} /> */}
      <directionalLight position={[2, 2, 2]} intensity={1.8} />
      <Float speed={2} rotationIntensity={0} floatIntensity={1}>
        <EyeAssembly target={target} />
      </Float>
      <Environment preset="sunset" />
      <EffectComposer>
        <Bloom
          intensity={0.8}
          luminanceThreshold={0.4}
          luminanceSmoothing={0.25}
        />
        <DepthOfField
          worldFocusDistance={2.65}
          focalLength={0.05}
          bokehScale={4}
          resolutionScale={0.25}
        />
      </EffectComposer>
      <OrbitControls />
    </Canvas>
  );
}
