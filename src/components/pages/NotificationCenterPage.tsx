'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Bell, Send, Mail, Search, Check, AlertCircle, Upload, X, FileText, Image, Download, Eye, Clock, Paperclip, ChevronDown, Calendar, RefreshCw } from 'lucide-react';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { NotificationDetailSections, isRecruitmentNotification } from '@/components/notifications/NotificationDetailSections';

interface User {
  id: number;
  name: string;
  username: string;
  email?: string;
}

interface NotificationRecord {
  id: number;
  title: string;
  content?: string;
  receiver_name: string;
  sender_name?: string;
  created_at: string;
  is_read: number;
  type?: string;
  email_sent: number;
  email_error?: string;
  attachment_file?: string;
  attachment_file_name?: string;
}

// 格式化相对时间
const formatRelativeTime = (dateStr: string) => {
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

export default function NotificationCenterPage() {
  // 发送通知相关状态
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyContent, setNotifyContent] = useState('');
  const [notifyReceiverIds, setNotifyReceiverIds] = useState<number[]>([]);
  const [notifyAll, setNotifyAll] = useState(false);
  const [sending, setSending] = useState(false);
  
  // 附件相关状态
  const [attachment, setAttachment] = useState<{ file: File | null; preview: string }>({ file: null, preview: '' });
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ fileUrl: string; fileName: string; filePath: string } | null>(null);
  
  // 详情对话框相关状态
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<NotificationRecord | null>(null);
  
  // 通知记录
  const [notificationRecords, setNotificationRecords] = useState<NotificationRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedContentIds, setExpandedContentIds] = useState<Set<number>>(new Set());
  
  // 用户列表（用于选择接收人）
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'send' | 'records'>('send');
  
  // 搜索过滤后的记录
  const filteredRecords = notificationRecords.filter(record =>
    record.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.receiver_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 按时间分组的通知记录
  const groupedNotifications = useMemo(() => {
    const groups: { [key: string]: NotificationRecord[] } = {};
    
    filteredRecords.forEach(record => {
      const date = new Date(record.created_at);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}年${month}月`;
      
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(record);
    });
    
    // 按时间倒序排序（最新的在前面）
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      const [yearA, monthA] = a.match(/(\d+)年(\d+)月/)!.slice(1).map(Number);
      const [yearB, monthB] = b.match(/(\d+)年(\d+)月/)!.slice(1).map(Number);
      if (yearB !== yearA) return yearB - yearA;
      return monthB - monthA;
    });
    
    return sortedKeys.map(key => ({
      key,
      records: groups[key].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    }));
  }, [filteredRecords]);

  const toggleContentExpand = (id: number) => {
    setExpandedContentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
    }
  };

  const fetchNotificationRecords = async () => {
    setLoadingRecords(true);
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/notifications/list');
      const data = await res.json();
      if (data.success) {
        setNotificationRecords(data.data.notifications || []);
      }
    } catch (error) {
      console.error('获取通知记录失败:', error);
    } finally {
      setLoadingRecords(false);
      setIsRefreshing(false);
    }
  };

  // 自动刷新 - 每15秒更新一次通知记录
  const { refreshNow } = useAutoRefresh({
    enabled: activeTab === 'records',
    interval: 15000,
    onRefresh: fetchNotificationRecords,
  });

  useEffect(() => {
    fetchUsers();
    fetchNotificationRecords();
  }, []);

  // 打开发送通知对话框
  const handleOpenNotify = () => {
    setNotifyTitle('');
    setNotifyContent('');
    setNotifyReceiverIds([]);
    setNotifyAll(false);
    setAttachment({ file: null, preview: '' });
    setUploadedFile(null);
    setNotifyDialogOpen(true);
  };
  
  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // 检查文件类型
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('不支持的文件类型，仅支持 JPG、PNG、GIF、WebP 和 PDF');
      return;
    }
    
    // 检查文件大小（限制为 10MB）
    if (file.size > 10 * 1024 * 1024) {
      alert('文件大小不能超过 10MB');
      return;
    }
    
    // 预览图片
    const reader = new FileReader();
    reader.onload = (e) => {
      setAttachment({
        file,
        preview: e.target?.result as string
      });
    };
    reader.readAsDataURL(file);
  };
  
  // 上传文件
  const handleUploadFile = async () => {
    if (!attachment.file) {
      alert('请先选择文件');
      return;
    }
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', attachment.file);
      
      const token = localStorage.getItem('token');
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData,
      });
      
      const data = await res.json();
      if (data.success) {
        setUploadedFile({
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          filePath: data.fileUrl
        });
        alert('文件上传成功！');
      } else {
        alert(data.error || '文件上传失败');
      }
    } catch (error) {
      alert('文件上传失败');
    } finally {
      setUploading(false);
    }
  };

  // 发送通知
  const handleSendNotification = async () => {
    if (!notifyTitle.trim()) {
      alert('请输入通知标题');
      return;
    }
    if (!notifyAll && notifyReceiverIds.length === 0) {
      alert('请选择接收用户或选择全部用户');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: notifyTitle,
          content: notifyContent,
          receiverIds: notifyAll ? 'all' : notifyReceiverIds,
          attachment: uploadedFile,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`通知发送成功！${data.emailCount > 0 ? `已发送${data.emailCount}封邮件` : ''}`);
        setNotifyDialogOpen(false);
        fetchNotificationRecords();
      } else {
        alert(data.error || '发送失败');
      }
    } catch (error) {
      alert('发送失败');
    } finally {
      setSending(false);
    }
  };
  
  // 查看通知详情
  const handleViewDetail = (notification: NotificationRecord) => {
    setSelectedNotification(notification);
    setDetailDialogOpen(true);
    
    // 如果未读，标记为已读
    if (notification.is_read === 0) {
      markAsRead(notification.id);
    }
  };
  
  // 标记单条通知为已读
  const markAsRead = async (notificationId: number) => {
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId }),
      });
      // 刷新记录
      fetchNotificationRecords();
    } catch (error) {
      console.error('标记已读失败:', error);
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

  const stats = {
    total: notificationRecords.length,
    read: notificationRecords.filter(r => r.is_read).length,
    unread: notificationRecords.filter(r => !r.is_read).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">通知中心</h1>
          <p className="text-slate-500 mt-1">管理系统通知，发送消息给用户</p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
              <p className="text-sm text-slate-500">总通知数</p>
            </div>
            <Bell className="w-10 h-10 text-blue-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-green-600">{stats.read}</p>
              <p className="text-sm text-slate-500">已读</p>
            </div>
            <Check className="w-10 h-10 text-green-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-orange-600">{stats.unread}</p>
              <p className="text-sm text-slate-500">未读</p>
            </div>
            <AlertCircle className="w-10 h-10 text-orange-500" />
          </CardContent>
        </Card>
      </div>

      {/* 标签页切换 */}
      <div className="flex bg-slate-100 rounded-lg p-1 w-fit">
        <Button
          variant={activeTab === 'send' ? 'default' : 'ghost'}
          size="sm"
          className={activeTab === 'send' ? 'bg-blue-500 hover:bg-blue-600' : ''}
          onClick={() => setActiveTab('send')}
        >
          <Send className="w-4 h-4 mr-2" />
          发起通知
        </Button>
        <Button
          variant={activeTab === 'records' ? 'default' : 'ghost'}
          size="sm"
          className={activeTab === 'records' ? 'bg-blue-500 hover:bg-blue-600' : ''}
          onClick={() => setActiveTab('records')}
        >
          <Mail className="w-4 h-4 mr-2" />
          通知记录
        </Button>
      </div>

      {/* 发起通知面板 */}
      {activeTab === 'send' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-500" />
              发起通知
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>通知标题 *</Label>
                  <Input
                    placeholder="请输入通知标题"
                    className="h-12 text-lg"
                    onClick={handleOpenNotify}
                    readOnly
                    value="点击右侧按钮发起通知"
                  />
                </div>
                <div className="flex items-center justify-end">
                  <Button
                    className="bg-orange-500 hover:bg-orange-600 h-12 px-8"
                    onClick={handleOpenNotify}
                  >
                    <Send className="w-5 h-5 mr-2" />
                    发起通知
                  </Button>
                </div>
              </div>
              
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-500">
                  <Bell className="w-4 h-4 mr-2 inline" />
                  通知将发送给指定用户，并通过邮件提醒接收人查看。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 通知记录面板 */}
      {activeTab === 'records' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-500" />
              通知记录
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="搜索通知..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
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
          </CardHeader>
          <CardContent>
            {loadingRecords ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notificationRecords.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>暂无通知记录</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Accordion type="single" collapsible className="w-full">
                  {groupedNotifications.map((group) => (
                    <AccordionItem key={group.key} value={group.key} className="border rounded-lg bg-white overflow-hidden">
                      <AccordionTrigger className="hover:no-underline bg-slate-50 hover:bg-slate-100">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-blue-500" />
                            <span className="font-medium">{group.key}</span>
                            <Badge variant="secondary" className="ml-2">
                              {group.records.length} 条
                            </Badge>
                          </div>
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-0">
                        <div className="overflow-x-auto border-t">
                          <Table className="min-w-full">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-32">标题</TableHead>
                                <TableHead className="w-48">内容</TableHead>
                                <TableHead className="w-28">接收人</TableHead>
                                <TableHead className="w-36">发送时间</TableHead>
                                <TableHead className="w-20">附件</TableHead>
                                <TableHead className="w-20">阅读状态</TableHead>
                                <TableHead className="w-20">邮件状态</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.records.map((record) => (
                                <TableRow key={record.id}>
                                  <TableCell className="truncate max-w-32">
                                    <div className="font-medium truncate" title={record.title}>
                                      {record.title}
                                    </div>
                                  </TableCell>
                                  <TableCell className="max-w-48">
                                    {record.content ? (
                                      <div className="whitespace-pre-wrap break-all">
                                        <p className={`text-xs text-muted-foreground ${expandedContentIds.has(record.id) ? '' : 'line-clamp-2'}`}
                                           style={{ wordBreak: 'break-all', wordWrap: 'break-word' }}
                                           title={record.content}>
                                          {record.content}
                                        </p>
                                        {record.content.length > 80 && (
                                          <button
                                            onClick={() => toggleContentExpand(record.id)}
                                            className="text-xs text-blue-500 hover:text-blue-600 mt-1 inline-block"
                                          >
                                            {expandedContentIds.has(record.id) ? '收起' : '展开全文'}
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="truncate max-w-28" title={record.receiver_name}>
                                    {record.receiver_name}
                                  </TableCell>
                                  <TableCell className="truncate max-w-36">
                                    <span title={new Date(record.created_at).toLocaleString('zh-CN')}>
                                      {formatRelativeTime(record.created_at)}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    {record.attachment_file ? (
                                      <div className="flex items-center gap-2">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleViewDetail(record)}
                                          className="h-8 px-2 text-blue-500 hover:text-blue-600"
                                          title="查看详情"
                                        >
                                          <Eye className="w-4 h-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleDownloadAttachment(record.attachment_file!, record.attachment_file_name!)}
                                          className="h-8 px-2 text-green-500 hover:text-green-600"
                                          title="下载附件"
                                        >
                                          <Download className="w-4 h-4" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">无</span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {record.is_read ? (
                                      <span className="text-green-600 flex items-center gap-1 text-xs">
                                        <Check className="h-3 w-3" /> 已读
                                      </span>
                                    ) : (
                                      <span className="text-orange-600 flex items-center gap-1 text-xs">
                                        <span className="h-2 w-2 rounded-full bg-orange-500"></span> 未读
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {record.email_sent === 1 ? (
                                      <span className="text-green-600 flex items-center gap-1 text-xs">
                                        <Check className="h-3 w-3" /> 已发送
                                      </span>
                                    ) : record.email_error ? (
                                      <span className="text-red-600 text-xs" title={record.email_error}>
                                        发送失败
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">未发送</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 发送通知对话框 */}
      <Dialog open={notifyDialogOpen} onOpenChange={setNotifyDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-orange-500" />
              发送通知
            </DialogTitle>
            <DialogDescription>向用户发送系统通知，同时发送邮件提醒</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>通知标题 *</Label>
              <Input
                value={notifyTitle}
                onChange={(e) => setNotifyTitle(e.target.value)}
                placeholder="请输入通知标题"
              />
            </div>
            <div className="space-y-2">
              <Label>通知内容</Label>
              <Textarea
                value={notifyContent}
                onChange={(e) => setNotifyContent(e.target.value)}
                placeholder="请输入通知内容"
                rows={4}
              />
            </div>
            
            {/* 附件上传 */}
            <div className="space-y-2">
              <Label>附件（可选）</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                {uploadedFile ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {attachment.file?.type.startsWith('image/') ? (
                        <Image className="w-8 h-8 text-blue-500" />
                      ) : (
                        <FileText className="w-8 h-8 text-red-500" />
                      )}
                      <div className="max-w-48">
                        <p className="text-sm font-medium truncate" title={uploadedFile.fileName}>
                          {uploadedFile.fileName}
                        </p>
                        <p className="text-xs text-gray-500">已上传</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setAttachment({ file: null, preview: '' });
                        setUploadedFile(null);
                      }}
                      className="text-red-500 hover:text-red-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : attachment.file ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      {attachment.file.type.startsWith('image/') ? (
                        <img src={attachment.preview} alt="Preview" className="w-12 h-12 object-cover rounded" />
                      ) : (
                        <FileText className="w-12 h-12 text-red-500" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" title={attachment.file.name}>
                          {attachment.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(attachment.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setAttachment({ file: null, preview: '' });
                        }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <Button
                      onClick={handleUploadFile}
                      disabled={uploading}
                      className="w-full"
                      size="sm"
                    >
                      {uploading ? (
                        <>上传中...</>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          上传附件
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500 mb-2">支持 JPG、PNG、GIF、WebP、PDF 文件，不超过 10MB</p>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Button variant="outline" size="sm" asChild>
                        <span>选择文件</span>
                      </Button>
                    </label>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="notify-all"
                  checked={notifyAll}
                  onCheckedChange={(checked) => {
                    setNotifyAll(!!checked);
                    if (checked) setNotifyReceiverIds([]);
                  }}
                />
                <Label htmlFor="notify-all" className="cursor-pointer">
                  发送给全部用户 ({users.length}人)
                </Label>
              </div>
            </div>
            {!notifyAll && (
              <div className="space-y-2">
                <Label>选择接收用户 ({users.filter(u => u.id !== 1).length}人可选)</Label>
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                  {users.filter(u => u.id !== 1).length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      暂无可选用户
                    </div>
                  ) : (
                    users.filter(u => u.id !== 1).map((user) => (
                      <div key={user.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`user-${user.id}`}
                          checked={notifyReceiverIds.includes(user.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setNotifyReceiverIds([...notifyReceiverIds, user.id]);
                            } else {
                              setNotifyReceiverIds(notifyReceiverIds.filter((id) => id !== user.id));
                            }
                          }}
                        />
                        <Label htmlFor={`user-${user.id}`} className="cursor-pointer text-sm">
                          {user.name} ({user.username}) {user.email ? `- ${user.email}` : ''}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotifyDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSendNotification} disabled={sending}>
              {sending ? '发送中...' : '发送通知'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
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
                        <p className="font-medium">{selectedNotification.attachment_file_name}</p>
                        <p className="text-sm text-muted-foreground">点击下方按钮下载</p>
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
                  <AlertCircle className="w-4 h-4" />
                  邮件发送失败: {selectedNotification.email_error}
                </div>
              )}
                </>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
