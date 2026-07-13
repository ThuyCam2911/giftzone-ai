import { query } from '@/lib/db';

export interface ZEnterpriseAccount {
  id: number;
  account_name: string;
  phone: string | null;
  branch: string | null;
  role: 'sales' | 'cs' | 'manager' | 'technical';
  status: 'active' | 'inactive';
  linked_sender_uid: string | null;
  linked_sender_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface LinkCandidate {
  sender_uid: string;
  sender_name: string;
  msg_count: number;
}

export async function ensureZEnterpriseTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS zenterprise_accounts (
      id                  SERIAL PRIMARY KEY,
      account_name        TEXT NOT NULL,
      phone               TEXT,
      branch              TEXT,
      role                TEXT NOT NULL DEFAULT 'sales',
      status              TEXT NOT NULL DEFAULT 'active',
      linked_sender_uid   TEXT,
      created_at          TIMESTAMPTZ DEFAULT NOW(),
      updated_at          TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function listZEnterpriseAccounts(): Promise<ZEnterpriseAccount[]> {
  await ensureZEnterpriseTable();
  return query<ZEnterpriseAccount>(
    `SELECT z.id, z.account_name, z.phone, z.branch, z.role, z.status,
            z.linked_sender_uid,
            (SELECT MAX(m.sender_name) FROM messages m WHERE m.sender_uid = z.linked_sender_uid) AS linked_sender_name,
            z.created_at, z.updated_at
     FROM zenterprise_accounts z
     ORDER BY z.created_at ASC`,
  );
}

export async function listLinkCandidates(): Promise<LinkCandidate[]> {
  return query<LinkCandidate>(
    `SELECT sender_uid, MAX(sender_name) AS sender_name, COUNT(*)::int AS msg_count
     FROM messages
     WHERE sender_uid IS NOT NULL AND sender_name IS NOT NULL
     GROUP BY sender_uid
     ORDER BY msg_count DESC
     LIMIT 100`,
  );
}
