import React, { useState, useEffect, useRef, useCallback } from "react";
import Eye from "./components/Eye";
import Eye2 from './components/eye-three';
import Debug from "./components/debug";
import { ObjectDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import { matchToPrevious, COLORS } from "./utils";
import { useControls, Leva } from "leva";
import "./index.scss";

const App = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const detectorRef = useRef(null);
  const streamRef = useRef(null);

  const [people, setPeople] = useState([]);
  const [target, setTarget] = useState({ x: .5, y: .5 });
  const [showControls, setShowControls] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const colorMap = useRef({});
  const nextId = useRef(0);
  const prevPeople = useRef([]);
  const lastSeen = useRef({});
  const bounceIndex = useRef(0);
  const lastBounceTime = useRef(0);

  // === LEVA CONTROLS ===
  const { flipX, flipY, debug, scoreThreshold } = useControls({
    flipX: false,
    flipY: false,
    debug: false,
    scoreThreshold: {
      value: 0.25,
      min: 0,
      max: 1,
      step: 0.01,
      label: "Detection Confidence",
    },
  });

  const flipXRef = useRef(flipX);
  const flipYRef = useRef(flipY);
  const thresholdRef = useRef(scoreThreshold);

  useEffect(() => {
    flipXRef.current = flipX;
    flipYRef.current = flipY;
    thresholdRef.current = scoreThreshold;
  }, [flipX, flipY, scoreThreshold]);

  const getNextPersonId = () => {
    const id = `person_${nextId.current.toString().padStart(4, "0")}`;
    nextId.current += 1;
    return id;
  };

  const initDetector = useCallback(async () => {
    const vision = await FilesetResolver.forVisionTasks("mediapipe/models/");
    return await ObjectDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "mediapipe/models/efficientdet_lite0.tflite",
        delegate: "GPU",
      },
      categoryAllowlist: ["person"],
      scoreThreshold: 0.0, // we'll filter manually
      maxResults: 6,
      runningMode: "VIDEO",
    });
  }, []);

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

  const handleFullscreenChange = () => {
    setFullscreen(document.fullscreenElement !== null);
  };

  const processFrame = useCallback(async (now) => {
    const vid = videoRef.current;
    const ctx = ctxRef.current;
    const detector = detectorRef.current;
    if (!detector || !ctx || !vid) return;

    const result = await detector.detectForVideo(vid, now);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const flipH = flipXRef.current;
    const flipV = flipYRef.current;

    ctx.save();
    ctx.translate(flipH ? ctx.canvas.width : 0, flipV ? ctx.canvas.height : 0);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(vid, 0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();

    const newPeople = [];
    const usedIds = new Set();
    const nowMs = performance.now();

    prevPeople.current = prevPeople.current.filter(
      (p) => nowMs - (lastSeen.current[p.id] ?? 0) < 1000
    );

    if (result?.detections) {
      result.detections.forEach((d) => {
        const category = d.categories[0];
        if (!category || category.score < thresholdRef.current) return; // 👈 filter by live threshold
        const box = d.boundingBox;
        const cx = box.originX + box.width / 2;
        const cy = box.originY + box.height / 2;
        const distance = Math.min(1, Math.max(0, box.height / vid.videoHeight));

        const flipCoord = (x, y) => ({
          x: flipH ? 1 - x : x,
          y: flipV ? 1 - y : y,
        });
        const { x: cxFlip, y: cyFlip } = flipCoord(
          cx / vid.videoWidth,
          cy / vid.videoHeight
        );

        let id = matchToPrevious(box, prevPeople.current);
        if (!id || usedIds.has(id)) id = getNextPersonId();
        usedIds.add(id);

        if (!colorMap.current[id]) {
          const colorIndex = nextId.current % COLORS.length;
          colorMap.current[id] = COLORS[colorIndex];
        }
        const color = colorMap.current[id];

        ctx.lineWidth = 10;
        ctx.strokeStyle = color;
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
  }, []);

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

  const keydown = ({ key }) => {
    if (key === "F1") setShowControls((s) => !s);
  };

  useEffect(() => {
    addEventListener("keydown", keydown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      removeEventListener("keydown", keydown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  return (
    <div className="app">
      <video className="video" ref={videoRef} playsInline muted />
      {/* <Eye target={target} /> */}
      <Eye2 target={target} />
      <div className="foreground"></div>
      <canvas className={`canvas ${debug ? "" : "hidden"}`} ref={canvasRef} />
      <Debug debug={debug} people={people} target={target} />
      <Leva hidden={!showControls} />
      {!fullscreen && (
        <button
          type="button"
          className="fullscreen"
          onClick={async () => {
            try {
              await document.documentElement.requestFullscreen();
              setFullscreen(true);
            } catch (err) {
              console.error("Failed to enter fullscreen:", err);
            }
          }}
        >
          Fullscreen
        </button>
      )}
    </div>
  );
};

export default App;
