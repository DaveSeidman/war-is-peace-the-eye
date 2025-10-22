import React, { useState, useEffect, useRef } from "react";
import Eye from "./components/Eye";
import foregroundImage from "./assets/images/foreground.png";
import { ObjectDetector, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2";
import "./index.scss";

const App = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const detectorRef = useRef(null);
  const streamRef = useRef(null);

  const [people, setPeople] = useState([]);
  const [target, setTarget] = useState(null);

  const colorMap = useRef({});
  const prevPeople = useRef([]);
  const lastSeen = useRef({});
  const bounceIndex = useRef(0);
  const lastBounceTime = useRef(0);

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
    let isActive = true;

    const init = async () => {
      // ✅ Initialize MediaPipe
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2/wasm"
      );
      const detector = await ObjectDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/1/efficientdet_lite0.tflite",
          delegate: "GPU",
        },
        categoryAllowlist: ["person"],
        scoreThreshold: 0.2,
        maxResults: 10,
        runningMode: "VIDEO",
      });

      if (!isActive) return;
      detectorRef.current = detector;
      console.log("✅ Object detector initialized");

      startCamera();
    };

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 360 },
            facingMode: "user",
          },
        });
        streamRef.current = stream;
        const vid = videoRef.current;
        vid.srcObject = stream;
        vid.onloadedmetadata = () => {
          const canvas = canvasRef.current;
          canvas.width = vid.videoWidth;
          canvas.height = vid.videoHeight;
          ctxRef.current = canvas.getContext("2d");
          vid.play();
          vid.requestVideoFrameCallback(processFrame);
        };
      } catch (err) {
        console.error("Camera access error:", err);
      }
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
          if (!category) return;

          const box = d.boundingBox;
          const cx = box.originX + box.width / 2;
          const cy = box.originY + box.height / 2;
          const distance = Math.min(1, Math.max(0, box.height / vid.videoHeight));

          let id = matchToPrevious(cx, cy, prevPeople.current);
          if (!id || usedIds.has(id)) id = `person_${crypto.randomUUID().slice(0, 8)}`;
          usedIds.add(id);

          if (!colorMap.current[id]) colorMap.current[id] = randomColor();
          const color = colorMap.current[id];

          // Bounding box
          ctx.lineWidth = 3;
          ctx.strokeStyle = color;
          ctx.strokeRect(box.originX, box.originY, box.width, box.height);

          // ID label
          ctx.font = "16px sans-serif";
          ctx.textBaseline = "top";
          ctx.textAlign = "left";
          ctx.fillStyle = "white";
          ctx.fillText(id, box.originX + 4, box.originY - 18);

          // Distance label
          ctx.font = "18px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = color;
          ctx.fillText(distance.toFixed(2), cx, cy);

          newPeople.push({
            id,
            // normalized coordinates (0–1)
            x: cx / vid.videoWidth,
            y: cy / vid.videoHeight,
            distance,
            color,
            score: category.score,
          });
        });
      }

      setPeople(newPeople);
      prevPeople.current = newPeople;

      const nowMs = performance.now();
      newPeople.forEach((p) => {
        lastSeen.current[p.id] = nowMs;
      });

      // Target selection logic (rotating between visible people)
      let newTarget = null;

      if (newPeople.length === 0) {
        // 👇 reset to center when no one is visible
        newTarget = {
          id: "center",
          x: 0.5,
          y: 0.5,
          distance: 0,
          color: "rgba(255,0,0,0.5)",
          score: 0,
        };
        bounceIndex.current = 0; // reset bounce cycle
      } else if (newPeople.length === 1) {
        newTarget = newPeople[0];
      } else {
        // Sort by closeness (largest distance = closest)
        const sorted = [...newPeople].sort((a, b) => b.distance - a.distance);

        const nowMs = performance.now();
        if (nowMs - lastBounceTime.current > 1000) {
          bounceIndex.current = (bounceIndex.current + 1) % sorted.length;
          lastBounceTime.current = nowMs;
        }

        newTarget = sorted[bounceIndex.current];
      }

      setTarget(newTarget);


      setTarget(newTarget);

      setTarget(newTarget);

      // ✅ Draw large red circle on target
      if (newTarget && ctx) {
        const absX = newTarget.x * ctx.canvas.width;
        const absY = newTarget.y * ctx.canvas.height;
        ctx.beginPath();
        ctx.arc(absX, absY, 60, 0, Math.PI * 2);
        ctx.lineWidth = 6;
        ctx.strokeStyle = "rgba(255, 0, 0, 0.9)";
        ctx.shadowBlur = 20;
        ctx.shadowColor = "rgba(255, 0, 0, 0.7)";
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      vid.requestVideoFrameCallback(processFrame);
    };

    init();

    return () => {
      isActive = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <div className="app">
      <video ref={videoRef} style={{ display: "none" }} playsInline></video>

      <div className="debug">
        <p>Detected {people.length} people</p>
        {people.map((p) => (
          <p key={p.id} style={{ color: p.color }}>
            {p.label ?? "person"} ({Math.round(p.score * 100)}%) – dist: {p.distance.toFixed(2)}
          </p>
        ))}
        {target && (
          <p style={{ color: target.color, fontWeight: "bold" }}>
            🎯 Target: {target.id} (dist {target.distance.toFixed(2)})
          </p>
        )}
      </div>

      <Eye faces={people} target={target} />
      <img className="foreground" src={foregroundImage} alt="overlay" />
      <canvas className="canvas" ref={canvasRef}></canvas>
    </div>
  );
};

export default App;
