'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header, Sidebar } from '@/components/layout';
import { Dashboard } from '@/components/pages/Dashboard';
import { TodoPage } from '@/components/pages/TodoPage';
import { LeadsPage } from '@/components/pages/LeadsPage';
import { CustomersPage } from '@/components/pages/CustomersPage';
import { TasksPage } from '@/components/pages/TasksPage';
import { AssetsPage } from '@/components/pages/AssetsPage';
import UserManagePage from '@/components/pages/UserManagePage';
import SmtpConfigPage from '@/components/pages/SmtpConfigPage';
import OperationLogsPage from '@/components/pages/OperationLogsPage';
import { SettingsPage } from '@/components/pages/SettingsPage';
import TaskManagePage from '@/components/pages/TaskManagePage';
import DistributionPage from '@/components/pages/DistributionPage';
import { GeneratePage } from '@/components/pages/GeneratePage';
import SalaryPage, { type SalarySectionKey } from '@/components/pages/SalaryPage';
import ContactsPage from '@/components/pages/ContactsPage';
import ContractsPage from '@/components/pages/ContractsPage';
import InvoicesPage from '@/components/pages/InvoicesPage';
import VisitsPage from '@/components/pages/VisitsPage';
import ProductsPage from '@/components/pages/ProductsPage';
import FinancePage from '@/components/pages/FinancePage';
import PurchaseRequestsPage from '@/components/pages/PurchaseRequestsPage';
import ExpenseClaimsPage from '@/components/pages/ExpenseClaimsPage';
import OrganizationPage from '@/components/pages/OrganizationPage';
import PersonnelPage, { type PersonnelSectionKey } from '@/components/pages/PersonnelPage';
import AdministrationPage, { type AdministrationSectionKey } from '@/components/pages/AdministrationPage';
import HumanResourcesPage from '@/components/pages/HumanResourcesPage';
import PermissionPage from '@/components/pages/PermissionPage';
import ApprovalCenter from '@/components/pages/ApprovalCenter';
import FinanceReviewPage from '@/components/pages/FinanceReviewPage';
import AIChatPage from '@/app/ai-chat/page';
import NotificationCenterPage from '@/components/pages/NotificationCenterPage';
import { logOperation, LogActions } from '@/lib/log';

type PageKey = 'dashboard' | 'taskmanage' | 'distribution' | 'todo' | 'leads' | 'customers' | 'contacts' | 'contracts' | 'invoices' | 'followup' | 'products' | 'finance' | 'tasks' | 'salary' | 'generate' | 'ai-chat' | 'assets' | 'organization' | 'personnel' | 'administration' | 'human-resources' | 'permission' | 'purchase-requests' | 'expense-claims' | 'approval-center' | 'finance-review' | 'smtp' | 'usermanage' | 'operation-logs' | 'settings' | 'notification-center';

const pageNames: Record<string, string> = {
  dashboard: '仪表板',
  taskmanage: '任务管理',
  distribution: '客户分配',
  todo: '待办事项',
  leads: '潜在客户',
  customers: '客户管理',
  contacts: '联系人',
  contracts: '合同管理',
  invoices: '发票管理',
  followup: '客户跟进',
  products: '产品管理',
  finance: '财务管理',
  tasks: '任务管理',
  salary: '工资管理',
  'salary-employees': '员工管理',
  'salary-detail': '工资明细',
  'salary-workhours': '工时记录',
  'salary-attendance': '打卡记录',
  generate: '工资生成',
  'ai-chat': 'AI聊天',
  assets: '资产管理',
  'assets-overview': '资产总览',
  organization: '组织管理',
  personnel: '人事管理',
  'personnel-onboarding': '入职登记',
  'personnel-social-security': '社保管理',
  'personnel-social-security-purchase': '购买社保',
  'personnel-regularization': '转正申请',
  'personnel-work-certificate': '工作证明',
  'personnel-resignation': '离职申请',
  'personnel-resignation-certificate': '离职证明',
  'personnel-labor-termination': '解除劳动合同',
  'personnel-leave-request': '请假申请',
  administration: '行政管理',
  'administration-dormitory': '住宿申请',
  'administration-rooms': '房号管理',
  'administration-beds': '床号管理',
  'administration-water-meter': '水表记录',
  'human-resources': '人力资源',
  permission: '权限管理',
  'purchase-requests': '采购申请',
  'expense-claims': '费用报销',
  'approval-center': '审批中心',
  'finance-review': '财务审批',
  smtp: '邮件配置',
  usermanage: '用户管理',
  'operation-logs': '操作日志',
  settings: '系统设置',
  'notification-center': '通知中心',
};

