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
  HEAD: { x: 0.44, y: 1.80, z: 1.14 },
  NECK: { x: 0.35, y: 1.60, z: 0.85 },
  BACK: { x: 0.08, y: 1.48, z: -0.20 },
  CHEST: { x: 0.16, y: 1.08, z: 0.42 },
  ABDOMEN: { x: 0.22, y: 1.05, z: -0.15 },
  PELVIS: { x: 0.20, y: 1.35, z: -0.72 },
  LEFT_FRONT_LEG: { x: 0.12, y: 0.52, z: 0.48 },
  RIGHT_FRONT_LEG: { x: -0.32, y: 0.48, z: 0.28 },
  LEFT_HIND_LEG: { x: 0.12, y: 0.55, z: -1.05 },
  RIGHT_HIND_LEG: { x: -0.34, y: 0.55, z: -0.88 },
  OTHER: { x: 0.15, y: 1.15, z: 0 },
};

export const positionOfRegion = (region: BodyRegion): InjuryPosition => ({ ...REGION_POSITION[region] });

/**
 * Gợi ý phân vùng cơ thể (BodyRegion) từ toạ độ 3D tương đối trên mô hình ngựa.
 */
export function suggestBodyRegion(point: InjuryPosition): BodyRegion {
  const { x, y, z } = point;
  if (![x, y, z].every(Number.isFinite)) return 'OTHER';

  // 1. Chân (dưới khớp vai / hông: y < 0.85)
  if (y < 0.85) {
    if (z > -0.2) {
      return x >= -0.1 ? 'LEFT_FRONT_LEG' : 'RIGHT_FRONT_LEG';
    }
    return x >= -0.1 ? 'LEFT_HIND_LEG' : 'RIGHT_HIND_LEG';
  }

  // 2. Đầu: cao và phía trước
  if (z >= 0.95 && y >= 1.65) return 'HEAD';
  // 3. Cổ: giữa đầu và thân
  if (z >= 0.55 && y >= 1.25) return 'NECK';
  // 4. Ngực: phía trước, thấp hơn cổ
  if (z >= 0.25 && y < 1.35) return 'CHEST';
  // 5. Khung chậu / Mông: phía sau (z <= -0.45)
  if (z <= -0.45 && y >= 1.05) return 'PELVIS';
  // 6. Lưng: phía trên thân
  if (y >= 1.25) return 'BACK';
  // 7. Bụng: phía dưới thân giữa
  return 'ABDOMEN';
}
