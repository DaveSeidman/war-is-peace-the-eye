import React, { useEffect, useRef, useState } from "react"
import './index.scss';


export default function Eye({ pointers }) {

  console.log(pointers);
  const moveTimer = useRef();
  const [position, setPosition] = useState({
    x: .5,
    y: .5
  });

  const move = () => {
    console.log('move now')
    setPosition({
      x: Math.random() * .1,
      y: Math.random() * .1
    });
    moveTimer.current = setTimeout(move, Math.random() * 1000 + 1000);
  }

  useEffect(() => {
    move();
    return (() => {
      clearTimeout(moveTimer.current);
    })
  }, [])

  return (
    <div className="eye">
      <div className="eye-iris"></div>
      <div className="eye-pupil">
        <div className="eye-pupil-inner"
          style={{
            transform: `translate(${position.x * 100}%, ${position.y * 100}%)`
          }}
        ></div>
      </div>
    </div>
  )
}