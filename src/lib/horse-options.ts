// Danh mục giống và màu lông cho ô chọn của hồ sơ ngựa.
// Backend lưu chữ tự do (giống ≤ 80, màu ≤ 40 ký tự), không có danh mục riêng. Giao diện lưu TÊN CHUẨN
// quốc tế (khớp dữ liệu đang có: Thoroughbred, Bay, Chestnut…) để tìm kiếm và thống kê không bị lệch
// cách viết; giống/màu hiếm vẫn nhập tay qua lựa chọn "Khác".

export interface HorseOption {
  /** Giá trị gửi backend. */
  value: string;
  /** Nhãn tiếng Việt ngắn. */
  label: string;
}

export const BREEDS: HorseOption[] = [
  { value: 'Thoroughbred', label: 'Thuần chủng Anh' },
  { value: 'Arabian', label: 'Ả Rập' },
  { value: 'Anglo Arabian', label: 'Anh Ả Rập' },
  { value: 'Quarter Horse', label: 'Quarter Horse' },
  { value: 'Standardbred', label: 'Standardbred' },
  { value: 'Appaloosa', label: 'Appaloosa' },
  { value: 'Akhal Teke', label: 'Akhal Teke' },
  { value: 'Vietnamese Native', label: 'Ngựa nội Việt Nam' },
];

export const COLORS: HorseOption[] = [
  { value: 'Bay', label: 'Nâu đỏ' },
  { value: 'Dark Bay', label: 'Nâu sẫm' },
  { value: 'Chestnut', label: 'Hạt dẻ' },
  { value: 'Black', label: 'Ô (đen)' },
  { value: 'Grey', label: 'Xám' },
  { value: 'White', label: 'Bạch (trắng)' },
  { value: 'Roan', label: 'Lang sương' },
  { value: 'Palomino', label: 'Vàng kem' },
  { value: 'Dun', label: 'Vàng xám' },
  { value: 'Buckskin', label: 'Vàng da bò' },
];

const find = (options: HorseOption[], value: string | null | undefined) =>
  value ? options.find((item) => item.value.toLowerCase() === value.trim().toLowerCase()) : undefined;

/** Có nằm trong danh mục không (so không phân biệt hoa thường). */
export const isPreset = (options: HorseOption[], value: string | null | undefined) => !!find(options, value);
/** Giá trị chuẩn trong danh mục (đúng hoa thường), hoặc chính giá trị nhập tay. */
export const canonical = (options: HorseOption[], value: string) => find(options, value)?.value ?? value;

/** Chữ trong ô chọn: nhãn tiếng Việt kèm tên gốc khi khác nhau. */
export const optionText = (item: HorseOption) => (item.label === item.value ? item.label : `${item.label} (${item.value})`);

/** Hiển thị giống: nhãn tiếng Việt nếu có trong danh mục, không thì giữ nguyên chữ đã lưu. */
export const breedLabel = (value: string | null | undefined) => (value ? (find(BREEDS, value)?.label ?? value) : undefined);
export const colorLabel = (value: string | null | undefined) => (value ? (find(COLORS, value)?.label ?? value) : undefined);

/** Nhãn đầy đủ kèm tên gốc — dùng khi cần phân biệt giá trị trong danh mục với chữ tự nhập trùng nghĩa. */
const fullText = (options: HorseOption[], value: string | null | undefined) => {
  if (!value) return undefined;
  const item = find(options, value);
  return item ? optionText(item) : value;
};
export const breedText = (value: string | null | undefined) => fullText(BREEDS, value);
export const colorText = (value: string | null | undefined) => fullText(COLORS, value);
