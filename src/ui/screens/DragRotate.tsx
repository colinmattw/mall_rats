import { useRef } from 'react';
import { useApp } from '../AppContext';

/** Invisible area that rotates the studio preview when dragged. */
export function DragRotate({ className, label = 'Drag to rotate' }: { className?: string; label?: string }) {
  const app = useApp();
  const last = useRef<number | null>(null);
  return (
    <div
      className={`drag-rotate ${className ?? ''}`}
      role="img"
      aria-label={label}
      data-testid="drag-rotate"
      onPointerDown={(e) => {
        last.current = e.clientX;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (last.current === null) return;
        const dx = e.clientX - last.current;
        last.current = e.clientX;
        app.runtime()?.rotatePreview(dx * 0.012);
      }}
      onPointerUp={() => (last.current = null)}
      onPointerCancel={() => (last.current = null)}
    />
  );
}
