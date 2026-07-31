'use client';

import { useLocale } from '@/components/LocaleProvider';

interface Props {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemLabel?: string;
}

export default function Pagination({ page, totalPages, onPageChange, totalItems, itemLabel }: Props) {
  const { t } = useLocale();
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
      <span className="text-xs text-gray-400">
        {t('common.page')} {page}/{totalPages}
        {totalItems !== undefined && itemLabel ? ` · ${totalItems} ${itemLabel}` : ''}
      </span>
      <div className="flex gap-1">
        <button onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-2.5 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
          {t('common.prev')}
        </button>
        <button onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="px-2.5 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
          {t('common.next')}
        </button>
      </div>
    </div>
  );
}
