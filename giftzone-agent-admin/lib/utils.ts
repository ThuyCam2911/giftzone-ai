export function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  return `${Math.floor(hrs / 24)} ngày trước`;
}

export function toVNDateString(date: Date): string {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export function defaultDateRange(daysBack = 6): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  return { from: toVNDateString(from), to: toVNDateString(to) };
}

export function toRangeTimestamps(from: string, to: string) {
  return {
    fromTs: `${from}T00:00:00+07:00`,
    toTs: `${to}T23:59:59+07:00`,
  };
}
