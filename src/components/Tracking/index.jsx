import React, { useEffect, useRef } from 'react';
import './index.scss';

export default function Tracking({ faces, videoRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !videoRef?.current) return;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      const video = videoRef.current;
      if (!video) return;

      // Draw current video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Draw detected face markers
      ctx.strokeStyle = 'lime';
      ctx.lineWidth = 2;
      faces.forEach((f) => {
        const x = f.x * canvas.width;
        const y = f.y * canvas.height;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.stroke();
      });

      requestAnimationFrame(draw);
    };

    draw();
  }, [faces, videoRef]);

  return (
    <canvas
      ref={canvasRef}
      width={720}
      height={480}
      className="tracking"
    />
  );
}
