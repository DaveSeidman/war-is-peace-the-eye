import React, { useState, useEffect, useRef } from 'react';
import Eye from './components/Eye';
import Tracking from './components/Tracking';
import { FaceDetection } from '@mediapipe/face_detection';
import { Camera } from '@mediapipe/camera_utils';
import { useControls, Leva } from 'leva';
import './index.scss';

// import your demo video
import demoVideo from './assets/videos/demo.mp4';

const App = () => {
  const pointers = useRef({});
  const [faces, setFaces] = useState([]);
  const videoRef = useRef(null);

  // Leva dropdown
  const { inputSource } = useControls({
    inputSource: {
      value: 'video',
      options: ['video', 'camera'],
      label: 'Input Source',
    },
  });

  // Pointer handlers
  const pointerDown = (e) => {
    pointers.current[e.pointerId] = { x: e.clientX, y: e.clientY };
  };
  const pointerMove = (e) => {
    if (pointers.current[e.pointerId]) {
      pointers.current[e.pointerId] = { x: e.clientX, y: e.clientY };
    }
  };
  const pointerUp = (e) => {
    delete pointers.current[e.pointerId];
  };

  useEffect(() => {
    addEventListener('pointerdown', pointerDown);
    addEventListener('pointermove', pointerMove);
    addEventListener('pointerup', pointerUp);
    return () => {
      removeEventListener('pointerdown', pointerDown);
      removeEventListener('pointermove', pointerMove);
      removeEventListener('pointerup', pointerUp);
    };
  }, []);

  // Setup MediaPipe Face Detection
  useEffect(() => {
    if (!videoRef.current) return;

    const faceDetector = new FaceDetection({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`,
    });
    faceDetector.setOptions({
      model: 'short',
      minDetectionConfidence: 0.5,
    });

    faceDetector.onResults((results) => {
      if (!results.detections || results.detections.length === 0) {
        setFaces([]);
        return;
      }
      const newFaces = results.detections.map((d) => {
        const box = d.boundingBox;
        return {
          x: box.xCenter,
          y: box.yCenter,
        };
      });
      setFaces(newFaces);
    });

    if (inputSource === 'camera') {
      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          await faceDetector.send({ image: videoRef.current });
        },
        width: 640,
        height: 480,
      });
      camera.start();
      return () => {
        camera.stop();
      };
    } else if (inputSource === 'video') {
      videoRef.current.src = demoVideo;
      videoRef.current.loop = true;
      videoRef.current.autoPlay = true;
      videoRef.current.playsInline = true;
      videoRef.current.muted = true;

      videoRef.current.play();

      const processFrame = async () => {
        if (videoRef.current.paused || videoRef.current.ended) return;
        await faceDetector.send({ image: videoRef.current });
        requestAnimationFrame(processFrame);
      };
      processFrame();
    }
  }, [inputSource]);

  return (
    <div className="app">
      <video
        ref={videoRef}
        style={{ display: 'none' }}
        playsInline
      ></video>
      <Eye pointers={pointers} faces={faces} />
      <Tracking faces={faces} videoRef={videoRef} />

      <Leva collapsed />
    </div>
  );
};

export default App;
