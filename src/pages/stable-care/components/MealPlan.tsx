// Khẩu phần theo bữa: dải 4 bữa trong ngày (Sáng sớm, Trưa, Chiều, Tối), mỗi bữa liệt kê món và lượng.
// Dùng ở tab Chăm sóc của hồ sơ ngựa và màn Việc hôm nay của Groom (nhấn bữa sắp tới).
import { Sun, Sunrise, Sunset, Moon } from 'lucide-react';
import { MEAL_ORDER } from '../../../api/stable-care';
import type { FeedingMeal, FeedingPlan } from '../../../api/types';
import { cn } from '../../../components/ui';
import { formatQuantity, mealText } from '../../../lib/stable-labels';

const MEAL_ICON: Record<FeedingMeal, typeof Sun> = { EARLY_MORNING: Sunrise, NOON: Sun, AFTERNOON: Sunset, EVENING: Moon };

export function MealPlan({ plan, highlight, compact = false, className }: { plan: FeedingPlan; highlight?: FeedingMeal; compact?: boolean; className?: string }) {
  return (
    <div className={cn('grid gap-2', compact ? 'grid-cols-1' : 'sm:grid-cols-2', className)}>
      {MEAL_ORDER.map((meal) => {
        const items = plan.meals.find((entry) => entry.meal === meal)?.items ?? [];
        const Icon = MEAL_ICON[meal];
        const on = highlight === meal;
        return (
          <section
            key={meal}
            className={cn(
              'rounded-xl px-3 py-2.5 ring-1 transition',
              on ? 'bg-emerald-50 shadow-grass-tint ring-emerald-300' : items.length ? 'bg-white ring-gray-200/80' : 'bg-gray-50/70 ring-gray-100',
            )}
          >
            <p className={cn('flex items-center gap-1.5 text-xs font-semibold', on ? 'text-emerald-800' : 'text-gray-500')}>
              <Icon size={13} /> {mealText[meal]}
              {on && <span className="ml-auto rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-semibold text-white">Bữa tới</span>}
            </p>
            {items.length === 0 ? (
              <p className="mt-1 text-xs text-gray-400">Không có</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {items.map((item) => (
                  <li key={item.supplyItemId} className="text-sm">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-gray-800">{item.name}</span>
                      <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-gray-900">
                        {formatQuantity(item.quantity)} {item.unit}
                      </span>
                    </span>
                    {item.note && <span className="block text-xs text-gray-500">{item.note}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
