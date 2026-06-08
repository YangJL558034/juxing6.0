'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, Check, CheckCheck, Mail, MailX, X, FileText, Image, Download, Eye, Paperclip, Clock, Trash2, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { NotificationDetailSections, isRecruitmentNotification } from '@/components/notifications/NotificationDetailSections';

interface Notification {
  id: number;
  title: string;
  content: string;
  sender_id: number;
  sender_name: string;
  receiver_id: number;
  receiver_name: string;
  is_read: number;
  read_at: string | null;
  created_at: string;
  type: string;
  email_sent: number;
  email_error: string | null;
  attachment_file?: string;
  attachment_file_name?: string;
}

interface NotificationBellProps {
  userId: number;
  userName: string;
}

export function NotificationBell({ userId, userName }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [popupNotification, setPopupNotification] = useState<Notification | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  
  // 详情对话框状态
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  
  // 用于追踪上一轮的未读通知ID，避免重复提醒
  const previousUnreadIds = useRef<Set<number>>(new Set());
  
  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 获取通知
  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch(`/api/notifications?receiverId=${userId}`);
      const data = await response.json();
      if (data.success) {
        const newNotifications = data.data as Notification[] || [];
        const currentUnreadCount = newNotifications.filter((n) => n.is_read === 0).length;
        const currentUnreadIds: Set<number> = new Set(
          newNotifications.filter((n) => n.is_read === 0).map((n) => n.id)
        );
        
        // 检查是否有新的未读通知
        const newUnreadIds: number[] = [...currentUnreadIds].filter(id => !previousUnreadIds.current.has(id));
        
        // 如果有新通知且下拉菜单未打开，显示弹窗
        if (newUnreadIds.length > 0 && !isOpen) {
          const maxId = Math.max(...newUnreadIds);
          const newestNotification = newNotifications.find((n) => n.id === maxId);
          if (newestNotification) {
            setPopupNotification(newestNotification);
            setShowPopup(true);
            // 3秒后自动关闭
            setTimeout(() => {
              setShowPopup(false);
            }, 3000);
          }
        }
        
        // 更新追踪器
        previousUnreadIds.current = currentUnreadIds;
        setNotifications(newNotifications);
        setUnreadCount(currentUnreadCount);
      }
    } catch (error) {
      console.error('获取通知失败:', error);
    }
  }, [userId, isOpen]);

  useEffect(() => {
    // 首次加载时检查未读消息
    fetchNotifications();
    
    // 每10秒刷新一次（比之前的30秒更频繁，确保及时收到新通知）
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // 标记单个通知已读
  const markAsRead = async (notificationId: number) => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });
      fetchNotifications();
    } catch (error) {
      console.error('标记已读失败:', error);
    }
  };

  // 标记所有已读
  const markAllAsRead = async () => {
    setLoading(true);
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: userId, markAll: true }),
      });
      fetchNotifications();
    } catch (error) {
      console.error('标记全部已读失败:', error);
    }
    setLoading(false);
  };

  // 删除单个通知
  const deleteNotification = async (notificationId: number) => {
    try {
      await fetch(`/api/notifications?id=${notificationId}`, {
        method: 'DELETE',
      });
      fetchNotifications();
    } catch (error) {
      console.error('删除通知失败:', error);
    }
  };

  // 一键清理所有通知
  const clearAllNotifications = async () => {
    if (!confirm('确定要删除所有通知吗？')) {
      return;
    }
    try {
      await fetch(`/api/notifications?receiverId=${userId}&deleteAll=true`, {
        method: 'DELETE',
      });
      fetchNotifications();
    } catch (error) {
      console.error('清理通知失败:', error);
    }
  };

  // 查看通知详情
  const handleViewDetail = (notification: Notification) => {
    setSelectedNotification(notification);
    setDetailDialogOpen(true);
    
    // 如果未读，标记为已读
    if (notification.is_read === 0) {
      markAsRead(notification.id);
    }
  };

  // 下载附件
  const handleDownloadAttachment = (fileUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 格式化时间
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  // 获取通知类型颜色
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'urgent': return 'text-red-500';
      case 'warning': return 'text-yellow-500';
      case 'success': return 'text-green-500';
      default: return 'text-blue-500';
    }
  };

  return (
    <>
      {/* 弹窗提醒 */}
      {showPopup && popupNotification && (
        <div 
          className="fixed top-4 right-4 z-[9999] w-96 max-w-[90vw] animate-in slide-in-from-top-5 fade-in duration-300"
        >
          <div className="bg-white rounded-lg shadow-2xl border border-blue-200 overflow-hidden">
            <div className="bg-blue-500 text-white px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                <span className="font-medium text-sm">新通知</span>
              </div>
              <button
                onClick={() => setShowPopup(false)}
                className="hover:bg-blue-600 rounded p-1 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Bell className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm mb-1">{popupNotification.title}</h4>
                  {popupNotification.content && (
                    <p className="text-xs text-gray-600 line-clamp-2 mb-2">{popupNotification.content}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>来自: {popupNotification.sender_name}</span>
                    <span>•</span>
                    <span>{formatTime(popupNotification.created_at)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowPopup(false)}
                  className="flex-1"
                >
                  稍后查看
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-blue-500 hover:bg-blue-600"
                  onClick={() => {
                    markAsRead(popupNotification.id);
                    setShowPopup(false);
                    setIsOpen(true);
                  }}
                >
                  查看详情
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[480px] p-0 max-w-[95vw]">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold">通知中心</h3>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={markAllAsRead}
                disabled={loading}
                className="text-xs text-blue-500 hover:text-blue-600"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                全部已读
              </Button>
            )}
            {notifications.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearAllNotifications}
                disabled={loading}
                className="text-xs text-red-500 hover:text-red-600"
              >
                <Trash className="h-3 w-3 mr-1" />
                一键清理
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[500px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              暂无通知
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'p-3 cursor-pointer hover:bg-muted/50 transition-colors',
                    notification.is_read === 0 && 'bg-blue-50/50'
                  )}
                  onClick={() => handleViewDetail(notification)}
                >
                  <div className="flex items-start gap-2">
                    <div className={cn('mt-1', getTypeColor(notification.type))}>
                      {notification.is_read === 0 ? (
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                      ) : (
                        <Check className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('确定要删除这条通知吗？')) {
                            deleteNotification(notification.id);
                          }
                        }}
                        className="float-right p-1 hover:bg-red-100 rounded transition-colors text-muted-foreground hover:text-red-500"
                        title="删除通知"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                      <div className="flex items-center gap-2">
                        <p className={cn(
                          'text-sm font-medium truncate',
                          notification.is_read === 0 && 'text-foreground'
                        )}>
                          {notification.title}
                        </p>
                        {notification.attachment_file && (
                          <span title="有附件"><Paperclip className="h-3 w-3 text-orange-500" /></span>
                        )}
                        {notification.email_sent === 1 && (
                          <span title="已发送邮件"><Mail className="h-3 w-3 text-green-500" /></span>
                        )}
                        {notification.email_error && (
                          <span title="邮件发送失败"><MailX className="h-3 w-3 text-red-500" /></span>
                        )}
                      </div>
                      {notification.content && (
                        <div className="mt-1">
                          <p className={cn(
                            'text-xs text-muted-foreground whitespace-pre-wrap break-all',
                            expandedIds.has(notification.id) ? '' : 'line-clamp-3'
                          )}
                          style={{ wordBreak: 'break-all', wordWrap: 'break-word', maxWidth: '100%' }}>
                            {notification.content}
                          </p>
                          {notification.content.length > 80 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(notification.id);
                              }}
                              className="text-xs text-blue-500 hover:text-blue-600 mt-2 inline-block"
                            >
                              {expandedIds.has(notification.id) ? '收起' : '展开全文'}
                            </button>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          来自: {notification.sender_name}
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(notification.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <div className="p-2 border-t text-center">
            <p className="text-xs text-muted-foreground">
              共 {notifications.length} 条通知，{unreadCount} 条未读
            </p>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>

    {/* 通知详情对话框 */}
    <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-500" />
            通知详情
          </DialogTitle>
          <DialogDescription>
            查看通知详细信息及附件
          </DialogDescription>
        </DialogHeader>
        
        {selectedNotification && (
          <div className="space-y-4 py-4">
            {/* 标题 */}
            <div>
              <h3 className="font-semibold text-lg mb-2">{selectedNotification.title}</h3>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {new Date(selectedNotification.created_at).toLocaleString('zh-CN')}
                </span>
                {selectedNotification.sender_name && (
                  <span>发送者: {selectedNotification.sender_name}</span>
                )}
                <span>接收者: {selectedNotification.receiver_name}</span>
              </div>
            </div>
            
            {/* 内容 */}
            {isRecruitmentNotification(selectedNotification) ? (
              <NotificationDetailSections
                notification={selectedNotification}
                onDownloadAttachment={handleDownloadAttachment}
              />
            ) : (
              <>
            {selectedNotification.content && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium mb-2">通知内容:</h4>
                <p className="text-gray-700 whitespace-pre-wrap">{selectedNotification.content}</p>
              </div>
            )}
            
            {/* 附件 */}
            {selectedNotification.attachment_file && (
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Paperclip className="w-4 h-4" />
                  附件信息
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-white rounded-lg p-3 border">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      {selectedNotification.attachment_file_name?.endsWith('.pdf') ? (
                        <FileText className="w-6 h-6 text-red-500" />
                      ) : (
                        <Image className="w-6 h-6 text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium truncate" title={selectedNotification.attachment_file_name}>
                        {selectedNotification.attachment_file_name}
                      </p>
                      <p className="text-sm text-muted-foreground">点击下方按钮下载或预览</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleDownloadAttachment(selectedNotification.attachment_file!, selectedNotification.attachment_file_name!)}
                      className="flex-1 bg-green-500 hover:bg-green-600"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      下载附件
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.open(selectedNotification.attachment_file, '_blank')}
                      className="flex-1"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      在线预览
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {/* 邮件发送状态 */}
            {selectedNotification.email_sent === 1 && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <Mail className="w-4 h-4" />
                邮件已发送
              </div>
            )}
            {selectedNotification.email_error && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <MailX className="w-4 h-4" />
                邮件发送失败: {selectedNotification.email_error}
              </div>
            )}
              </>
            )}
          </div>
        )}
        
        <DialogFooter>
          <Button 
            variant="outline" 
            className="text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={() => {
              if (selectedNotification && confirm('确定要删除这条通知吗？')) {
                deleteNotification(selectedNotification.id);
                setDetailDialogOpen(false);
              }
            }}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            删除通知
          </Button>
          <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
