import React from "react";
import "./index.scss";

export default function Eye({ target, squint }) {
  const x = target ? target.x * 100 : 50;
  const y = target ? target.y * 100 : 50;

  return (
    <div className="eye">
      <div className="eye-iris"></div>
      <div className="eye-pupil">
        <div
          className="eye-pupil-inner"
          style={{
            left: `${x}%`,
            top: `${y}%`,
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
