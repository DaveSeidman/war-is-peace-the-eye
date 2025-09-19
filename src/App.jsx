import React, { useState, useEffect, useRef } from 'react';
import Eye from './components/Eye';
import './index.scss';

const App = () => {
  const pointers = useRef({});
  const handleFullscreenChange = (e) => {
    setFullscreen(document.fullscreenElement !== null)
  }

  const pointerDown = (e) => {
    pointers[e.pointerId] = {
      x: e.clientX,
      y: e.clientY
    }
  }

  const pointerMove = (e) => {
  }
  const pointerUp = (e) => {
    delete pointers[e.pointerId]
  }
  useEffect(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    addEventListener('pointerdown', pointerDown)
    addEventListener('pointermove', pointerMove);
    addEventListener('pointerup', pointerUp)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      removeEventListener('pointerdown', pointerDown);
      removeEventListener('pointermove', pointerMove);
      removeEventListener('pointerup', pointerUp);
    };
  }, []);

  return (
    <div className="app">
      <Eye
        pointers={pointers}
      />
    </div >
  );
};

export default App;