const pagePermissionMap: Record<string, string> = {
  personnel: 'personnel',
  'personnel-onboarding': 'personnel',
  'personnel-social-security': 'personnel',
  'personnel-social-security-purchase': 'personnel',
  'personnel-regularization': 'personnel',
  'personnel-work-certificate': 'personnel',
  'personnel-resignation': 'personnel',
  'personnel-resignation-certificate': 'personnel',
  'personnel-labor-termination': 'personnel',
  'personnel-leave-request': 'personnel',
  assets: 'assets',
  'assets-overview': 'assets',
  administration: 'administration',
  'administration-dormitory': 'administration',
  'administration-items': 'administration',
  'administration-rooms': 'administration',
  'administration-beds': 'administration',
  'administration-water-meter': 'administration',
  'human-resources': 'human-resources',
  salary: 'salary',
  'salary-employees': 'salary',
  'salary-detail': 'salary',
  'salary-workhours': 'salary',
  'salary-attendance': 'salary',
};

const personnelSectionMap: Record<string, { section: PersonnelSectionKey; label: string }> = {
  'personnel-onboarding': { section: 'onboarding', label: '入职登记' },
  'personnel-social-security': { section: 'social-security', label: '社保管理' },
  'personnel-social-security-purchase': { section: 'social-security-purchase', label: '购买社保' },
  'personnel-regularization': { section: 'regularization', label: '转正申请' },
  'personnel-work-certificate': { section: 'work-certificate', label: '工作证明' },
  'personnel-resignation': { section: 'resignation', label: '离职申请' },
  'personnel-resignation-certificate': { section: 'resignation-certificate', label: '离职证明' },
  'personnel-labor-termination': { section: 'labor-termination', label: '解除劳动合同' },
  'personnel-leave-request': { section: 'leave-request', label: '请假申请' },
};

const administrationSectionMap: Record<string, { section: AdministrationSectionKey; label: string }> = {
  'administration-items': { section: 'items', label: '物品管理' },
  'administration-dormitory': { section: 'dormitory', label: '住宿申请' },
  'administration-rooms': { section: 'rooms', label: '房号管理' },
  'administration-beds': { section: 'beds', label: '床号管理' },
  'administration-water-meter': { section: 'water-meter', label: '水表记录' },
};

const salarySectionMap: Record<string, { section: SalarySectionKey; label: string }> = {
  'salary-employees': { section: 'employees', label: '员工管理' },
  'salary-detail': { section: 'salary', label: '工资明细' },
  'salary-workhours': { section: 'workhours', label: '工时记录' },
  'salary-attendance': { section: 'attendance', label: '打卡记录' },
};

interface NotificationItem {
  is_read: number;
}

interface MainLayoutProps {
  user?: {
    id: number;
    username: string;
    name: string;
    role: string;
    department?: string;
  };
}

