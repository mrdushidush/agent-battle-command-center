import { memo } from 'react';

const BACKGROUNDS = [
  '/assets/background/battlefield.jpg',
  '/assets/background/battlefield2.jpg',
  '/assets/background/battlefield3.jpg',
  '/assets/background/battlefield4.jpg',
  '/assets/background/battlefield5.jpg',
  '/assets/background/battlefield6.jpg',
];

interface Props {
  bgIndex: number;
}

/**
 * Battlefield background — full-bleed warzone image.
 * Rotates through backgrounds every 10 tasks.
 */
export const IsometricGrid = memo(function IsometricGrid({ bgIndex }: Props) {
  const src = BACKGROUNDS[bgIndex % BACKGROUNDS.length];

  return (
    <img
      src={src}
      alt=""
      draggable={false}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: 'center center',
        pointerEvents: 'none',
        zIndex: 0,
        filter: 'brightness(0.85) contrast(1.1)',
        transition: 'opacity 1s ease-in-out',
      }}
    />
  );
});
