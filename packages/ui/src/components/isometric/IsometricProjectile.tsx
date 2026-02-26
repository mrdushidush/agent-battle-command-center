import { memo, useRef, useEffect } from 'react';

interface Props {
  id: string;
  fromSx: number;
  fromSy: number;
  toSx: number;
  toSy: number;
  color: string;
  onComplete: (id: string) => void;
}

/**
 * Elongated SVG ellipse projectile with glow trail.
 * Oriented along travel direction, animates in screen space.
 */
export const IsometricProjectile = memo(function IsometricProjectile({
  id,
  fromSx,
  fromSy,
  toSx,
  toSy,
  color,
  onComplete,
}: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  // Angle of travel for elongated ellipse orientation
  const dx = toSx - fromSx;
  const dy = toSy - fromSy;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  useEffect(() => {
    const el = elRef.current;
    if (!el || startedRef.current) return;
    startedRef.current = true;

    // Force initial paint, then animate to target
    requestAnimationFrame(() => {
      el.style.left = `${toSx}px`;
      el.style.top = `${toSy}px`;
    });
  }, [toSx, toSy]);

  const handleTransitionEnd = () => {
    onComplete(id);
  };

  return (
    <div
      ref={elRef}
      className="iso-projectile"
      style={{
        left: fromSx,
        top: fromSy,
        zIndex: 500,
      }}
      onTransitionEnd={handleTransitionEnd}
    >
      <svg
        width={20}
        height={10}
        viewBox="0 0 20 10"
        style={{
          transform: `translate(-10px, -5px) rotate(${angle}deg)`,
          overflow: 'visible',
        }}
      >
        <defs>
          <filter id={`bolt-glow-${id}`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        {/* Trail */}
        <ellipse cx={6} cy={5} rx={6} ry={2} fill={color} opacity={0.3} />
        {/* Core bolt */}
        <ellipse
          cx={12}
          cy={5}
          rx={8}
          ry={3}
          fill={color}
          opacity={0.8}
          filter={`url(#bolt-glow-${id})`}
        />
        {/* Bright center */}
        <ellipse cx={14} cy={5} rx={4} ry={1.5} fill="white" opacity={0.6} />
      </svg>
    </div>
  );
});
