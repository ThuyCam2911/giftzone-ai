export default function SessionAlert({ status }: { status: string }) {
  if (status === 'ok') return null;

  const isExpired = status === 'expired';
  return (
    <div className={`rounded-lg px-4 py-3 text-sm mb-6 ${isExpired ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-yellow-50 text-yellow-800 border border-yellow-200'}`}>
      <span className="font-medium">{isExpired ? 'Session Zalo đã hết hạn.' : 'Cảnh báo: Session Zalo có thể sắp hết hạn.'}</span>
      {' '}Vào <code className="bg-black/10 px-1 rounded">chat.zalo.me</code> → F12 → Application → Cookies → copy toàn bộ → cập nhật <code className="bg-black/10 px-1 rounded">ZALO_COOKIE</code> trong <code className="bg-black/10 px-1 rounded">agent/.env</code> → restart agent.
    </div>
  );
}
