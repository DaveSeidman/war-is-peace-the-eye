import React, { useEffect, useRef, useState } from "react";
import "./index.scss";

// A simple cubic bezier easing function (ease out cubic)
const cubicBezierEase = (t) => 1 - Math.pow(1 - t, 1.5);

// Helper for random number in range
const randRange = (min, max) => Math.random() * (max - min) + min;

export default function Eye({ target }) {
  const position = useRef({ x: 50, y: 50 });
  const targetPos = useRef({ x: 50, y: 50 });
  const lastUpdate = useRef(performance.now());
  const animRef = useRef(null);

  const [transform, setTransform] = useState({
    rotate: 0,
    scale: 1,
    translateX: 0,
    translateY: 0,
  });

  const [squintState, setSquintState] = useState(1);

  // Update target position whenever props.target changes
  useEffect(() => {
    if (!target) return;
    targetPos.current = {
      x: target.x * 100,
      y: target.y * 100,
    };
  }, [target]);

  // Smooth position interpolation
  useEffect(() => {
    const THRESHOLD = 0.3; // ignore jitter smaller than this (%)
    const SPEED = 0.02;
    const DAMPING = 0.95;

    const update = (time) => {
      const dt = (time - lastUpdate.current) / 16.6;
      lastUpdate.current = time;

      const current = position.current;
      const dest = targetPos.current;

      const dx = dest.x - current.x;
      const dy = dest.y - current.y;
      const dist = Math.hypot(dx, dy);

      if (dist > THRESHOLD) {
        const t = cubicBezierEase(Math.min(1, SPEED * dt));
        const ease = dist < 5 ? SPEED * DAMPING : t;
        current.x += dx * ease;
        current.y += dy * ease;
      }

      animRef.current = requestAnimationFrame(update);
    };

    animRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Random eye wobble transform (rotation, scale, translation)
  useEffect(() => {
    const randomize = () => {
      setTransform({
        rotate: randRange(-10, 10),
        scale: randRange(0.9, 1.1),
        translateX: randRange(-10, 10),
        translateY: randRange(-10, 10),
      });
    };
    randomize();
    const interval = setInterval(randomize, randRange(1500, 4000));
    return () => clearInterval(interval);
  }, []);

  // Blinking + squinting behavior
  useEffect(() => {
    let blinkTimeout;
    let squintTimeout;

    const triggerBlink = () => {
      let phase = 0;
      const blinkSpeed = 0.2;
      const blink = () => {
        phase += blinkSpeed;
        const value =
          phase < 1 ? 1 - phase * 0.99 : Math.min(1, (phase - 1) * 0.99);
        setSquintState(value);
        if (phase < 2) requestAnimationFrame(blink);
      };
      blink();
    };

    const triggerSquint = () => {
      const duration = randRange(1000, 2000);
      const start = performance.now();
      const startValue = 1;
      const endValue = 0.2;

      const animate = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = cubicBezierEase(t);
        setSquintState(startValue + (endValue - startValue) * eased);
        if (t < 1) requestAnimationFrame(animate);
        else {
          // return to 1 after hold
          setTimeout(() => {
            const startBack = performance.now();
            const animateBack = (now2) => {
              const t2 = Math.min(1, (now2 - startBack) / duration);
              const eased2 = cubicBezierEase(t2);
              setSquintState(endValue + (1 - endValue) * eased2);
              if (t2 < 1) requestAnimationFrame(animateBack);
            };
            requestAnimationFrame(animateBack);
          }, randRange(300, 800));
        }
      };
      requestAnimationFrame(animate);
    };

    const loop = () => {
      const nextBlink = randRange(2000, 6000);
      const nextSquint = randRange(4000, 10000);
      blinkTimeout = setTimeout(triggerBlink, nextBlink);
      squintTimeout = setTimeout(triggerSquint, nextSquint);
      setTimeout(loop, Math.min(nextBlink, nextSquint) + 2000);
    };
    loop();

    return () => {
      clearTimeout(blinkTimeout);
      clearTimeout(squintTimeout);
    };
  }, []);

  return (
    <div
      className="eye"
      style={{
        transform: `
          translate(-50%, -50%)
          translate(${transform.translateX}%, ${transform.translateY}%)
          rotate(${transform.rotate}deg)
          scale(${transform.scale})
        `,
        transition: "transform 1s ease-in-out",
      }}
    >
      <div className="eye-white"></div>
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
      <div
        className="eye-sides"
        style={{
          transform: `scaleY(${squintState})`,
          // transition: "transform 0.15s ease-in-out",
        }}
      >
        <div className="eye-sides-side top" />
        <div className="eye-sides-side bottom" />
      </div>
    </div>
  );
}
