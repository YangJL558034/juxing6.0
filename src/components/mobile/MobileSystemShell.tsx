'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Bot,
  Briefcase,
  Building,
  Building2,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  Clock,
  Contact,
  DollarSign,
  FileText,
  Folder,
  Home,
  Landmark,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Package,
  Receipt,
  Search,
  Settings,
  Share2,
  Sparkles,
  UserCog,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import MobilePersonnelPage from '@/components/mobile/MobilePersonnelPage';
import MobileDashboardPage from '@/components/mobile/MobileDashboardPage';
import MobileAssetsPage from '@/components/mobile/MobileAssetsPage';
import MobileSalaryPage from '@/components/mobile/MobileSalaryPage';
import MobileAdministrationPage from '@/components/mobile/MobileAdministrationPage';
import MobileProfilePage from '@/components/mobile/MobileProfilePage';
import MobileBusinessPage, { type MobileBusinessKey } from '@/components/mobile/MobileBusinessPage';
import MobileSettingsPage from '@/components/mobile/MobileSettingsPage';
import MobileAiChatPage from '@/components/mobile/MobileAiChatPage';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { navMenuItems, NavMenuItem } from '@/data/mockData';
import { cn } from '@/lib/utils';
import { logOperation, LogActions } from '@/lib/log';

const pageKeys = [
  'dashboard',
  'taskmanage',
  'distribution',
  'todo',
  'leads',
  'customers',
  'contacts',
  'contracts',
  'invoices',
  'followup',
  'products',
  'finance',
  'tasks',
  'salary',
  'generate',
  'ai-chat',
  'assets',
  'organization',
  'personnel',
  'administration',
  'human-resources',
  'permission',
  'purchase-requests',
  'expense-claims',
  'approval-center',
  'finance-review',
  'smtp',
  'usermanage',
  'operation-logs',
  'settings',
  'notification-center',
] as const;

type PageKey = (typeof pageKeys)[number];
type ActivePageKey = PageKey | 'profile';

type AppUser = {
  id: number;
  username: string;
  name: string;
  role: string;
  department?: string;
};

type MobileMenuItem = {
  key: PageKey;
  label: string;
  groupLabel: string;
  icon: string;
};

type MobileMenuGroup = {
  key: string;
  label: string;
  items: MobileMenuItem[];
};

const pageKeySet = new Set<string>(pageKeys);
const publicMobilePages = new Set<PageKey>(['dashboard', 'personnel', 'administration', 'salary']);

const pageTitleMap: Record<PageKey, string> = {
  dashboard: '仪表盘',
  taskmanage: '任务管理',
  distribution: '分销达人',
  todo: '待办事项',
  leads: '线索',
  customers: '客户管理',
  contacts: '联系人',
  contracts: '合同',
  invoices: '发票',
  followup: '回访记录',
  products: '产品',
  finance: '财务明细',
  tasks: '任务列表',
  salary: '工资工时',
  generate: '生成管理',
  'ai-chat': 'AI 对话',
  assets: '资产管理',
  organization: '组织管理',
  personnel: '人事管理',
  administration: '行政管理',
  'human-resources': '人力资源',
  permission: '权限管理',
  'purchase-requests': '请购单管理',
  'expense-claims': '费用报销',
  'approval-center': '审批中心',
  'finance-review': '财务终审',
  smtp: '邮件配置',
  usermanage: '用户管理',
  'operation-logs': '操作日志',
  settings: '系统设置',
  'notification-center': '通知中心',
};

const groupTitleMap: Record<string, string> = {
  quick: '常用功能',
  customer: '客户管理',
  business: '业务管理',
  workflow: '审批流程',
  organization: '组织人事',
  system: '系统管理',
};

const modulePermissionMap: Record<PageKey, string> = {
  dashboard: 'dashboard',
  taskmanage: 'taskmanage',
  distribution: 'distribution',
  todo: 'todo',
  leads: 'leads',
  customers: 'customers',
  contacts: 'contacts',
  contracts: 'contracts',
  invoices: 'invoices',
  followup: 'followup',
  products: 'products',
  finance: 'finance',
  tasks: 'tasks',
  salary: 'salary',
  generate: 'generate',
  'ai-chat': 'ai-chat',
  assets: 'assets',
  organization: 'organization',
  personnel: 'personnel',
  administration: 'administration',
  'human-resources': 'human-resources',
  permission: 'permission',
  'purchase-requests': 'purchase-requests',
  'expense-claims': 'expense-claims',
  'approval-center': 'approval-center',
  'finance-review': 'finance-review',
  smtp: 'smtp',
  usermanage: 'usermanage',
  'operation-logs': 'operation-logs',
  settings: 'settings',
  'notification-center': 'notification-center',
};

