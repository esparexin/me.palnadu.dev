'use client';

import {useState, useRef, useEffect, type FC} from 'react';
import type {FloatingCardGalleryProps} from './types';
import {CardItem} from './card-item';

export const FloatingCardGallery: FC<FloatingCardGalleryProps> = ({
  cards = [],
  backgroundColor = 'bg-surface-inverse',
  accentColor = 'rgba(0, 113, 227, 0.4)',
  maxCards = 9,
  className = '',
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [mousePosition, setMousePosition] = useState({x: 0, y: 0});
  const [reducedMotion, setReducedMotion] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(query.matches);

    const handleMotionChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    query.addEventListener('change', handleMotionChange);

    const handleMouseMove = (e: MouseEvent) => {
      if (query.matches || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) / 35;
      const y = (e.clientY - rect.top - rect.height / 2) / 35;
      setMousePosition({
        x: Math.max(-12, Math.min(12, x)),
        y: Math.max(-12, Math.min(12, y)),
      });
    };

    const handleMouseLeave = () => {
      setMousePosition({x: 0, y: 0});
    };

    const current = containerRef.current;
    if (current) {
      current.addEventListener('mousemove', handleMouseMove);
      current.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      query.removeEventListener('change', handleMotionChange);
      if (current) {
        current.removeEventListener('mousemove', handleMouseMove);
        current.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, []);

  const displayCards = cards.slice(0, maxCards);

  const containerTransform = reducedMotion
    ? undefined
    : {
        transform: `rotateX(${-mousePosition.y}deg) rotateY(${mousePosition.x}deg)`,
        transformStyle: 'preserve-3d' as const,
        transition: 'transform 200ms ease-out',
      };

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden rounded-2xl ${backgroundColor} p-4 sm:p-6 md:p-8 lg:p-10 ${className}`}
      style={{perspective: reducedMotion ? undefined : '1400px'}}
    >
      {/* Ambient background particles */}
      {!reducedMotion ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-16 -top-16 h-72 w-72 rounded-pill bg-accent/15 blur-3xl" />
          <div className="absolute -bottom-16 -right-16 h-72 w-72 rounded-pill bg-highlight/10 blur-3xl" />
          <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-pill bg-accent-subtle/5 blur-3xl" />
        </div>
      ) : null}

      {/* 3D Grid Stage */}
      <div
        style={containerTransform}
        className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
      >
        {displayCards.map((card, index) => (
          <CardItem
            key={card.id ?? card.slug ?? index}
            card={card}
            index={index}
            isActive={activeIndex === index}
            reducedMotion={reducedMotion}
            accentColor={accentColor}
            onSelect={(idx) => setActiveIndex(idx)}
            onClose={() => setActiveIndex(null)}
          />
        ))}
      </div>
    </div>
  );
};
