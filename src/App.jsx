import React, { useState, useEffect, useRef, useCallback } from "react";
import Eye from "./components/Eye";
import Debug from "./components/debug";
import { ObjectDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import { matchToPrevious } from "./utils";
import { useControls, Leva } from "leva";
import "./index.scss";

const COLORS = [
  "#FF3B30", // Red
  "#FF9500", // Orange
  "#FFD60A", // Yellow
  "#34C759", // Green
  "#007AFF", // Blue
  "#AF52DE", // Purple
];

const App = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const detectorRef = useRef(null);
  const streamRef = useRef(null);

  const [people, setPeople] = useState([]);
  const [target, setTarget] = useState(null);
  const [showControls, setShowControls] = useState(true);

  const colorMap = useRef({});
  const nextId = useRef(0);
  const prevPeople = useRef([]);
  const lastSeen = useRef({});
  const bounceIndex = useRef(0);
  const lastBounceTime = useRef(0);

  const { flipX, flipY, debug } = useControls({
    flipX: false,
    flipY: false,
    debug: false,
  });

  const flipXRef = useRef(flipX);
  const flipYRef = useRef(flipY);

  useEffect(() => {
    flipXRef.current = flipX;
  }, [flipX]);
  useEffect(() => {
    flipYRef.current = flipY;
  }, [flipY]);

  // Helper: generate padded incremental IDs
  const getNextPersonId = () => {
    const id = `person_${nextId.current.toString().padStart(4, "0")}`;
    nextId.current += 1;
    return id;
  };

  // --- Initialize MediaPipe Detector ---
  const initDetector = useCallback(async () => {
    const vision = await FilesetResolver.forVisionTasks("mediapipe/models/");

    return await ObjectDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "mediapipe/models/efficientdet_lite0.tflite",
        delegate: "GPU",
      },
      categoryAllowlist: ["person"],
      scoreThreshold: 0.25,
      maxResults: 6,
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

      // Draw mirrored video frame
      ctx.save();
      ctx.translate(flipH ? ctx.canvas.width : 0, flipV ? ctx.canvas.height : 0);
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
        result.detections.forEach((d, i) => {
          const category = d.categories[0];
          if (!category) return;
          const box = d.boundingBox;
          const cx = box.originX + box.width / 2;
          const cy = box.originY + box.height / 2;
          const distance = Math.min(1, Math.max(0, box.height / vid.videoHeight));

          // Flip coordinates for drawing if needed
          const flipCoord = (x, y) => ({
            x: flipH ? 1 - x : x,
            y: flipV ? 1 - y : y,
          });
          const { x: cxFlip, y: cyFlip } = flipCoord(
            cx / vid.videoWidth,
            cy / vid.videoHeight
          );

          // Match or assign new ID
          let id = matchToPrevious(box, prevPeople.current);
          if (!id || usedIds.has(id)) id = getNextPersonId();
          usedIds.add(id);

          // Assign one of six spectrum colors deterministically
          if (!colorMap.current[id]) {
            const colorIndex = nextId.current % COLORS.length;
            colorMap.current[id] = COLORS[colorIndex];
          }
          const color = colorMap.current[id];

          // Draw bounding box
          ctx.lineWidth = 10;
          ctx.strokeStyle = color;
          const drawX = flipH
            ? ctx.canvas.width - (box.originX + box.width)
            : box.originX;
          const drawY = flipV
            ? ctx.canvas.height - (box.originY + box.height)
            : box.originY;
          ctx.strokeRect(drawX, drawY, box.width, box.height);

          // Track velocity
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

      // --- Draw target indicator ---
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
      await startCamera(() =>
        videoRef.current.requestVideoFrameCallback(processFrame)
      );
    };

    start();

    // Cleanup
    return () => {
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
      <Eye target={target} />
      <div className="foreground"></div>
      <canvas className={`canvas ${debug ? "" : "hidden"}`} ref={canvasRef} />
      <Debug debug={debug} people={people} target={target} />
      <Leva hidden={!showControls} />
    </div>
  );
};

export default App;
