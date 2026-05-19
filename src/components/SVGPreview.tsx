'use client';

import { useEffect, useRef } from 'react';

interface SVGPreviewProps {
  svg: string;
  className?: string;
}

export default function SVGPreview({ svg, className = '' }: SVGPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = svg;
    const inner = container.querySelector('svg');
    if (inner) {
      inner.style.maxWidth = '100%';
      inner.style.maxHeight = '100%';
      inner.style.width = 'auto';
      inner.style.height = 'auto';
      inner.style.display = 'block';
    }
    return () => {
      container.innerHTML = '';
    };
  }, [svg]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full ${className}`}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    />
  );
}
