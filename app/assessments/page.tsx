'use client';
import { Empty, Guard, PageHead } from '@/components/ui';

export default function AssessmentsPage() {
  return (
    <Guard kinds={['admin']}>
      <PageHead title="Assessments" desc="Set up and review trainee assessments." />
      <Empty>Nothing here yet.</Empty>
    </Guard>
  );
}