export function MainLayout({ user }: MainLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [activePage, setActivePage] = useState<PageKey>('dashboard');
  const [activeNavKey, setActiveNavKey] = useState<string>('dashboard');
  const [activePersonnelSection, setActivePersonnelSection] = useState<PersonnelSectionKey>('onboarding');
  const [activeAdministrationSection, setActiveAdministrationSection] = useState<AdministrationSectionKey>('dormitory');
  const [activeSalarySection, setActiveSalarySection] = useState<SalarySectionKey>('salary');
  const [activeAssetsType, setActiveAssetsType] = useState<string>('all');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [showLoginNotification, setShowLoginNotification] = useState(false);
  const [loginUnreadCount, setLoginUnreadCount] = useState(0);

  // 登录时检查未读消息
  useEffect(() => {
    if (user?.id) {
      const checkUnreadNotifications = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch('/api/notifications?receiverId=' + user.id, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
          });
          const data = await response.json() as { success?: boolean; data?: NotificationItem[] };
          if (data.success) {
            const unreadCount = (data.data || []).filter((n) => n.is_read === 0).length;
            if (unreadCount > 0) {
              setLoginUnreadCount(unreadCount);
              setShowLoginNotification(true);
              // 5秒后自动关闭
              setTimeout(() => {
                setShowLoginNotification(false);
              }, 5000);
            }
          }
        } catch (error) {
          console.error('检查未读通知失败:', error);
        }
      };
      
      checkUnreadNotifications();
    }
  }, [user]);

  // 检测屏幕尺寸
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 获取用户权限
  useEffect(() => {
    const fetchPermissions = async () => {
      if (user?.role === 'admin') {
        // 管理员拥有所有权限
        setPermissions([
          'dashboard', 'taskmanage', 'distribution', 'todo', 'leads', 
          'customers', 'tasks', 'generate', 'assets', 'departments', 'usermanage', 'personnel', 'administration', 'human-resources', 'database-backup', 'settings',
          'organization', 'permission', 'purchase-requests', 'expense-claims', 
          'approval-center', 'finance-review', 'notification-center'
        ]);
        return;
      }
      
      try {
        const res = await fetch(`/api/permissions/check?userId=${user?.id}`);
        if (res.ok) {
          const data = await res.json();
          setPermissions(data.permissions || []);
        }
      } catch (error) {
        console.error('获取权限失败:', error);
      }
    };
    
    fetchPermissions();
  }, [user]);

  // 检查是否有权限访问某页面
  const hasPermission = useCallback((page: string): boolean => {
    if (page === 'dashboard') return true;
    if (user?.role === 'admin') return true;
    if (page.startsWith('assets-type:')) return permissions.includes('assets');
    return permissions.includes(pagePermissionMap[page] || page);
  }, [permissions, user?.role]);

  const canViewFullDashboard = user?.role === 'admin' || user?.role === 'super_admin' || permissions.includes('dashboard');

  // 导航时检查权限
  const handleNavigate = useCallback((key: string) => {
    const personnelSection = personnelSectionMap[key];
    if (personnelSection) {
      if (!hasPermission(key)) {
        alert('您没有权限访问此功能，请联系管理员开通');
        return;
      }

      setActivePage('personnel');
      setActiveNavKey(key);
      setActivePersonnelSection(personnelSection.section);

      if (user?.id) {
        logOperation({
          module: 'personnel',
          action: LogActions.VIEW,
          details: { message: `访问页面: 人事管理 / ${personnelSection.label}` },
          userId: user.id,
          userName: user.name,
        }).catch(err => console.error('记录导航日志失败:', err));
      }
      return;
    }

    const administrationSection = administrationSectionMap[key];
    if (administrationSection) {
      if (!hasPermission(key)) {
        alert('您没有权限访问此功能，请联系管理员开通');
        return;
      }

      setActivePage('administration');
      setActiveNavKey(key);
      setActiveAdministrationSection(administrationSection.section);

      if (user?.id) {
        logOperation({
          module: 'administration',
          action: LogActions.VIEW,
          details: { message: `访问页面: 行政管理 / ${administrationSection.label}` },
          userId: user.id,
          userName: user.name,
        }).catch(err => console.error('记录导航日志失败:', err));
      }
      return;
    }

    const salarySection = salarySectionMap[key];
    if (salarySection) {
      if (!hasPermission(key)) {
        alert('您没有权限访问此功能，请联系管理员开通');
        return;
      }

      setActivePage('salary');
      setActiveNavKey(key);
      setActiveSalarySection(salarySection.section);

      if (user?.id) {
        logOperation({
          module: 'salary',
          action: LogActions.VIEW,
          details: { message: `访问页面: 工资工时查询 / ${salarySection.label}` },
          userId: user.id,
          userName: user.name,
        }).catch(err => console.error('记录导航日志失败:', err));
      }
      return;
    }

    if (key === 'assets-overview' || key.startsWith('assets-type:')) {
      if (!hasPermission(key)) {
        alert('您没有权限访问此功能，请联系管理员开通');
        return;
      }

      const assetType = key.startsWith('assets-type:') ? decodeURIComponent(key.slice('assets-type:'.length)) : 'all';
      setActivePage('assets');
      setActiveNavKey(key);
      setActiveAssetsType(assetType);

      if (user?.id) {
        logOperation({
          module: 'assets',
          action: LogActions.VIEW,
          details: { message: `访问页面: 资产管理 / ${assetType === 'all' ? '资产总览' : assetType}` },
          userId: user.id,
          userName: user.name,
        }).catch(err => console.error('记录导航日志失败:', err));
      }
      return;
    }

    if (!hasPermission(key)) {
      alert('您没有权限访问此功能，请联系管理员开通');
      return;
    }
    setActivePage(key as PageKey);
    setActiveNavKey(
      key === 'personnel'
        ? 'personnel-onboarding'
        : key === 'assets'
          ? 'assets-overview'
        : key === 'administration'
          ? 'administration-dormitory'
          : key === 'salary'
            ? 'salary-detail'
            : key,
    );
    if (key === 'personnel') {
      setActivePersonnelSection('onboarding');
    } else if (key === 'assets') {
      setActiveAssetsType('all');
    } else if (key === 'administration') {
      setActiveAdministrationSection('dormitory');
    } else if (key === 'salary') {
      setActiveSalarySection('salary');
    }
    
    // 记录页面访问日志
    if (user?.id) {
      logOperation({
        module: key,
        action: LogActions.VIEW,
        details: { message: `访问页面: ${pageNames[key] || key}` },
        userId: user.id,
        userName: user.name,
      }).catch(err => console.error('记录导航日志失败:', err));
    }
  }, [hasPermission, user]);

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard fullAccess={canViewFullDashboard} />;
      case 'taskmanage':
        return <TaskManagePage />;
      case 'distribution':
        return <DistributionPage />;
      case 'todo':
        return <TodoPage />;
      case 'leads':
        return <LeadsPage />;
      case 'customers':
        return <CustomersPage />;
      case 'contacts':
        return <ContactsPage />;
      case 'contracts':
        return <ContractsPage />;
      case 'invoices':
        return <InvoicesPage />;
      case 'followup':
        return <VisitsPage />;
      case 'products':
        return <ProductsPage />;
      case 'finance':
        return <FinancePage />;
      case 'tasks':
        return <TasksPage />;
      case 'salary':
        return <SalaryPage section={activeSalarySection} />;
      case 'generate':
        return <GeneratePage />;
      case 'ai-chat':
        return <AIChatPage user={user} />;
      case 'assets':
        return <AssetsPage selectedType={activeAssetsType} />;
      case 'organization':
        return <OrganizationPage />;
      case 'personnel':
        return <PersonnelPage section={activePersonnelSection} />;
      case 'administration':
        return <AdministrationPage section={activeAdministrationSection} />;
      case 'human-resources':
        return <HumanResourcesPage />;
      case 'permission':
        return <PermissionPage />;
      case 'purchase-requests':
        return <PurchaseRequestsPage />;
      case 'expense-claims':
        return <ExpenseClaimsPage />;
      case 'approval-center':
        return <ApprovalCenter />;
      case 'finance-review':
        return <FinanceReviewPage />;
      case 'usermanage':
        return <UserManagePage />;
      case 'smtp':
        return <SmtpConfigPage />;
      case 'operation-logs':
        return <OperationLogsPage />;
      case 'settings':
        return <SettingsPage />;
      case 'notification-center':
        return <NotificationCenterPage />;
      default:
        return <Dashboard fullAccess={canViewFullDashboard} />;
    }
  };

  return (
    <div className="app-root min-h-screen bg-slate-50">
      {/* 登录时的未读消息弹窗 */}
      {showLoginNotification && loginUnreadCount > 0 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top-5 fade-in duration-300">
          <div className="bg-white rounded-lg shadow-2xl border border-orange-200 overflow-hidden max-w-md">
            <div className="bg-orange-500 text-white px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
                </svg>
                <span className="font-medium text-sm">您有 {loginUnreadCount} 条未读消息</span>
              </div>
              <button
                onClick={() => setShowLoginNotification(false)}
                className="hover:bg-orange-600 rounded p-1 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="p-4 text-center">
              <p className="text-sm text-gray-600">您有 <span className="font-bold text-orange-500">{loginUnreadCount}</span> 条未读通知，请点击右上角的铃铛图标查看。</p>
              <button
                onClick={() => setShowLoginNotification(false)}
                className="mt-3 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}

      <Header 
        onToggleSidebar={() => {
          if (isMobile) {
            setMobileSidebarOpen(!mobileSidebarOpen);
          } else {
            setSidebarCollapsed(!sidebarCollapsed);
          }
        }} 
        user={user} 
      />
      
      {/* PC端侧边栏 */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        activeKey={activeNavKey}
        onNavigate={handleNavigate}
        isMobile={false}
        permissions={permissions}
        isAdmin={user?.role === 'admin'}
      />
      
      {/* 移动端侧边栏 */}
      <Sidebar
        collapsed={false}
        onToggle={() => {}}
        activeKey={activeNavKey}
        onNavigate={handleNavigate}
        isMobile={true}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        permissions={permissions}
        isAdmin={user?.role === 'admin'}
      />
      
      <main
        className={`app-shell-main app-animated-surface pt-14 transition-all duration-300 ${
          isMobile 
            ? 'pl-0' 
            : sidebarCollapsed 
              ? 'pl-16' 
              : 'pl-56'
        }`}
      >
        {renderPage()}
      </main>
    </div>
  );
}
