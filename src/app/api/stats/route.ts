import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { hasPermission } from '@/lib/permission-check';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    const user = token ? await verifyToken(token) : null;
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }
    const canViewFullDashboard = hasPermission(user, 'dashboard');

    // 获取各种统计数据
    const customersCount = db.prepare('SELECT COUNT(*) as count FROM customers').get() as { count: number };
    const leadsCount = db.prepare('SELECT COUNT(*) as count FROM leads').get() as { count: number };
    const tasksCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get() as { count: number };
    const assetsCount = db.prepare('SELECT COUNT(*) as count FROM assets').get() as { count: number };
    const departmentsCount = db.prepare('SELECT COUNT(*) as count FROM departments').get() as { count: number };
    const distributorsCount = db.prepare('SELECT COUNT(*) as count FROM distributors').get() as { count: number };
    const accountsCount = db.prepare('SELECT COUNT(*) as count FROM accounts').get() as { count: number };
    const todosCount = db.prepare('SELECT COUNT(*) as count FROM todos').get() as { count: number };

    // 资产类型统计
    const assetsByType = db.prepare('SELECT type, COUNT(*) as count FROM assets GROUP BY type').all() as { type: string; count: number }[];

    // 任务状态统计
    const tasksByStatus = db.prepare('SELECT status, COUNT(*) as count FROM tasks GROUP BY status').all() as { status: string; count: number }[];

    // 部门列表
    const departments = db.prepare('SELECT id, name, status FROM departments').all() as { id: number; name: string; status: string }[];

    // 构建指标卡片数据
    const metricCards = [
      [
        { title: '新增客户(人)', value: customersCount.count, change: -56 },
        { title: '新增联系人(人)', value: Math.floor(customersCount.count * 0.5), change: -76 },
        { title: '新增商机(个)', value: leadsCount.count, change: 5 },
        { title: '新增合同(份)', value: Math.floor(leadsCount.count * 0.3), change: -81 },
      ],
      [
        { title: '合同金额(元)', value: leadsCount.count * 15000, change: 56 },
        { title: '回款金额(元)', value: leadsCount.count * 8000, change: -22 },
        { title: '新增跟进记录(条)', value: tasksCount.count * 10, change: -15 },
        { title: '待办事项(条)', value: todosCount.count, change: -81 },
      ],
    ];

    // 构建汇总卡片数据
    const summaryCards = [
      {
        title: '客户汇总',
        items: [
          { label: '新增客户', value: customersCount.count + '个' },
          { label: '转成交客户', value: '0个' },
        ],
      },
      {
        title: '跟进汇总',
        items: [
          { label: '跟进客户', value: Math.floor(customersCount.count * 0.3) + '个' },
          { label: '未跟进', value: customersCount.count + '个' },
        ],
      },
      {
        title: '商机汇总',
        items: [
          { label: '新增商机', value: leadsCount.count + '个' },
          { label: '商机总金额', value: (leadsCount.count * 15000).toLocaleString() + '元' },
        ],
      },
      {
        title: '合同汇总',
        items: [
          { label: '合同签订', value: Math.floor(leadsCount.count * 0.3) + '份' },
          { label: '合同金额', value: (leadsCount.count * 10000).toLocaleString() + '元' },
        ],
      },
      {
        title: '回款金额',
        items: [
          { label: '回款金额', value: (leadsCount.count * 8000).toLocaleString() + '.00元' },
          { label: '预计回款', value: (leadsCount.count * 12000).toLocaleString() + '.00元' },
        ],
      },
    ];

    // 合同金额图表数据
    const contractChartData = [
      { name: '1月', 金额: 15022, 当月目标金额: 20000 },
      { name: '2月', 金额: 10922, 当月目标金额: 18000 },
      { name: '3月', 金额: 18500, 当月目标金额: 22000 },
      { name: '4月', 金额: 12800, 当月目标金额: 15000 },
      { name: '5月', 金额: leadsCount.count * 8000, 当月目标金额: 25000 },
      { name: '6月', 金额: 0, 当月目标金额: 28000 },
    ];

    // 销售漏斗数据
    const funnelChartData = [
      { name: '初步接洽', value: leadsCount.count + 5 },
      { name: '需求确认', value: Math.floor(leadsCount.count * 0.7) + 3 },
      { name: '方案报价', value: Math.floor(leadsCount.count * 0.5) + 2 },
      { name: '谈判签约', value: Math.floor(leadsCount.count * 0.3) + 1 },
    ];

    // 遗忘提醒数据
    const reminderChartData = [
      { name: '7天未联系', value: 12 },
      { name: '15天未联系', value: 8 },
      { name: '30天未联系', value: 5 },
      { name: '3个月未联系', value: 3 },
      { name: '6个月未联系', value: 2 },
      { name: '逾期未联系', value: 1 },
    ];

    // 排行榜数据
    const leaderboardData = [
      { rank: 1, name: '张三', amount: 128500, target: 150000, rate: 86 },
      { rank: 2, name: '李四', amount: 98200, target: 120000, rate: 82 },
      { rank: 3, name: '王五', amount: 75600, target: 100000, rate: 76 },
      { rank: 4, name: '赵六', amount: 62300, target: 80000, rate: 78 },
      { rank: 5, name: '孙七', amount: 45800, target: 60000, rate: 76 },
    ];

    if (!canViewFullDashboard) {
      return NextResponse.json({
        success: true,
        data: {
          limited: true,
          leaderboardData,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        metricCards,
        summaryCards,
        contractChartData,
        funnelChartData,
        reminderChartData,
        leaderboardData,
        stats: {
          customers: customersCount.count,
          leads: leadsCount.count,
          tasks: tasksCount.count,
          assets: assetsCount.count,
          departments: departmentsCount.count,
          distributors: distributorsCount.count,
          accounts: accountsCount.count,
          todos: todosCount.count,
        },
        assetsByType,
        tasksByStatus,
        departments,
      },
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return NextResponse.json({ success: false, error: '获取统计数据失败' }, { status: 500 });
  }
}
