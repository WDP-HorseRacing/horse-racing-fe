// Kết quả sau khi bấm Bắt đầu: ngựa nào tập, ngựa nào vắng và vì sao.
import { CheckCircle2, X } from 'lucide-react';
import { Notice } from '../../../components/ui';
import type { StartSessionResult } from '../../../services/session.service';

export default function StartResultNotice({
  result,
  onDismiss,
}: {
  result: StartSessionResult;
  onDismiss?: () => void;
}) {
  const auto = result.absent.filter((item) => item.auto);
  return (
    <Notice tone={auto.length > 0 ? 'warning' : 'success'} icon={<CheckCircle2 size={16} />}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-semibold">
            Buổi đã bắt đầu với {result.present.length} ngựa: {result.present.join(', ')}
            {result.targetHorseName ? ` · kịch bản áp vào ${result.targetHorseName}` : ''}
          </p>
          {result.absent.map((item) => (
            <p key={item.horseName}>
              <span className="font-semibold">{item.horseName}</span> vắng: {item.reason}
              {item.auto ? ' (hệ thống đánh dấu lúc bắt đầu)' : ''}
            </p>
          ))}
          {auto.length > 0 && <p className="text-xs opacity-80">Buổi vẫn chạy với {result.present.length} ngựa còn lại.</p>}
        </div>
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="rounded-md p-0.5 opacity-60 transition hover:opacity-100" aria-label="Đóng">
            <X size={15} />
          </button>
        )}
      </div>
    </Notice>
  );
}
