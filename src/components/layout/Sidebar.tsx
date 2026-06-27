'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Building2,
  Building,
  Contact,
  FileText,
  Receipt,
  MessageSquare,
  Package,
  DollarSign,
  Folder,
  UserCog,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Share2,
  X,
  Settings,
  Clock,
  Shield,
  CheckCircle,
  Landmark,
  Bot,
  Send,
  Loader2,
  Copy,
  Check,
  Trash2,
  User,
  Bell,
  Briefcase,
  Calendar,
  Home,
  Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatChinaTime } from '@/lib/china-time';
import { navMenuItems, NavMenuItem } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard,
  CheckSquare,
  Users,
  Building2,
  Building,
  Contact,
  FileText,
  Receipt,
  MessageSquare,
  Package,
  DollarSign,
  Folder,
  UserCog,
  ClipboardList,
  Share2,
  Settings,
  Clock,
  Shield,
  CheckCircle,
  Landmark,
  Bot,
  Bell,
  Briefcase,
  Calendar,
  Home,
  Mail,
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeKey: string;
  onNavigate: (key: string) => void;
  isMobile?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  permissions?: string[];
  isAdmin?: boolean;
}

const modulePermissionMap: Record<string, string> = {
  'dashboard': 'dashboard',
  'taskmanage': 'taskmanage',
  'distribution': 'distribution',
  'todo': 'todo',
  'leads': 'leads',
  'customers': 'customers',
  'contacts': 'contacts',
  'followup': 'followup',
  'contracts': 'contracts',
  'invoices': 'invoices',
  'products': 'products',
  'finance': 'finance',
  'generate': 'generate',
  'ai-chat': 'ai-chat',
  'assets': 'assets',
  'assets-overview': 'assets',
  'usermanage': 'usermanage',
  'personnel': 'personnel',
  'personnel-onboarding': 'personnel',
  'personnel-social-security': 'personnel',
  'personnel-social-security-purchase': 'personnel',
  'personnel-regularization': 'personnel',
  'personnel-work-certificate': 'personnel',
  'personnel-resignation': 'personnel',
  'personnel-resignation-certificate': 'personnel',
  'personnel-labor-termination': 'personnel',
  'personnel-leave-request': 'personnel',
  'administration': 'administration',
  'administration-dormitory': 'administration',
  'administration-rooms': 'administration',
  'administration-beds': 'administration',
  'administration-water-meter': 'administration',
  'human-resources': 'human-resources',
  'settings': 'settings',
  'purchase-requests': 'purchase-requests',
  'expense-claims': 'expense-claims',
  'approval-center': 'approval-center',
  'finance-review': 'finance-review',
  'salary': 'salary',
  'salary-employees': 'salary',
  'salary-detail': 'salary',
  'salary-workhours': 'salary',
  'salary-attendance': 'salary',
  'smtp': 'smtp',
  'operation-logs': 'operation-logs',
  'notification-center': 'notification-center',
};

const hasPermission = (key: string, permissions: string[], isAdmin: boolean): boolean => {
  if (key === 'dashboard') return true;
  if (isAdmin) return true;
  if (key === 'assets-overview' || key.startsWith('assets-type:')) return permissions.includes('assets');
  const permissionKey = modulePermissionMap[key];
  return !permissionKey || permissions.includes(permissionKey);
};

const hasAnyChildPermission = (children: NavMenuItem[], permissions: string[], isAdmin: boolean): boolean => {
  return children.some(child => hasPermission(child.key, permissions, isAdmin));
};

const hasActiveDescendant = (item: NavMenuItem, activeKey: string): boolean => {
  if (item.key === activeKey) return true;
  return item.children?.some(child => hasActiveDescendant(child, activeKey)) || false;
};

