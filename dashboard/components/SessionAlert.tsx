export default function SessionAlert({ status }: { status: string }) {
  if (status === 'ok') return null;

  const isExpired = status === 'expired';
  return (
    <div className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm"
      style={isExpired
        ? { background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }
        : { background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }
      }>
      <span className="text-lg mt-0.5">{isExpired ? '🔴' : '⚠️'}</span>
      <div>
        <p className="font-semibold">{isExpired ? 'Session Zalo đã hết hạn.' : 'Cảnh báo: Session Zalo có thể sắp hết hạn.'}</p>
        <p className="mt-0.5 opacity-80">
          Vào <code className="bg-black/10 px-1 rounded text-xs">chat.zalo.me</code> → F12 → Application → Cookies → copy toàn bộ → cập nhật <code className="bg-black/10 px-1 rounded text-xs">ZALO_COOKIE</code> trong <code className="bg-black/10 px-1 rounded text-xs">agent/.env</code> → restart agent.
        </p>
      </div>
    </div>
  );
}