const iconMap: Record<string, React.ElementType> = {
  Bell,
  Bot,
  Briefcase,
  Building,
  Building2,
  CheckCircle,
  CheckSquare,
  Clock,
  Contact,
  DollarSign,
  FileText,
  Folder,
  Home,
  Landmark,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Package,
  Receipt,
  Settings,
  Share2,
  UserCog,
  Users,
};

const bottomNavItems: Array<{ key: ActivePageKey; label: string; icon: React.ElementType }> = [
  { key: 'dashboard', label: '首页', icon: LayoutDashboard },
  { key: 'personnel', label: '人事', icon: Users },
  { key: 'administration', label: '行政', icon: Home },
  { key: 'salary', label: '工资', icon: Clock },
  { key: 'profile', label: '我的', icon: UserRound },
];

const isPageKey = (key: string): key is PageKey => pageKeySet.has(key);

function flattenMobileMenu(menuItems: NavMenuItem[]): MobileMenuGroup[] {
  const quickItems: MobileMenuItem[] = [];
  const groups: MobileMenuGroup[] = [];

  menuItems.forEach((item) => {
    if (item.children?.length) {
      const groupLabel = groupTitleMap[item.key] || item.label;
      const childItems = item.children
        .filter((child) => isPageKey(child.key))
        .map((child) => ({
          key: child.key as PageKey,
          label: pageTitleMap[child.key as PageKey] || child.label,
          groupLabel,
          icon: child.icon,
        }));

      if (childItems.length) {
        groups.push({
          key: item.key,
          label: groupLabel,
          items: childItems,
        });
      }
      return;
    }

    if (isPageKey(item.key)) {
      quickItems.push({
        key: item.key,
        label: pageTitleMap[item.key],
        groupLabel: groupTitleMap.quick,
        icon: item.icon,
      });
    }
  });

  if (!quickItems.some((item) => item.key === 'dashboard')) {
    quickItems.unshift({
      key: 'dashboard',
      label: pageTitleMap.dashboard,
      groupLabel: groupTitleMap.quick,
      icon: 'LayoutDashboard',
    });
  }

  return [
    {
      key: 'quick',
      label: groupTitleMap.quick,
      items: quickItems,
    },
    ...groups,
  ].filter((group) => group.items.length > 0);
}

function getIcon(iconName: string) {
  return iconMap[iconName] || FileText;
}

function renderPage(
  activePage: ActivePageKey,
  user?: AppUser,
  onNavigate?: (key: string) => void,
  managementPermissions: Partial<Record<PageKey, boolean>> = {},
) {
  if (activePage === 'profile') {
    return <MobileProfilePage user={user} />;
  }

  switch (activePage) {
    case 'dashboard':
      return <MobileDashboardPage onNavigate={onNavigate} fullAccess={Boolean(managementPermissions.dashboard)} />;
    case 'taskmanage':
    case 'distribution':
    case 'todo':
    case 'leads':
    case 'customers':
    case 'contacts':
    case 'contracts':
    case 'invoices':
    case 'followup':
    case 'products':
    case 'finance':
    case 'tasks':
      return <MobileBusinessPage moduleKey={activePage as MobileBusinessKey} />;
    case 'salary':
      return <MobileSalaryPage user={user} canManage={Boolean(managementPermissions.salary)} />;
    case 'generate':
      return <MobileBusinessPage moduleKey="generate" />;
    case 'ai-chat':
      return <MobileAiChatPage user={user} />;
    case 'assets':
      return <MobileAssetsPage />;
    case 'organization':
      return <MobileBusinessPage moduleKey="organization" />;
    case 'personnel':
      return <MobilePersonnelPage canManage={Boolean(managementPermissions.personnel)} />;
    case 'administration':
      return <MobileAdministrationPage canManage={Boolean(managementPermissions.administration)} />;
    case 'human-resources':
      return <MobileBusinessPage moduleKey="human-resources" />;
    case 'permission':
      return <MobileBusinessPage moduleKey="permission" />;
    case 'purchase-requests':
      return <MobileBusinessPage moduleKey="purchase-requests" />;
    case 'expense-claims':
      return <MobileBusinessPage moduleKey="expense-claims" />;
    case 'approval-center':
      return <MobileBusinessPage moduleKey="approval-center" />;
    case 'finance-review':
      return <MobileBusinessPage moduleKey="finance-review" />;
    case 'usermanage':
      return <MobileBusinessPage moduleKey="usermanage" />;
    case 'smtp':
      return <MobileBusinessPage moduleKey="smtp" />;
    case 'operation-logs':
      return <MobileBusinessPage moduleKey="operation-logs" />;
    case 'settings':
      return <MobileSettingsPage />;
    case 'notification-center':
      return <MobileBusinessPage moduleKey="notification-center" />;
    default:
      return <MobileDashboardPage onNavigate={onNavigate} fullAccess={Boolean(managementPermissions.dashboard)} />;
  }
}

