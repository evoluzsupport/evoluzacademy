'use client';
import { Empty, Guard, PageHead } from '@/components/ui';

export default function AvailabilityPage() {
  return (
    <Guard kinds={['admin']}>
      <PageHead title="Availability" desc="Manage trainer availability." />
      <Empty>Nothing here yet.</Empty>
    </Guard>
  );
}
