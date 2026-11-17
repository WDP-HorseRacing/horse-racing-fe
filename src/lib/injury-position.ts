// Tọa độ 3D của chấn thương tương thích với mô hình 3D `horse-anatomy-v2.glb`.
// Hệ trục toạ độ root-local của mô hình:
//   Y: chiều cao (+Y hướng lên đỉnh đầu/lưng, y ~ 0 là mặt đất/móng)
//   Z: chiều dọc (+Z hướng về đầu ngựa, -Z hướng về đuôi)
//   X: chiều ngang (+X là bên trái thân ngựa, -X là bên phải thân ngựa)
import type { BodyRegion } from '../api/types';

export interface InjuryPosition {
  x: number;
  y: number;
  z: number;
}

export const REGION_POSITION: Record<BodyRegion, InjuryPosition> = {
  HEAD: { x: 0, y: 1.65, z: 1.15 },
  NECK: { x: 0, y: 1.35, z: 0.7 },
  BACK: { x: 0, y: 1.42, z: -0.05 },
  CHEST: { x: 0, y: 1.05, z: 0.4 },
  ABDOMEN: { x: 0, y: 0.95, z: -0.1 },
  PELVIS: { x: 0, y: 1.35, z: -0.65 },
  LEFT_FRONT_LEG: { x: 0.22, y: 0.45, z: 0.38 },
  RIGHT_FRONT_LEG: { x: -0.22, y: 0.45, z: 0.38 },
  LEFT_HIND_LEG: { x: 0.22, y: 0.45, z: -0.65 },
  RIGHT_HIND_LEG: { x: -0.22, y: 0.45, z: -0.65 },
  OTHER: { x: 0, y: 1.1, z: 0 },
};

export const positionOfRegion = (region: BodyRegion): InjuryPosition => ({ ...REGION_POSITION[region] });

/**
 * Gợi ý phân vùng cơ thể (BodyRegion) từ toạ độ 3D tương đối trên mô hình ngựa.
 */
export function suggestBodyRegion(point: InjuryPosition): BodyRegion {
  const { x, y, z } = point;
  if (![x, y, z].every(Number.isFinite)) return 'OTHER';

  if (y < 0.82) {
    if (z >= 0.08) return x >= 0 ? 'LEFT_FRONT_LEG' : 'RIGHT_FRONT_LEG';
    return x >= 0 ? 'LEFT_HIND_LEG' : 'RIGHT_HIND_LEG';
  }
  if (z >= 0.96 && y >= 1.35) return 'HEAD';
  if (z >= 0.4 && y >= 1.05) return 'NECK';
  if (z <= -0.42 && y >= 0.92) return 'PELVIS';
  if (y >= 1.28 && z >= -0.48 && z < 0.4) return 'BACK';
  if (z >= 0.18 && y >= 0.78) return 'CHEST';
  if (z < 0.18 && y < 1.12) return 'ABDOMEN';
  if (y >= 1.05 && z >= -0.48 && z < 0.4) return 'BACK';
  return 'OTHER';
}
