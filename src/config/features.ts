// Bật/tắt từng phần của ứng dụng. Menu, route, tab Huấn luyện của ngựa và các khối huấn luyện trên Tổng quan đọc cờ này.
export const FEATURES = {
  training: true,
  /** Nút "Bật cảm biến giả lập" trên thẻ giám sát ở Sân tập. Dự án chưa có thiết bị đo thật, tắt khi đã gắn thiết bị. */
  sensorSimulator: true,
  /** Flow 4 (không bắt buộc theo đề): chăm sóc chuồng, khẩu phần, checklist, sự cố, vật tư. */
  stableCare: true,
} as const;
