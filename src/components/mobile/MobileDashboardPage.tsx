'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Bell,
  Briefcase,
  Building2,
  CheckSquare,
  Clock,
  Folder,
  Info,
  Loader2,
  RefreshCcw,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StatsPayload {
  success: boolean;
  data?: {
    stats?: {
      customers?: number;
      leads?: number;
      tasks?: number;
      assets?: number;
      departments?: number;
      distributors?: number;
      accounts?: number;
      todos?: number;
    };
    assetsByType?: Array<{ type: string; count: number }>;
    tasksByStatus?: Array<{ status: string; count: number }>;
    departments?: Array<{ id: number; name: string; status: string }>;
    leaderboardData?: Array<{ rank: number; name: string; amount: number; target: number; rate: number }>;
  };
}

const quickCards = [
  { key: 'personnel', label: '人事管理', desc: '入职、转正、离职', icon: Users, tone: 'bg-blue-50 text-blue-600' },
  { key: 'administration', label: '行政管理', desc: '住宿、水表、房号', icon: Briefcase, tone: 'bg-emerald-50 text-emerald-600' },
  { key: 'salary', label: '工资工时', desc: '工资表和工时查询', icon: Clock, tone: 'bg-orange-50 text-orange-600' },
  { key: 'assets', label: '资产管理', desc: '资产和二维码', icon: Folder, tone: 'bg-violet-50 text-violet-600' },
];

