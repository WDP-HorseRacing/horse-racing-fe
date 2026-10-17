// Tọa độ 3D của chấn thương (BE bắt buộc `position {x,y,z}`). Web chưa có mô hình 3D nên gắn một điểm cố định
// cho mỗi vùng cơ thể bác sĩ chọn. Quy ước (ngựa đứng, nhìn từ bên trái, gốc ở giữa thân):
//   x: trước (+) / sau (−), y: trên (+) / dưới (−), z: trái (−) / phải (+). Đơn vị tương đối, khoảng −1 đến 1.
// Khi có mô hình 3D thật (vd bên mobile) thì chỉ cần khớp lại bảng này.
import type { BodyRegion } from '../api/types';

export interface InjuryPosition {
  x: number;
  y: number;
  z: number;
}

export const REGION_POSITION: Record<BodyRegion, InjuryPosition> = {
  HEAD: { x: 0.9, y: 0.6, z: 0 },
  NECK: { x: 0.65, y: 0.4, z: 0 },
  BACK: { x: 0, y: 0.35, z: 0 },
  CHEST: { x: 0.5, y: -0.05, z: 0 },
  ABDOMEN: { x: 0, y: -0.2, z: 0 },
  PELVIS: { x: -0.6, y: 0.25, z: 0 },
  LEFT_FRONT_LEG: { x: 0.45, y: -0.7, z: -0.2 },
  RIGHT_FRONT_LEG: { x: 0.45, y: -0.7, z: 0.2 },
  LEFT_HIND_LEG: { x: -0.55, y: -0.7, z: -0.2 },
  RIGHT_HIND_LEG: { x: -0.55, y: -0.7, z: 0.2 },
  OTHER: { x: 0, y: 0, z: 0 },
};

export const positionOfRegion = (region: BodyRegion): InjuryPosition => ({ ...REGION_POSITION[region] });
