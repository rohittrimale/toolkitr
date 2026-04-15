'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface ResizableTerminalProps {
  children: React.ReactNode;
  initialHeight?: number;
  minHeight?: number;
  maxHeight?: number;
}

export default function ResizableTerminal({
  children,
  initialHeight = 260,
  minHeight = 80,
  maxHeight = 600,
}: ResizableTerminalProps) {
  const [height, setHeight] = useState(initialHeight);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => () => { cleanupRef.current?.(); }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startY.current = e.clientY;
    startHeight.current = height;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startY.current - ev.clientY;
      const newH = Math.min(maxHeight, Math.max(minHeight, startHeight.current + delta));
      setHeight(newH);
    };

    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      cleanupRef.current = null;
    };

    cleanupRef.current = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [height, minHeight, maxHeight]);

  return (
    <div style={{ flexShrink: 0, height, display: 'flex', flexDirection: 'column' }}>
      <div
        onMouseDown={onMouseDown}
        style={{
          height: 3,
          cursor: 'row-resize',
          background: 'transparent',
          flexShrink: 0,
          zIndex: 10,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(30, 144, 255, 0.5)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}