export default function MobileDashboardPage({ onNavigate, fullAccess = true }: { onNavigate?: (key: string) => void; fullAccess?: boolean }) {
  const [stats, setStats] = useState<StatsPayload['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/stats', { cache: 'no-store' });
      const result = await response.json().catch(() => ({})) as StatsPayload;
      if (!response.ok || !result.success) {
        throw new Error('获取统计数据失败');
      }
      setStats(result.data || null);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '获取统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStats();
  }, []);

  const statCards = useMemo(() => [
    { label: '客户', value: stats?.stats?.customers ?? 0, icon: Building2, tone: 'bg-blue-50 text-blue-600' },
    { label: '线索', value: stats?.stats?.leads ?? 0, icon: Archive, tone: 'bg-cyan-50 text-cyan-600' },
    { label: '待办', value: stats?.stats?.todos ?? 0, icon: CheckSquare, tone: 'bg-orange-50 text-orange-600' },
    { label: '资产', value: stats?.stats?.assets ?? 0, icon: Folder, tone: 'bg-violet-50 text-violet-600' },
  ], [stats]);

  const leaderboardData = stats?.leaderboardData || [];
  const maxLeaderboardAmount = Math.max(...leaderboardData.map((item) => item.amount), 1);

  if (!fullAccess) {
    return (
      <div className="space-y-4">
        <section className="mobile-ios-glass rounded-[30px] p-5 text-slate-950">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/[0.58] px-2.5 py-1 text-xs font-medium text-blue-700 backdrop-blur-xl">
                <Sparkles className="h-3.5 w-3.5" />
                首页
              </div>
              <h1 className="mt-4 text-2xl font-bold tracking-normal">聚星数据平台</h1>
              <p className="mt-2 max-w-xs text-sm leading-6 text-slate-600">查看销售排行榜和系统介绍。</p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-11 w-11 shrink-0 rounded-2xl border border-white/70 bg-white/[0.58] text-blue-700 shadow-sm backdrop-blur-xl hover:bg-white/75"
              onClick={() => void loadStats()}
              disabled={loading}
            >
              <RefreshCcw className={cn('h-5 w-5', loading && 'animate-spin')} />
            </Button>
          </div>
        </section>

        <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
              <Trophy className="h-5 w-5 text-amber-500" />
              销售排行榜
            </h2>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
          </div>
          <div className="space-y-3">
            {leaderboardData.map((item) => (
              <div key={item.rank} className="rounded-2xl bg-slate-50 p-3">
                <div className="mb-2 flex items-center gap-3">
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
                      item.rank === 1 && 'bg-yellow-400 text-yellow-950',
                      item.rank === 2 && 'bg-slate-300 text-slate-800',
                      item.rank === 3 && 'bg-amber-600 text-white',
                      item.rank > 3 && 'bg-white text-slate-600 ring-1 ring-slate-200',
                    )}
                  >
                    {item.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-slate-950">{item.name}</div>
                    <div className="text-xs text-slate-500">完成率 {item.rate}%</div>
                  </div>
                  <div className="text-sm font-bold text-slate-950">¥{item.amount.toLocaleString()}</div>
                </div>
                <div className="h-2 rounded-full bg-white">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{ width: `${Math.max(8, Math.round((item.amount / maxLeaderboardAmount) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
            {!loading && leaderboardData.length === 0 && (
              <div className="rounded-2xl bg-slate-50 px-3 py-8 text-center text-sm text-slate-500">暂无销售排行数据</div>
            )}
          </div>
        </section>

        <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950">
            <Info className="h-5 w-5 text-blue-600" />
            软件介绍
          </h2>
          <div className="mt-4 space-y-3">
            {[
              { title: '客户业务', text: '客户、线索、合同、发票和回访统一管理。' },
              { title: '人事行政', text: '入职、请假、住宿、社保和行政记录集中处理。' },
              { title: '工资资产', text: '工资表、打卡记录、签字确认和资产分类移动查询。' },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl bg-slate-50 p-3">
                <div className="font-semibold text-slate-950">{item.title}</div>
                <p className="mt-1 text-sm leading-6 text-slate-600">{item.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="mobile-ios-glass rounded-[30px] p-5 text-slate-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/[0.58] px-2.5 py-1 text-xs font-medium text-blue-700 backdrop-blur-xl">
              <Sparkles className="h-3.5 w-3.5" />
              移动工作台
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-normal">聚星移动端</h1>
            <p className="mt-2 max-w-xs text-sm leading-6 text-slate-600">
              手机端处理审核、查询、工资、资产和行政事项。
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-11 w-11 shrink-0 rounded-2xl border border-white/70 bg-white/[0.58] text-blue-700 shadow-sm backdrop-blur-xl hover:bg-white/75"
            onClick={() => void loadStats()}
            disabled={loading}
          >
            <RefreshCcw className={cn('h-5 w-5', loading && 'animate-spin')} />
          </Button>
        </div>

        <div className="mobile-ios-tile mt-5 rounded-3xl p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500 text-white">
              <Bell className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">今日提醒</div>
              <div className="mt-0.5 truncate text-xs text-slate-500">
                {loading ? '正在同步数据' : error || `当前有 ${stats?.stats?.todos ?? 0} 条待办事项`}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {statCards.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-2xl', item.tone)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-4 text-2xl font-bold text-slate-950">{loading ? '-' : item.value}</div>
              <div className="mt-1 text-sm text-slate-500">{item.label}</div>
            </div>
          );
        })}
      </section>

      <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-950">常用功能</h2>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {quickCards.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate?.(item.key)}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-3 text-left transition active:scale-[0.98]"
              >
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-2xl', item.tone)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-950">{item.label}</div>
                <div className="mt-1 text-xs text-slate-500">{item.desc}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-950">资产分类</h2>
        <div className="mt-3 space-y-2">
          {(stats?.assetsByType || []).slice(0, 5).map((item) => (
            <div key={item.type} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
              <span className="min-w-0 truncate text-sm text-slate-700">{item.type || '未分类'}</span>
              <span className="text-sm font-semibold text-slate-950">{item.count}</span>
            </div>
          ))}
          {!loading && (stats?.assetsByType || []).length === 0 && (
            <div className="rounded-2xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">暂无资产分类</div>
          )}
        </div>
      </section>
    </div>
  );
}
