import { useService } from '../../../hooks/useService';
import { listAuditForHorse } from '../../../services/system.service';
import { AuditList } from '../../admin/AuditList';
import { Skeleton } from '../../../components/ui';

export default function AuditTab({ horseId }: { horseId: string }) {
  const { data, loading } = useService(() => listAuditForHorse(horseId), [horseId]);
  if (loading) return <Skeleton rows={4} />;
  return <AuditList rows={data ?? []} />;
}