function MenuItem({ 
  item, 
  activeKey, 
  onNavigate, 
  collapsed, 
  isMobile,
  onMobileClose,
  permissions,
  isAdmin,
  level = 0
}: { 
  item: NavMenuItem; 
  activeKey: string; 
  onNavigate: (key: string) => void;
  collapsed: boolean;
  isMobile?: boolean;
  onMobileClose?: () => void;
  permissions: string[];
  isAdmin: boolean;
  level?: number;
}) {
  const Icon = iconMap[item.icon] || LayoutDashboard;
  const isActive = activeKey === item.key;
  const hasChildren = item.children && item.children.length > 0;
  const hasChildPermission = hasChildren && hasAnyChildPermission(item.children || [], permissions, isAdmin);
  const hasActiveChild = hasChildren
    ? item.children?.some(child => hasActiveDescendant(child, activeKey)) || false
    : false;
  const [isExpanded, setIsExpanded] = useState(hasActiveChild);

  useEffect(() => {
    if (collapsed) {
      setIsExpanded(false);
      return;
    }

    setIsExpanded(hasActiveChild);
  }, [collapsed, hasActiveChild]);

  if (hasChildren) {
    return (
      <div key={item.key}>
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start h-11 rounded-none',
            isActive || hasActiveChild
              ? 'bg-blue-50 text-blue-600'
              : 'text-slate-600 hover:bg-slate-50',
            collapsed && 'justify-center px-0'
          )}
          onClick={() => !collapsed && setIsExpanded(!isExpanded)}
        >
          <Icon className={cn('w-5 h-5 flex-shrink-0', !collapsed && 'mr-3')} />
          {!collapsed && (
            <>
              <span className="text-sm flex-1 text-left">{item.label}</span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </>
          )}
        </Button>
        
        {!collapsed && isExpanded && hasChildren && item.children && (
          <div className="ml-4">
            {item.children
              .filter(child => hasPermission(child.key, permissions, isAdmin))
              .map(child => (
                <MenuItem
                  key={child.key}
                  item={child}
                  activeKey={activeKey}
                  onNavigate={onNavigate}
                  collapsed={collapsed}
                  isMobile={isMobile}
                  onMobileClose={onMobileClose}
                  permissions={permissions}
                  isAdmin={isAdmin}
                  level={level + 1}
                />
              ))}
          </div>
        )}
        
        {collapsed && (
          <Tooltip key={item.key} delayDuration={0}>
            <TooltipContent side="right" className="ml-2">
              {item.label}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  }

  const handleClick = () => {
    onNavigate(item.key);
    if (isMobile) {
      onMobileClose?.();
    }
  };

  const buttonContent = (
    <Button
      variant="ghost"
      className={cn(
        'w-full justify-start h-11 rounded-none',
        isActive
          ? 'bg-blue-50 text-blue-600'
          : 'text-slate-600 hover:bg-slate-50',
        collapsed && 'justify-center px-0',
        level > 0 && 'ml-4'
      )}
      onClick={handleClick}
    >
      <Icon className={cn('w-5 h-5 flex-shrink-0', !collapsed && 'mr-3')} />
      {!collapsed && <span className="text-sm">{item.label}</span>}
    </Button>
  );

  if (collapsed) {
    return (
      <Tooltip key={item.key} delayDuration={0}>
        <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
        <TooltipContent side="right" className="ml-2">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return <div key={item.key}>{buttonContent}</div>;
}

export function Sidebar({ 
  collapsed, 
  onToggle, 
  activeKey, 
  onNavigate,
  isMobile = false,
  mobileOpen = false,
  onMobileClose,
  permissions = [],
  isAdmin = false
}: SidebarProps) {
  // AI对话状态
  const [aiChatDialogOpen, setAiChatDialogOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '👋 您好！我是聚小星AI，有什么可以帮助您的？',
      timestamp: new Date(),
    },
  ]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string>('');
  const [assetTypeMenuItems, setAssetTypeMenuItems] = useState<NavMenuItem[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadAssetTypes = async () => {
      try {
        const response = await fetch('/api/assets', { cache: 'no-store' });
        const result = await response.json().catch(() => ({})) as { success?: boolean; data?: Array<{ type?: string | null }> };
        if (!response.ok || !result.success) return;

        const uniqueTypes = Array.from(new Set((result.data || [])
          .map((asset) => String(asset.type || '').trim())
          .filter(Boolean)));

        setAssetTypeMenuItems(uniqueTypes.map((type) => ({
          key: `assets-type:${encodeURIComponent(type)}`,
          label: type,
          icon: 'Folder',
        })));
      } catch (error) {
        console.error('加载资产类型导航失败:', error);
      }
    };

    void loadAssetTypes();
    window.addEventListener('assets-updated', loadAssetTypes);
    return () => window.removeEventListener('assets-updated', loadAssetTypes);
  }, []);

  // AI对话自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages]);

  // AI发送消息
  const handleAiSend = async () => {
    if (!aiInput.trim() || aiLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: aiInput.trim(),
      timestamp: new Date(),
    };

    setAiMessages((prev) => [...prev, userMessage]);
    setAiInput('');
    setAiLoading(true);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: userMessage.content }),
      });

      const data = await res.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message || data.result || '处理完成',
        timestamp: new Date(),
      };

      setAiMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '抱歉，服务暂时不可用，请稍后重试。',
        timestamp: new Date(),
      };
      setAiMessages((prev) => [...prev, errorMessage]);
    } finally {
      setAiLoading(false);
    }
  };

  // AI清空对话
  const handleAiClear = () => {
    setAiMessages([
      {
        id: '1',
        role: 'assistant',
        content: '👋 对话已清空！有什么可以帮助您的？',
        timestamp: new Date(),
      },
    ]);
  };

  // AI复制消息
  const handleAiCopy = (message: Message) => {
    const text = message.content;
    
    // 创建临时输入框
    const input = document.createElement('input');
    input.value = text;
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.top = '-9999px';
    input.style.width = '100px';
    document.body.appendChild(input);
    
    // 选择文本
    input.select();
    input.setSelectionRange(0, text.length);
    
    try {
      // 执行复制
      const success = document.execCommand('copy');
      
      if (success) {
        setCopiedId(message.id);
        setCopyMessage('✅ 复制成功！');
        setTimeout(() => setCopiedId(null), 2000);
        setTimeout(() => setCopyMessage(''), 2000);
      } else {
        // 降级到Clipboard API
        navigator.clipboard.writeText(text).then(() => {
          setCopiedId(message.id);
          setCopyMessage('✅ 复制成功！');
          setTimeout(() => setCopiedId(null), 2000);
          setTimeout(() => setCopyMessage(''), 2000);
        }).catch(() => {
          setCopyMessage('❌ 复制失败，请手动复制');
          setTimeout(() => setCopyMessage(''), 3000);
        });
      }
    } catch (err) {
      console.error('复制失败:', err);
      setCopyMessage('❌ 复制失败，请手动复制');
      setTimeout(() => setCopyMessage(''), 3000);
    } finally {
      // 清理
      document.body.removeChild(input);
    }
  };

  // AI格式化时间
  const formatAiTime = (date: Date) => {
    return formatChinaTime(date);
  };

  const menuItemsWithAssetTypes = navMenuItems.map((item) => {
    if (item.key !== 'organization') return item;
    return {
      ...item,
      children: item.children?.map((child) => {
        if (child.key === 'administration') {
          const children = child.children || [];
          const hasItemsPage = children.some((navChild) => navChild.key === 'administration-items');
          return {
            ...child,
            children: hasItemsPage
              ? children
              : [
                ...children,
                { key: 'administration-items', label: '物品管理', icon: 'Package' },
              ],
          };
        }
        if (child.key !== 'assets') return child;
        return {
          ...child,
          children: [
            { key: 'assets-overview', label: '资产总览', icon: 'Folder' },
            ...assetTypeMenuItems,
          ],
        };
      }),
    };
  });

  const filteredMenuItems = menuItemsWithAssetTypes.filter(item => {
    if (item.children) {
      return hasAnyChildPermission(item.children, permissions, isAdmin);
    }
    return hasPermission(item.key, permissions, isAdmin);
  });

  if (isMobile) {
    return (
      <>
        {mobileOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={onMobileClose}
          />
        )}
        
        <aside
          className={cn(
            'fixed left-0 top-14 bottom-0 bg-white border-r border-slate-200 z-50 flex flex-col w-64 transition-transform duration-300 lg:hidden',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="p-3 border-b border-slate-100">
            <Button 
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
              onClick={() => setAiChatDialogOpen(true)}
            >
              <Bot className="w-4 h-4 mr-2" />
              聚小星AI
            </Button>
          </div>

          <nav className="flex-1 py-2 overflow-y-auto">
            {filteredMenuItems.map(item => (
              <MenuItem
                key={item.key}
                item={item}
                activeKey={activeKey}
                onNavigate={onNavigate}
                collapsed={false}
                isMobile={true}
                onMobileClose={onMobileClose}
                permissions={permissions}
                isAdmin={isAdmin}
              />
            ))}
          </nav>

          <div className="p-3 border-t border-slate-100 lg:hidden">
            <Button
              variant="ghost"
              className="w-full justify-center text-slate-500 hover:text-slate-700"
              onClick={onMobileClose}
            >
              <X className="w-5 h-5 mr-2" />
              <span className="text-sm">关闭菜单</span>
            </Button>
          </div>
        </aside>
      </>
    );
  }

  return (
    <>
      <aside
        className={cn(
          'fixed left-0 top-14 bottom-0 bg-white border-r border-slate-200 transition-all duration-300 z-40 flex-col hidden lg:flex',
          collapsed ? 'w-16' : 'w-56'
        )}
      >
        <div className="p-3 border-b border-slate-100">
          <Button
            className={cn(
              'w-full bg-gradient-to-r from-pink-400 to-purple-500 hover:from-pink-500 hover:to-purple-600 text-white',
              collapsed && 'px-2'
            )}
            onClick={() => setAiChatDialogOpen(true)}
          >
            <span className={cn('w-6 h-6 sm:w-5 sm:h-5 flex items-center justify-center rounded-full bg-white/20', collapsed ? '' : 'mr-2')}>
              🌟
            </span>
            {collapsed ? '' : '聚小星'}
          </Button>
        </div>

        <nav className="flex-1 py-2 overflow-y-auto">
          {filteredMenuItems.map(item => (
            <MenuItem
            key={item.key}
            item={item}
            activeKey={activeKey}
            onNavigate={onNavigate}
            collapsed={collapsed}
            isMobile={false}
            permissions={permissions}
            isAdmin={isAdmin}
            />
          ))}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <Button
            variant="ghost"
            className="w-full justify-center text-slate-500 hover:text-slate-700"
            onClick={onToggle}
          >
            {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5 mr-2" />
              <span className="text-sm">收起导航</span>
            </>
            )}
          </Button>
        </div>
      </aside>

      {/* 聚小星AI对话对话框 */}
      <Dialog open={aiChatDialogOpen} onOpenChange={setAiChatDialogOpen}>
        <DialogContent className="w-[95vw] sm:w-[85vw] md:w-[80vw] lg:w-[60vw] xl:w-[50vw] max-w-3xl max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0 border-b px-4 sm:px-6">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-pink-400 to-purple-500 flex items-center justify-center shadow-md">
                <span className="text-xl">🌟</span>
              </div>
              <DialogTitle className="text-lg sm:text-xl font-semibold">聚小星</DialogTitle>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleAiClear}
              className="text-muted-foreground hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              清空
            </Button>
          </div>
          <DialogDescription className="text-sm text-muted-foreground mt-1">智能助手，帮您解答问题</DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 p-3 sm:p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
          <div className="space-y-3 sm:space-y-4 max-w-2xl mx-auto">
            {aiMessages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2 sm:gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {message.role === 'user' ? (
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm bg-blue-500 text-white">
                      <User className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm bg-gradient-to-r from-pink-400 to-purple-500">
                      <span className="text-sm sm:text-base">🌟</span>
                    </div>
                  )}

                <div
                  className={`max-w-[75%] sm:max-w-[80%] rounded-xl px-3 sm:px-4 py-2 sm:py-3 ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white shadow-md'
                      : 'bg-slate-100 text-slate-800 shadow-sm'
                  }`}
                >
                  <div className="text-sm sm:text-base whitespace-pre-wrap leading-relaxed">{message.content}</div>
                  <div
                    className={`flex items-center justify-end gap-1 sm:gap-2 mt-2 ${
                      message.role === 'user' ? 'text-blue-100' : 'text-slate-400'
                    }`}
                  >
                    <span className="text-xs sm:text-sm">{formatAiTime(message.timestamp)}</span>
                    <button
                      onClick={() => handleAiCopy(message)}
                      className={`flex items-center justify-center h-5 w-5 sm:h-6 sm:w-6 p-0 rounded-full transition-all ${
                        message.role === 'user' 
                          ? 'text-blue-100 hover:text-white hover:bg-white/20' 
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'
                      }`}
                      title="复制消息"
                    >
                      {copiedId === message.id ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {aiLoading && (
              <div className="flex gap-2 sm:gap-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white flex items-center justify-center shadow-sm">
                  <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="bg-slate-100 rounded-xl px-3 sm:px-4 py-2 sm:py-3 shadow-sm">
                  <div className="flex items-center gap-2 sm:gap-3 text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">正在思考...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="p-3 sm:p-4 border-t bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
          {copyMessage && (
            <div className="text-center mb-2 text-sm font-medium text-green-600">
              {copyMessage}
            </div>
          )}
          <div className="flex gap-2 sm:gap-3 max-w-2xl mx-auto w-full">
            <Input
              placeholder="输入您的问题..."
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleAiSend();
                }
              }}
              disabled={aiLoading}
              className="flex-1 h-10 sm:h-12 text-sm sm:text-base rounded-xl"
            />
            <Button 
              onClick={handleAiSend} 
              disabled={!aiInput.trim() || aiLoading}
              className="h-10 sm:h-12 w-10 sm:w-12 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-all shadow-md hover:shadow-lg"
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </div>
          </DialogContent>
        </Dialog>
      </>
    );
}
