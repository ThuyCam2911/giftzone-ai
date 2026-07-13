import { XCircle, AlertTriangle } from 'lucide-react';
import { getDict } from '@/lib/i18n/server';

export default async function SessionAlert({ status }: { status: string }) {
  if (status === 'ok') return null;
  const { t } = await getDict();

  const isExpired = status === 'expired';
  const Icon = isExpired ? XCircle : AlertTriangle;
  return (
    <div className="flex items-start gap-3 rounded-xl px-4 py-3 text-sm"
      style={isExpired
        ? { background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }
        : { background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }
      }>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold">{isExpired ? t('sessionAlert.expiredTitle') : t('sessionAlert.warningTitle')}</p>
        <p className="mt-0.5 opacity-80">
          {t('sessionAlert.body')}
        </p>
      </div>
    </div>
  );
}
