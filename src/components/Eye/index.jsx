import React, { useEffect, useRef } from "react";
import "./index.scss";

// A simple cubic bezier easing function
// EaseOutCubic is a good natural eye-movement curve
const cubicBezierEase = (t) => 1 - Math.pow(1 - t, 3);

export default function Eye({ target, squint }) {
  const position = useRef({ x: 50, y: 50 });
  const targetPos = useRef({ x: 50, y: 50 });
  const lastUpdate = useRef(performance.now());
  const animRef = useRef(null);

  // Update target position whenever props.target changes
  useEffect(() => {
    if (!target) return;
    targetPos.current = {
      x: target.x * 100,
      y: target.y * 100,
    };
  }, [target]);

  useEffect(() => {
    const THRESHOLD = 0.3; // ignore jitter smaller than this (%)
    const SPEED = 0.02; // interpolation speed multiplier (0–1)
    const DAMPING = 0.95; // reduces speed on very small movements

    const update = (time) => {
      const dt = (time - lastUpdate.current) / 16.6; // ~frames normalized
      lastUpdate.current = time;

      const current = position.current;
      const dest = targetPos.current;

      const dx = dest.x - current.x;
      const dy = dest.y - current.y;
      const dist = Math.hypot(dx, dy);

      // Only move if distance is above threshold
      if (dist > THRESHOLD) {
        // easing based on cubic-bezier
        const t = cubicBezierEase(Math.min(1, SPEED * dt));
        const ease = dist < 5 ? SPEED * DAMPING : t; // dampen when nearly there

        current.x += dx * ease;
        current.y += dy * ease;
      }

      animRef.current = requestAnimationFrame(update);
    };

    animRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <div className="eye">
      <div className="eye-iris"></div>
      <div className="eye-pupil">
        <div
          className="eye-pupil-inner"
          style={{
            left: `${position.current.x}%`,
            top: `${position.current.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        ></div>
      </div>
      <div className="eye-sides" style={{ transform: `scaleY(${squint})` }}>
        <div className="eye-sides-side top" />
        <div className="eye-sides-side bottom" />
      </div>
    </div>
  );
}
