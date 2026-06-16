export default function StatsCard({
  label, value, sub, icon, accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: string;
  accent?: 'green' | 'orange' | 'blue' | 'purple';
}) {
  const colors = {
    green:  { bg: '#e6f9f1', text: '#02AD64', bar: '#02AD64' },
    orange: { bg: '#fff3eb', text: '#FF6900', bar: '#FF6900' },
    blue:   { bg: '#eff6ff', text: '#2563eb', bar: '#2563eb' },
    purple: { bg: '#f5f3ff', text: '#7c3aed', bar: '#7c3aed' },
  };
  const c = colors[accent ?? 'green'];

  return (
    <div className="card-lift bg-white rounded-2xl p-5 relative overflow-hidden"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)' }}>
      {/* top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
        style={{ background: c.bar }} />

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: '#9ca3af' }}>{label}</p>
          <p className="text-3xl font-bold mt-2 leading-none"
            style={{ color: '#111827' }}>{value}</p>
          {sub && <p className="text-xs mt-2" style={{ color: '#9ca3af' }}>{sub}</p>}
        </div>
        {icon && (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: c.bg }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
