import React, { useState, useEffect, useRef } from "react";
import "./index.scss";
import demoVideo from "./assets/videos/demo3.mp4";

import {
  ObjectDetector,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2";

const App = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const detectorRef = useRef(null);
  const [people, setPeople] = useState([]);

  // Persistent color map
  const colorMap = useRef({});
  const prevPeople = useRef([]);

  const randomColor = () => {
    const r = Math.floor(Math.random() * 205 + 50);
    const g = Math.floor(Math.random() * 205 + 50);
    const b = Math.floor(Math.random() * 205 + 50);
    return `rgba(${r},${g},${b},0.9)`;
  };

  const matchToPrevious = (cx, cy, prevList, maxDistance = 100) => {
    let best = null;
    let bestDist = maxDistance;
    for (const p of prevList) {
      const dist = Math.hypot(cx - p.x, cy - p.y);
      if (dist < bestDist) {
        best = p;
        bestDist = dist;
      }
    }
    return best ? best.id : null;
  };

  useEffect(() => {
    const initDetector = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2/wasm"
      );

      detectorRef.current = await ObjectDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.tflite",
          delegate: "GPU",
        },
        scoreThreshold: 0.0,
        maxResults: 10,
        runningMode: "VIDEO",
      });

      console.log("✅ Object detector initialized");
      startVideo();
    };

    const startVideo = () => {
      const vid = videoRef.current;
      vid.src = demoVideo;
      vid.loop = true;
      vid.muted = true;
      vid.autoplay = true;
      vid.playsInline = true;
      vid.addEventListener("loadeddata", () => {
        const canvas = canvasRef.current;
        canvas.width = vid.videoWidth;
        canvas.height = vid.videoHeight;
        ctxRef.current = canvas.getContext("2d");
        vid.play();
        vid.requestVideoFrameCallback(processFrame);
      });
    };

    const processFrame = async (now) => {
      const vid = videoRef.current;
      const ctx = ctxRef.current;
      if (!detectorRef.current || !ctx || !vid) return;

      const result = await detectorRef.current.detectForVideo(vid, now);
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.drawImage(vid, 0, 0, ctx.canvas.width, ctx.canvas.height);

      const newPeople = [];
      const usedIds = new Set();

      if (result?.detections) {
        result.detections.forEach((d) => {
          const category = d.categories[0];
          if (!category || category.categoryName !== "person" || category.score < 0.5) return;

          const box = d.boundingBox;
          const cx = box.originX + box.width / 2;
          const cy = box.originY + box.height / 2;

          // Distance metric (0–1): ratio of box height to video height
          const distance = Math.min(1, Math.max(0, box.height / vid.videoHeight));

          // Try to find a matching person from the previous frame
          let id = matchToPrevious(cx, cy, prevPeople.current);

          // If the matched ID is already used this frame, or no match found → make a new one
          if (!id || usedIds.has(id)) {
            id = `person_${crypto.randomUUID().slice(0, 8)}`;
          }

          usedIds.add(id);

          if (!colorMap.current[id]) colorMap.current[id] = randomColor();
          const color = colorMap.current[id];

          // Draw bounding box
          ctx.lineWidth = 3;
          ctx.strokeStyle = color;
          ctx.strokeRect(box.originX, box.originY, box.width, box.height);

          // Draw label
          ctx.font = "16px sans-serif";
          ctx.textBaseline = "top";
          ctx.textAlign = "left";
          const labelText = id;
          ctx.fillStyle = "white";
          ctx.fillText(labelText, box.originX + 4, box.originY - 18);

          // Distance label at center
          ctx.font = "18px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = color;
          ctx.fillText(distance.toFixed(2), cx, cy);

          newPeople.push({
            id,
            x: cx,
            y: cy,
            label: "person",
            score: category.score,
            color,
            distance,
          });
        });
      }


      setPeople(newPeople);
      prevPeople.current = newPeople;
      vid.requestVideoFrameCallback(processFrame);
    };

    initDetector();
  }, []);

  return (
    <div className="app">
      <video ref={videoRef} style={{ display: "none" }} playsInline></video>
      <canvas ref={canvasRef} style={{ width: "100%", maxWidth: "800px" }}></canvas>

      <div className="debug">
        <p>Detected {people.length} people</p>
        {people.map((p) => (
          <p key={p.id} style={{ color: p.color }}>
            {p.label} ({Math.round(p.score * 100)}%) – distance: {p.distance.toFixed(2)}
          </p>
        ))}
      </div>
    </div>
  );
};

export default App;
