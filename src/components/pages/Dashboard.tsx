'use client';

import React, { useState, useEffect } from 'react';
import { Info, RefreshCw, Sparkles, TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

interface MetricCard {
  title: string;
  value: number;
  change: number;
}

interface SummaryCard {
  title: string;
  items: { label: string; value: string }[];
}

interface Stats {
  limited?: boolean;
  metricCards: MetricCard[][];
  summaryCards: SummaryCard[];
  contractChartData: { name: string; 金额: number; 当月目标金额: number }[];
  funnelChartData: { name: string; value: number }[];
  reminderChartData: { name: string; value: number }[];
  leaderboardData: { rank: number; name: string; amount: number; target: number; rate: number }[];
}

function SoftwareIntroCard() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Info className="h-4 w-4 text-blue-600" />
          软件介绍
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-3">
        {[
          { title: '客户与业务', text: '集中管理客户、线索、合同、发票、回访和任务，减少重复录入。' },
          { title: '组织与流程', text: '覆盖人事、行政、审批、通知和权限分配，让后台管理更清晰。' },
          { title: '工资与资产', text: '支持工资工时查询、打卡记录、员工签字确认和资产分类管理。' },
        ].map((item) => (
          <div key={item.title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="font-semibold text-slate-900">{item.title}</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SalesLeaderboardView({ stats }: { stats: Stats }) {
  const maxAmount = Math.max(...stats.leaderboardData.map((item) => item.amount), 1);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Trophy className="h-4 w-4 text-amber-500" />
            销售排行榜可视化
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.leaderboardData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94A3B8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94A3B8" />
                <Tooltip
                  formatter={(value) => [`¥${Number(value).toLocaleString()}`, '销售金额']}
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="amount" fill="#2563EB" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-5 space-y-3">
            {stats.leaderboardData.map((item) => (
              <div key={item.rank} className="flex items-center gap-4">
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold',
                    item.rank === 1 && 'bg-yellow-400 text-yellow-950',
                    item.rank === 2 && 'bg-slate-300 text-slate-800',
                    item.rank === 3 && 'bg-amber-600 text-white',
                    item.rank > 3 && 'bg-slate-100 text-slate-600',
                  )}
                >
                  {item.rank}
                </span>
                <div className="w-20 font-medium text-slate-800">{item.name}</div>
                <div className="h-2 flex-1 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{ width: `${Math.max(8, Math.round((item.amount / maxAmount) * 100))}%` }}
                  />
                </div>
                <div className="w-28 text-right font-semibold text-slate-900">¥{item.amount.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <SoftwareIntroCard />
    </div>
  );
}

export function Dashboard({ fullAccess = true }: { fullAccess?: boolean }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setIsRefreshing(true);
      const res = await fetch('/api/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // 自动刷新 - 每30秒更新一次数据
  const { refreshNow } = useAutoRefresh({
    enabled: true,
    interval: 30000,
    onRefresh: fetchStats,
  });

  // 初始加载
  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="p-3 sm:p-4 lg:p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-500">加载中...</div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-3 sm:p-4 lg:p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-500">暂无数据</div>
        </div>
      </div>
    );
  }

  if (!fullAccess) {
    return (
      <div className="p-3 sm:p-4 lg:p-6">
        <SalesLeaderboardView stats={stats} />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      {/* Filters and Refresh */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-6">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-sm text-slate-600 whitespace-nowrap">部门：</span>
          <Select defaultValue="department">
            <SelectTrigger className="w-full sm:w-48 h-9">
              <SelectValue placeholder="选择部门" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="department">本部门及下属部门</SelectItem>
              <SelectItem value="all">全部部门</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-sm text-slate-600 whitespace-nowrap">时间：</span>
          <Select defaultValue="month">
            <SelectTrigger className="w-full sm:w-36 h-9">
              <SelectValue placeholder="选择时间" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">本月</SelectItem>
              <SelectItem value="quarter">本季度</SelectItem>
              <SelectItem value="year">本年</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="ml-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={refreshNow}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.metricCards[0].map((card, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <p className="text-sm text-slate-500 mb-2">{card.title}</p>
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold text-slate-800">
                  {card.value.toLocaleString()}
                </span>
                <div
                  className={cn(
                    'flex items-center text-sm',
                    card.change >= 0 ? 'text-green-600' : 'text-red-500'
                  )}
                >
                  {card.change >= 0 ? (
                    <TrendingUp className="w-4 h-4 mr-1" />
                  ) : (
                    <TrendingDown className="w-4 h-4 mr-1" />
                  )}
                  <span>{Math.abs(card.change)}%</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1">较上月</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.metricCards[1].map((card, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <p className="text-sm text-slate-500 mb-2">{card.title}</p>
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold text-slate-800">
                  {card.value >= 10000
                    ? (card.value / 10000).toFixed(1) + '万'
                    : card.value.toLocaleString()}
                </span>
                <div
                  className={cn(
                    'flex items-center text-sm',
                    card.change >= 0 ? 'text-green-600' : 'text-red-500'
                  )}
                >
                  {card.change >= 0 ? (
                    <TrendingUp className="w-4 h-4 mr-1" />
                  ) : (
                    <TrendingDown className="w-4 h-4 mr-1" />
                  )}
                  <span>{Math.abs(card.change)}%</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1">较上月</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {stats.summaryCards.map((summary, index) => (
          <Card key={index} className="border-blue-200 bg-blue-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-700">
                {summary.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {summary.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm py-1">
                  <span className="text-slate-500">{item.label}</span>
                  <span className="font-medium text-slate-700">{item.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Contract Amount Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              合同金额目标及完成情况
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.contractChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94A3B8" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#94A3B8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="金额"
                    stroke="#3B82F6"
                    fill="#3B82F6"
                    fillOpacity={0.3}
                  />
                  <Area
                    type="monotone"
                    dataKey="当月目标金额"
                    stroke="#10B981"
                    fill="#10B981"
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Performance Gauge */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              业绩指标完成率(回款金额)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center h-72">
              <div className="relative w-48 h-48">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="80"
                    fill="none"
                    stroke="#E2E8F0"
                    strokeWidth="16"
                  />
                  <circle
                    cx="96"
                    cy="96"
                    r="80"
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth="16"
                    strokeDasharray={`${0.5 * 502.65} 502.65`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold text-slate-800">50%</span>
                  <span className="text-sm text-slate-500">完成率</span>
                </div>
              </div>
              <div className="mt-4 text-center">
                <p className="text-sm text-slate-500">目标: ¥126,800.00</p>
                <p className="text-sm text-slate-500">回款金额: ¥63,400.00</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Sales Funnel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">
              销售漏斗(商机组:系统默认)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.funnelChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="#94A3B8" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} stroke="#94A3B8" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Reminder Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">遗忘提醒</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 flex items-center">
              <div className="w-1/2">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={stats.reminderChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {stats.reminderChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-1/2 pl-4">
                {stats.reminderChartData.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm py-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-slate-600">{item.name}</span>
                    <span className="ml-auto font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Leaderboard */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">排行榜</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.leaderboardData.map((item) => (
              <div key={item.rank} className="flex items-center gap-4">
                <span
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium',
                    item.rank === 1 && 'bg-yellow-400 text-yellow-900',
                    item.rank === 2 && 'bg-gray-300 text-gray-700',
                    item.rank === 3 && 'bg-amber-600 text-white',
                    item.rank > 3 && 'bg-slate-100 text-slate-600'
                  )}
                >
                  {item.rank}
                </span>
                <span className="font-medium text-slate-700 w-16">{item.name}</span>
                <span className="text-slate-600 w-28">
                  ¥{item.amount.toLocaleString()}
                </span>
                <div className="flex-1">
                  <Progress value={item.rate} className="h-2" />
                </div>
                <span className="text-sm text-slate-500 w-12 text-right">
                  {item.rate}%
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
