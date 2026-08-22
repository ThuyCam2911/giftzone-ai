export const dynamic = 'force-dynamic';

import MasterLayerShell from '@/components/MasterLayerShell';
import ZEnterpriseAccountsManager from '@/components/ZEnterpriseAccountsManager';
import { listZEnterpriseAccounts, listLinkCandidates } from '@/lib/queries/zenterprise';
import { getDict } from '@/lib/i18n/server';

export default async function ZEnterpriseAccountsPage() {
  const { t } = await getDict();
  const [accounts, candidates] = await Promise.all([
    listZEnterpriseAccounts(),
    listLinkCandidates(),
  ]);

  return (
    <MasterLayerShell title={t('ze.accounts.title')} subtitle={t('ze.accounts.subtitle')}>
      <div className="max-w-4xl">
        <ZEnterpriseAccountsManager initialAccounts={accounts} candidates={candidates} />
      </div>
    </MasterLayerShell>
  );
}