export default function MobileSystemShell({ user }: { user?: AppUser }) {
  const router = useRouter();
  const [activePage, setActivePage] = useState<ActivePageKey>('dashboard');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const savedPage = window.localStorage.getItem('mobile-active-page');
    if (savedPage === 'profile' || (savedPage && isPageKey(savedPage))) {
      setActivePage(savedPage);
    }
  }, []);

  useEffect(() => {
    const fetchPermissions = async () => {
      if (user?.role === 'admin') {
        setPermissions(pageKeys.map((key) => modulePermissionMap[key]));
        return;
      }

      try {
        const res = await fetch(`/api/permissions/check?userId=${user?.id}`);
        if (res.ok) {
          const data = await res.json();
          setPermissions(data.permissions || []);
        }
      } catch (error) {
        console.error('获取移动端权限失败', error);
      }
    };

    fetchPermissions();
  }, [user]);

  const hasModulePermission = useCallback(
    (page: PageKey) => {
      if (user?.role === 'admin') return true;
      return permissions.includes(modulePermissionMap[page]);
    },
    [permissions, user?.role],
  );

  const canAccessPage = useCallback(
    (page: PageKey) => publicMobilePages.has(page) || hasModulePermission(page),
    [hasModulePermission],
  );

  const menuGroups = useMemo(() => flattenMobileMenu(navMenuItems), []);

  const visibleGroups = useMemo(() => {
    return menuGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => canAccessPage(item.key)),
      }))
      .filter((group) => group.items.length > 0);
  }, [canAccessPage, menuGroups]);

  const filteredGroups = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return visibleGroups;

    return visibleGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          `${item.label} ${item.groupLabel}`.toLowerCase().includes(keyword),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [query, visibleGroups]);

  const visibleItems = useMemo(
    () => visibleGroups.flatMap((group) => group.items),
    [visibleGroups],
  );

  useEffect(() => {
    if (!visibleItems.length || activePage === 'profile') return;

    if (!canAccessPage(activePage)) {
      setActivePage(visibleItems[0].key);
    }
  }, [activePage, canAccessPage, visibleItems]);

  const activeItem = activePage === 'profile' ? undefined : visibleItems.find((item) => item.key === activePage);
  const activeTitle = activePage === 'profile' ? '我的' : activeItem?.label || pageTitleMap[activePage] || '移动端';

  const navigateTo = (item: MobileMenuItem) => {
    setActivePage(item.key);
    window.localStorage.setItem('mobile-active-page', item.key);
    setDrawerOpen(false);

    if (user?.id) {
      logOperation({
        module: item.key,
        action: LogActions.VIEW,
        details: { message: `移动端访问页面: ${item.label}` },
        userId: user.id,
        userName: user.name,
      }).catch((error) => console.error('记录移动端访问日志失败', error));
    }
  };

  const navigateByKey = (key: string) => {
    if (key === 'profile') {
      setActivePage('profile');
      window.localStorage.setItem('mobile-active-page', 'profile');
      setDrawerOpen(false);
      return;
    }

    const target = visibleItems.find((item) => item.key === key);
    if (target) {
      navigateTo(target);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/login?next=/mobile');
  };

  const canUseBottomItem = (key: ActivePageKey) => {
    return key === 'profile' || (isPageKey(key) && canAccessPage(key));
  };

  return (
    <div className="mobile-system-shell min-h-dvh bg-[#f5f7fb] text-slate-950">
      <header className="mobile-system-header mobile-status-glass fixed inset-x-0 top-0 z-40 border-b px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.45rem)]">
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-2xl border-white/75 bg-white/[0.68] shadow-sm backdrop-blur-xl"
            onClick={() => setDrawerOpen(true)}
            aria-label="打开功能菜单"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="min-w-0 flex-1 rounded-[20px] px-1 py-1 text-left"
          >
            <div className="flex items-center gap-1.5 text-slate-950">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span className="truncate text-sm font-bold">聚星移动端</span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-0.5 truncate text-xs text-slate-500">{activeTitle}</div>
          </button>

          <NotificationBell userId={user?.id || 0} userName={user?.name || ''} />
        </div>
      </header>

      <main className="mobile-system-content app-animated-surface px-3 pb-[calc(env(safe-area-inset-bottom)+5.75rem)] pt-[calc(env(safe-area-inset-top)+4.65rem)]">
        {visibleItems.length || activePage === 'profile' ? (
          <div key={activePage} className="mobile-system-page animate-in fade-in slide-in-from-bottom-2 duration-300">
            {renderPage(activePage, user, navigateByKey, {
              dashboard: hasModulePermission('dashboard'),
              personnel: hasModulePermission('personnel'),
              administration: hasModulePermission('administration'),
              salary: hasModulePermission('salary'),
            })}
          </div>
        ) : (
          <div className="rounded-[30px] border border-white/70 bg-white/[0.85] p-6 text-center shadow-sm backdrop-blur">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <X className="h-6 w-6 text-slate-500" />
            </div>
            <div className="text-base font-semibold">暂无可访问功能</div>
            <p className="mt-2 text-sm text-slate-500">请联系管理员为当前账号分配移动端对应权限。</p>
          </div>
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.55rem)] pt-1.5">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1 rounded-[26px] border border-white/70 bg-white/[0.92] p-1 shadow-[0_14px_34px_rgba(15,23,42,0.13)] backdrop-blur-2xl">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const active = item.key === activePage;
            const enabled = canUseBottomItem(item.key);
            return (
              <button
                key={item.key}
                type="button"
                disabled={!enabled}
                className={cn(
                  'flex min-w-0 flex-col items-center gap-0.5 rounded-[20px] px-1 py-1.5 text-[10px] font-medium transition',
                  active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950',
                  !enabled && 'cursor-not-allowed opacity-40',
                )}
                onClick={() => navigateByKey(item.key)}
              >
                <Icon className="h-4 w-4" />
                <span className="w-full truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="bottom" className="max-h-[88dvh] rounded-t-[32px] border-white/70 bg-white/95 p-0 backdrop-blur-2xl">
          <SheetHeader className="border-b border-slate-100 px-5 pb-4 pt-5 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-600 text-white">
                <Menu className="h-4 w-4" />
              </span>
              移动端功能
            </SheetTitle>
            <SheetDescription>这里的功能和后台系统共用同一套数据与审核流程。</SheetDescription>
          </SheetHeader>

          <div className="px-5 py-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索功能"
                className="h-12 rounded-[22px] border-slate-200 bg-slate-50 pl-10 text-base"
              />
            </div>
          </div>

          <ScrollArea className="h-[calc(88dvh-11rem)] px-5 pb-5">
            <div className="space-y-5">
              {filteredGroups.map((group) => (
                <section key={group.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700">{group.label}</h3>
                    <Badge variant="secondary" className="rounded-full">
                      {group.items.length}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map((item) => {
                      const Icon = getIcon(item.icon);
                      const active = item.key === activePage;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => navigateTo(item)}
                          className={cn(
                            'group flex min-h-16 items-center gap-3 rounded-[24px] border p-3 text-left transition active:scale-[0.98]',
                            active
                              ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm'
                              : 'border-white/80 bg-white text-slate-700 shadow-sm hover:border-blue-200 hover:bg-slate-50',
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition',
                              active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600',
                            )}
                          >
                            <Icon className="h-5 w-5" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{item.label}</span>
                            <span className="block truncate text-xs text-slate-400">{item.groupLabel}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}

              {filteredGroups.length === 0 && (
                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                  没有找到匹配的功能
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-5">
            <Button type="button" variant="outline" className="h-12 rounded-[22px]" onClick={() => router.push('/')}>
              打开电脑端
            </Button>
            <Button type="button" variant="destructive" className="h-12 rounded-[22px]" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
