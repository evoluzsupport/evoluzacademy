'use client';
import { Empty, Guard, PageHead } from '@/components/ui';

export default function IntegrationsPage() {
  return (
    <Guard kinds={['admin']}>
      <PageHead title="Integrations" desc="Connect the academy with other tools." />
      <Empty>Nothing here yet.</Empty>
    </Guard>
  );
}
