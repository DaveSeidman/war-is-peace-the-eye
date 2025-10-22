import React, { useEffect, useRef, useState } from 'react';
import './index.scss';

export default function Eye({ faces, target }) {
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const faceIndex = useRef(0);
  const faceTimer = useRef();
  // const [people, setPeople] = useState([])

  useEffect(() => {
    if (faces.length <= 1) return;
    // Cycle between faces if multiple
    faceTimer.current = setInterval(() => {
      faceIndex.current = (faceIndex.current + 1) % faces.length;
    }, 1000);
    return () => clearInterval(faceTimer.current);
  }, [faces.length]);

  useEffect(() => {
    const update = () => {
      let x = 50, y = 50;

      if (faces.length === 1) {
        x = faces[0].x * 100;
        y = faces[0].y * 100;
      } else if (faces.length > 1) {
        const target = faces[faceIndex.current];
        if (target) {
          x = target.x * 100;
          y = target.y * 100;
        }
      }

      setPosition({ x, y });
      requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }, [faces]);

  return (
    <div className="eye">
      <div className="eye-iris"></div>
      <div className="eye-pupil">
        <div
          className="eye-pupil-inner"
          style={{
            left: `${target?.x * 100}%`,
            top: `${target?.y * 100}%`,
            transform: `translate(-50%, -50%)`,
          }}
        ></div>
      </div>
    </div>
  );
}
