import { DoubleSide, FrontSide, Side } from 'three';

export const getMaterialProps = (
  selectedId: string | null,
  seeThroughMode: string,
  id: string,
  defaultColor: string
) => {
  const isSelected = selectedId === id;
  const mode = seeThroughMode;
  
  let color = isSelected ? '#ff8c00' : defaultColor;
  let opacity = 1.0;
  let transparent = false;
  let wireframe = false;
  let side: Side = FrontSide;

  if (mode === 'seeThrough') {
    opacity = isSelected ? 0.85 : 0.7;
    transparent = true;
    side = DoubleSide;
  } else if (mode === 'studsOnly') {
    opacity = isSelected ? 0.6 : 0.1;
    transparent = true;
    wireframe = true;
  }

  return { color, opacity, transparent, wireframe, depthWrite: !transparent, side };
};
