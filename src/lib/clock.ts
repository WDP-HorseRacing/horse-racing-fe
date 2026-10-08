// Nguồn thời gian duy nhất của ứng dụng.
// Mọi quy tắc thời gian phải gọi now() — không gọi Date.now() rải rác trong màn hình.
export function now(): Date {
  return new Date();
}
