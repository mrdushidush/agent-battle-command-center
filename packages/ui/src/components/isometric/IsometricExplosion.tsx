import { memo, useEffect, useRef, useCallback } from 'react';
import { HOLO_COLORS } from '../battlefield/types';

interface Props {
  id: string;
  sx: number;
  sy: number;
  success: boolean;
  onComplete: (id: string) => void;
}

const PARTICLE_COUNT = 8;
const DURATION = 1500;

/**
 * Explosion effect at screen-space coordinates.
 * Success = green burst with expanding ring + particles.
 * Failure = red collapse with rotation.
 * Self-removes after animation.
 */
export const IsometricExplosion = memo(function IsometricExplosion({
  id,
  sx,
  sy,
  success,
  onComplete,
}: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const color = success ? HOLO_COLORS.success : HOLO_COLORS.failure;
  const duration = success ? DURATION : 2000;

  const handleComplete = useCallback(() => {
    onComplete(id);
  }, [id, onComplete]);

  useEffect(() => {
    timerRef.current = setTimeout(handleComplete, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [handleComplete, duration]);

  if (success) {
    return (
      <div
        className="absolute pointer-events-none"
        style={{ left: sx, top: sy, zIndex: 600 }}
      >
        {/* Central burst */}
        <div
          style={{
            position: 'absolute',
            width: 20,
            height: 20,
            marginLeft: -10,
            marginTop: -10,
            borderRadius: '50%',
            backgroundColor: color + '66',
            animation: `iso-explode-success ${DURATION}ms ease-out forwards`,
          }}
        />

        {/* Expanding ring */}
        <div
          className="iso-explosion-ring"
          style={{
            width: 24,
            height: 24,
            marginLeft: -12,
            marginTop: -12,
            borderColor: color,
          }}
        />

        {/* Particles radiating outward */}
        {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
          const angle = (i / PARTICLE_COUNT) * 360;
          const rad = (angle * Math.PI) / 180;
          const dist = 30 + Math.random() * 20;
          const tx = Math.cos(rad) * dist;
          const ty = Math.sin(rad) * dist;
          const size = 3 + Math.random() * 3;
          const delay = Math.random() * 200;

          return (
            <div
              key={i}
              className="iso-explosion-particle"
              style={{
                width: size,
                height: size,
                marginLeft: -size / 2,
                marginTop: -size / 2,
                backgroundColor: color,
                boxShadow: `0 0 4px ${color}`,
                animationName: 'none',
                transform: 'translate(0px, 0px)',
                transition: `transform ${DURATION - delay}ms ease-out ${delay}ms, opacity ${DURATION - delay}ms ease-out ${delay}ms`,
                opacity: 1,
              }}
              ref={(el) => {
                if (el) {
                  requestAnimationFrame(() => {
                    el.style.transform = `translate(${tx}px, ${ty}px) scale(0.3)`;
                    el.style.opacity = '0';
                  });
                }
              }}
            />
          );
        })}
      </div>
    );
  }

  // Failure: collapse + rotate
  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: sx, top: sy, zIndex: 600 }}
    >
      <div
        style={{
          position: 'absolute',
          width: 24,
          height: 24,
          marginLeft: -12,
          marginTop: -12,
          borderRadius: '4px',
          backgroundColor: color + '88',
          boxShadow: `0 0 12px ${color}, 0 0 24px ${color}44`,
          animation: 'iso-explode-failure 2s ease-in forwards',
        }}
      />
    </div>
  );
});
