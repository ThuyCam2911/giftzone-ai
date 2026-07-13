'use client';
import { useState } from 'react';
import { useLocale } from '@/components/LocaleProvider';

export default function LoginPage() {
  const { t, locale, setLocale } = useLocale();
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      window.location.href = '/overview';
    } else {
      const data = await res.json();
      setError(data.error ?? t('login.wrongPassword'));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative">
      <div className="absolute top-4 right-4 flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
        {(['vi', 'en'] as const).map(l => (
          <button
            key={l}
            onClick={() => setLocale(l)}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors uppercase"
            style={locale === l ? { background: 'white', color: '#018a4e', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' } : { color: '#9ca3af' }}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-gray-900">{t('login.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('login.subtitle')}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder={t('login.password')}
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t('login.submitting') : t('login.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
