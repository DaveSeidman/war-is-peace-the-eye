import React, { useState, useEffect, useRef, useCallback } from "react";
import Eye from "./components/Eye";
import {
  ObjectDetector,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2";
import { useControls, Leva } from "leva";
import "./index.scss";

// --- Helper Functions ---
const randomColor = () => {
  const r = Math.floor(Math.random() * 205 + 50);
  const g = Math.floor(Math.random() * 205 + 50);
  const b = Math.floor(Math.random() * 205 + 50);
  return `rgba(${r},${g},${b},0.9)`;
};

const iou = (a, b) => {
  const x1 = Math.max(a.originX, b.originX);
  const y1 = Math.max(a.originY, b.originY);
  const x2 = Math.min(a.originX + a.width, b.originX + b.width);
  const y2 = Math.min(a.originY + a.height, b.originY + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
};

const predictBox = (p) =>
  !p.box
    ? null
    : {
      originX: p.box.originX + (p.vx ?? 0),
      originY: p.box.originY + (p.vy ?? 0),
      width: p.box.width,
      height: p.box.height,
    };

const matchToPrevious = (box, prevList, iouThreshold = 0.3) => {
  let best = null;
  let bestScore = iouThreshold;
  for (const p of prevList) {
    if (!p.box) continue;
    const predicted = predictBox(p);
    const overlap = iou(box, predicted);
    if (overlap > bestScore) {
      best = p;
      bestScore = overlap;
    }
  }
  return best ? best.id : null;
};

// --- Main Component ---
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

  const { flipX, flipY, debug, squint } = useControls({
    flipX: false,
    flipY: false,
    debug: false,
    squint: { min: 0.1, max: 1, value: 0.5 },
  });

  const [showControls, setShowControls] = useState(true);

  const flipXRef = useRef(flipX);
  const flipYRef = useRef(flipY);

  useEffect(() => {
    flipXRef.current = flipX;
  }, [flipX]);

  useEffect(() => {
    flipYRef.current = flipY;
  }, [flipY]);

  // --- Initialize MediaPipe Object Detector ---
  const initDetector = useCallback(async () => {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.2/wasm"
    );

    return await ObjectDetector.createFromOptions(vision, {
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
  }, []);

  // --- Start Camera ---
  const startCamera = useCallback(async (onReady) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      const vid = videoRef.current;
      vid.srcObject = stream;
      vid.onloadedmetadata = () => {
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = vid.videoWidth;
          canvas.height = vid.videoHeight;
          ctxRef.current = canvas.getContext("2d");
        }
        vid.play();
        onReady();
      };
    } catch (err) {
      console.error("Camera access error:", err);
    }
  }, []);

  // --- Frame Processor ---
  const processFrame = useCallback(
    async (now) => {
      const vid = videoRef.current;
      const ctx = ctxRef.current;
      const detector = detectorRef.current;
      if (!detector || !ctx || !vid) return;

      const result = await detector.detectForVideo(vid, now);
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      const flipH = flipXRef.current;
      const flipV = flipYRef.current;

      // Draw video frame
      ctx.save();
      ctx.translate(
        flipH ? ctx.canvas.width : 0,
        flipV ? ctx.canvas.height : 0
      );
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(vid, 0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.restore();

      const newPeople = [];
      const usedIds = new Set();
      const nowMs = performance.now();

      // Keep recently seen people
      prevPeople.current = prevPeople.current.filter(
        (p) => nowMs - (lastSeen.current[p.id] ?? 0) < 1000
      );

      if (result?.detections) {
        result.detections.forEach((d) => {
          const category = d.categories[0];
          if (!category) return;
          const box = d.boundingBox;
          const cx = box.originX + box.width / 2;
          const cy = box.originY + box.height / 2;
          const distance = Math.min(
            1,
            Math.max(0, box.height / vid.videoHeight)
          );

          // Flip coordinates for drawing if needed
          const flipCoord = (x, y) => ({
            x: flipH ? 1 - x : x,
            y: flipV ? 1 - y : y,
          });
          const { x: cxFlip, y: cyFlip } = flipCoord(
            cx / vid.videoWidth,
            cy / vid.videoHeight
          );

          let id = matchToPrevious(box, prevPeople.current);
          if (!id || usedIds.has(id))
            id = `person_${crypto.randomUUID().slice(0, 8)}`;
          usedIds.add(id);

          if (!colorMap.current[id]) colorMap.current[id] = randomColor();
          const color = colorMap.current[id];

          ctx.lineWidth = 3;
          ctx.strokeStyle = color;

          // Mirror bounding boxes
          const drawX = flipH
            ? ctx.canvas.width - (box.originX + box.width)
            : box.originX;
          const drawY = flipV
            ? ctx.canvas.height - (box.originY + box.height)
            : box.originY;

          ctx.strokeRect(drawX, drawY, box.width, box.height);

          const prev = prevPeople.current.find((p) => p.id === id);
          const vx = prev ? cx - prev.cx : 0;
          const vy = prev ? cy - prev.cy : 0;

          newPeople.push({
            id,
            box,
            x: cxFlip,
            y: cyFlip,
            cx,
            cy,
            vx,
            vy,
            distance,
            color,
            score: category.score,
          });
        });
      }

      setPeople(newPeople);
      prevPeople.current = newPeople;
      newPeople.forEach((p) => (lastSeen.current[p.id] = nowMs));

      // --- Target selection ---
      let newTarget = null;
      if (newPeople.length === 0) {
        newTarget = {
          id: "center",
          x: 0.5,
          y: 0.5,
          distance: 0,
          color: "rgba(255,0,0,0.5)",
          score: 0,
        };
        bounceIndex.current = 0;
      } else if (newPeople.length === 1) {
        newTarget = newPeople[0];
      } else {
        const sorted = [...newPeople].sort((a, b) => b.distance - a.distance);
        if (nowMs - lastBounceTime.current > 1000) {
          bounceIndex.current = (bounceIndex.current + 1) % sorted.length;
          lastBounceTime.current = nowMs;
        }
        newTarget = sorted[bounceIndex.current];
      }

      setTarget(newTarget);

      // --- Draw target ---
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
    },
    [] // processFrame shouldn't recreate each render
  );

  // --- Lifecycle ---
  useEffect(() => {
    let isActive = true;

    const start = async () => {
      const detector = await initDetector();
      if (!isActive) return;
      detectorRef.current = detector;
      console.log("✅ Object detector initialized");
      await startCamera(() => videoRef.current.requestVideoFrameCallback(processFrame));
    };

    start();

    // --- Cleanup ---
    return () => {
      console.log("🧹 Cleaning up MediaPipe + stream");
      isActive = false;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const vid = videoRef.current;
      if (vid) {
        try {
          vid.srcObject = null;
          vid.pause();
        } catch { }
      }

      if (detectorRef.current?.close) {
        try {
          detectorRef.current.close();
        } catch { }
        detectorRef.current = null;
      }
    };
  }, [initDetector, startCamera, processFrame]);

  // --- Render ---
  return (
    <div className="app">
      <video className="video" ref={videoRef} playsInline muted />

      <Eye target={target} squint={squint} />
      <canvas className={`canvas ${debug ? "" : "hidden"}`} ref={canvasRef} />
      <div className={`debug ${debug ? '' : 'hidden'}`}>
        <h1>Detected {people.length} people</h1>
        {people.map((p) => (
          <p className={`debug-person ${p.id === target?.id ? 'target' : ''}`} key={p.id} style={{ color: p.color }}>
            {p.label ?? "person"} ({Math.round(p.score * 100)}%) – dist:{" "}
            {p.distance.toFixed(2)}
          </p>
        ))}
      </div>
      <Leva
        hidden={!showControls}
      />
    </div>
  );
};

export default App;
