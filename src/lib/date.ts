// Ngày/giờ theo MÚI GIỜ ĐỊA PHƯƠNG của trình duyệt.
// Không dùng `new Date().toISOString()` để lấy "hôm nay": hàm đó trả về giờ UTC nên
// ở Việt Nam (UTC+7) trước 07:00 sáng nó vẫn ra ngày hôm qua.
const pad = (n: number) => String(n).padStart(2, '0');

export const localDateStr = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const localDateTimeStr = (d: Date = new Date()): string =>
  `${localDateStr(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Bỏ dấu tiếng Việt + chữ thường, để "pham quang minh" khớp "Phạm Quang Minh". */
export const normalizeText = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim();

/** Tuổi tính từ ngày sinh YYYY-MM-DD; trả về null nếu ngày sinh không hợp lệ. */
export const ageFromDob = (dob: string, now: Date = new Date()): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) age--;
  return age >= 0 ? age : null;
};
