import React, { useState, useEffect, useRef } from 'react';
import Eye from './components/Eye';
import Tracking from './components/Tracking';
import { FaceDetection } from '@mediapipe/face_detection';
import { Camera } from '@mediapipe/camera_utils';
import { useControls, Leva } from 'leva';
import './index.scss';
import demoVideo from './assets/videos/demo3.mp4';

const App = () => {
  const [faces, setFaces] = useState([]);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;

    const faceDetector = new FaceDetection({ locateFile: (file) => `mediapipe/models/${file}` });
    faceDetector.setOptions({
      model: 'short',
      minDetectionConfidence: 0.2,
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

    videoRef.current.src = demoVideo;
    videoRef.current.loop = true;
    videoRef.current.autoPlay = true;
    videoRef.current.playsInline = true;
    videoRef.current.muted = true;
    videoRef.current.play();

    const processFrame = (now, metadata) => {
      faceDetector.send({ image: videoRef.current }).then(results => {
        videoRef.current.requestVideoFrameCallback(processFrame);
      });
    }

    videoRef.current.requestVideoFrameCallback(processFrame);

  }, []);

  return (
    <div className="app">
      <video
        ref={videoRef}
        style={{ display: 'none' }}
        playsInline
      >
      </video>
      <div className="debug">
        <p>tracking {faces.length} people</p>
      </div>
      <Eye faces={faces} />
      <Tracking faces={faces} videoRef={videoRef} />
      <Leva collapsed />
    </div>
  );
};

export default App;
