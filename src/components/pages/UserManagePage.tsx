'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { formatChinaDateTime } from '@/lib/china-time';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
 DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Users, Plus, Edit, Trash2, Shield, Search, TicketPlus, Copy, Check, Bell, Send, Mail } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
  department: string;
  department_id?: number;
  position_id?: number;
  manager_id?: number;
  manager_name?: string;
  email?: string;
  created_at: string;
  permissions?: { code: string; name: string; granted: boolean }[];
}

interface Department {
  id: number;
  name: string;
  manager_id?: number;
  manager_name?: string;
}

interface Position {
  id: number;
  name: string;
  department_id: number;
  level: number;
}

interface Permission {
  id: number;
  code: string;
  name: string;
  description: string;
  granted?: boolean;
}

interface RegistrationCodeRecord {
  id: number;
  code: string;
  permissions: string;
  used?: number | boolean;
  expires_at?: string | null;
  created_at?: string | null;
  user_name?: string | null;
}

interface NotificationRecord {
  id: number;
  title?: string | null;
  content?: string | null;
  created_at?: string | null;
  read_at?: string | null;
  sender_name?: string | null;
  receiver_name?: string | null;
  is_read?: number | boolean;
  email_sent?: number | boolean | null;
  email_error?: string | null;
}

interface UsersResponse {
  success?: boolean;
  users?: User[];
}

interface DepartmentsResponse {
  success?: boolean;
  departments?: Department[];
}

interface PositionsResponse {
  success?: boolean;
  positions?: Position[];
}

interface PermissionsResponse {
  success?: boolean;
  permissions?: Permission[];
}

export default function UserManagePage() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  
  // 职位权限映射
  const positionPermissions: Record<string, string[]> = {
    '普通员工': ['customer_view', 'opportunity_view', 'contract_view', 'purchase_submit', 'expense_submit'],
    '组长': ['customer_view', 'opportunity_view', 'contract_view', 'purchase_submit', 'expense_submit', 'purchase_approve', 'expense_approve'],
    '主管': ['customer_view', 'customer_create', 'customer_edit', 'opportunity_view', 'opportunity_create', 'opportunity_edit', 'contract_view', 'contract_create', 'purchase_submit', 'expense_submit', 'purchase_approve', 'expense_approve'],
    '经理': ['customer_view', 'customer_create', 'customer_edit', 'opportunity_view', 'opportunity_create', 'opportunity_edit', 'contract_view', 'contract_create', 'purchase_submit', 'expense_submit', 'purchase_approve', 'expense_approve'],
    '总监': ['customer_view', 'customer_create', 'customer_edit', 'customer_delete', 'opportunity_view', 'opportunity_create', 'opportunity_edit', 'contract_view', 'contract_create', 'purchase_submit', 'expense_submit', 'purchase_approve', 'expense_approve', 'organization_manage'],
    '总经理': ['customer_view', 'customer_create', 'customer_edit', 'customer_delete', 'opportunity_view', 'opportunity_create', 'opportunity_edit', 'contract_view', 'contract_create', 'purchase_submit', 'expense_submit', 'purchase_approve', 'expense_approve', 'organization_manage', 'settings_manage'],
  };

  // 注册码相关状态
  const [regCodeDialogOpen, setRegCodeDialogOpen] = useState(false);
  const [regCodeListOpen, setRegCodeListOpen] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [regCodeCount, setRegCodeCount] = useState(1);
  const [regCodeExpireHours, setRegCodeExpireHours] = useState(24); // 默认24小时
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [regCodeList, setRegCodeList] = useState<RegistrationCodeRecord[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedPositionId, setSelectedPositionId] = useState('');

  // 处理职位选择变化
  const handlePositionChange = (positionId: string) => {
    setSelectedPositionId(positionId);
    if (positionId) {
      const position = positions.find(p => String(p.id) === positionId);
      if (position && positionPermissions[position.name]) {
        setSelectedPermissions([...positionPermissions[position.name]]);
      }
    } else {
      setSelectedPermissions([]);
    }
  };

  // 通知相关状态
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [notifyTitle, setNotifyTitle] = useState('');
  const [notifyContent, setNotifyContent] = useState('');
  const [notifyReceiverIds, setNotifyReceiverIds] = useState<number[]>([]);
  const [notifyAll, setNotifyAll] = useState(false);
  const [sending, setSending] = useState(false);
  
  // 通知记录
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [notificationRecords, setNotificationRecords] = useState<NotificationRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    role: 'user',
    department: '',
    position_id: '',
    manager_id: '',
    email: '',
  });

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json() as UsersResponse;
      if (data.success) {
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('获取用户列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch('/api/departments');
      const data = await res.json() as DepartmentsResponse;
      if (data.success) {
        setDepartments(data.departments || []);
      }
    } catch (error) {
      console.error('获取部门列表失败:', error);
    }
  };

  const fetchPositions = async () => {
    try {
      const res = await fetch('/api/positions');
      const data = await res.json() as PositionsResponse;
      if (data.success) {
        setPositions(data.positions || []);
      }
    } catch (error) {
      console.error('获取职位列表失败:', error);
    }
  };

  const fetchPermissions = async (userId: number) => {
    try {
      const res = await fetch(`/api/permissions?userId=${userId}`);
      const data = await res.json() as PermissionsResponse;
      if (data.success) {
        setPermissions(data.permissions || []);
      }
    } catch (error) {
      console.error('获取权限列表失败:', error);
    }
  };

  useEffect(() => {
    void fetchUsers();
    void fetchDepartments();
    void fetchPositions();
  }, []);

  const handleAddUser = () => {
    setSelectedUser(null);
    setFormData({ username: '', password: '', name: '', role: 'user', department: '', position_id: '', manager_id: '', email: '' });
    setDialogOpen(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      password: '',
      name: user.name,
      role: user.role,
      department: user.department_id ? String(user.department_id) : user.department,
      position_id: String(user.position_id || ''),
      manager_id: String(user.manager_id || ''),
      email: user.email || '',
    });
    setDialogOpen(true);
  };

  const handleManagePermissions = async (user: User) => {
    setSelectedUser(user);
    await fetchPermissions(user.id);
    setPermissionDialogOpen(true);
  };

  const handleDeleteClick = (user: User) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (selectedUser) {
        // 编辑
        const res = await fetch('/api/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: selectedUser.id,
            name: formData.name,
            role: formData.role,
            department: formData.department,
            email: formData.email,
            password: formData.password || undefined,
            position_id: formData.position_id,
            manager_id: formData.manager_id,
          }),
        });
        const data = await res.json();
        if (data.success) {
          alert('用户更新成功');
          fetchUsers();
          setDialogOpen(false);
        } else {
          alert('错误: ' + data.error);
        }
      } else {
        // 新增
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (data.success) {
          alert('用户创建成功');
          fetchUsers();
          setDialogOpen(false);
        } else {
          alert('错误: ' + data.error);
        }
      }
    } catch (error) {
      alert('操作失败');
    }
  };

  // 添加部门经理账号
  const handleAddManager = async (dept: Department) => {
    const deptPosition = positions.find(p => p.name.includes('经理') && (!p.department_id || p.department_id === dept.id));
    const defaultPositionId = deptPosition ? String(deptPosition.id) : '';
    
    setFormData({
      username: '',
      password: '',
      name: '',
      role: 'manager',
      department: String(dept.id),
      position_id: defaultPositionId,
      manager_id: '',
      email: '',
    });
    setSelectedUser(null);
    setDialogOpen(true);
    
    // 添加成功后更新部门经理
    const originalHandleSubmit = handleSubmit;
    const handleManagerSubmit = async () => {
      await originalHandleSubmit();
      fetchDepartments();
    };
    Object.assign(handleSubmit, handleManagerSubmit);
  };

  // 为部门经理生成注册码
  const handleGenerateManagerCode = async (dept: Department) => {
    const deptPosition = positions.find(p => p.name.includes('经理') && (!p.department_id || p.department_id === dept.id));
    
    await fetchAllPermissions();
    
    // 部门经理默认权限
    const managerPerms = ['dashboard', 'organization', 'users', 'approvals', 'expense_claims', 'purchase_requests'];
    setSelectedPermissions(managerPerms);
    setSelectedDepartmentId(String(dept.id));
    setSelectedPositionId(deptPosition ? String(deptPosition.id) : '');
    setGeneratedCode('');
    setRegCodeDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    try {
      const res = await fetch(`/api/users?id=${selectedUser.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        alert('用户删除成功');
        fetchUsers();
        setDeleteDialogOpen(false);
      } else {
        alert('错误: ' + data.error);
      }
    } catch (error) {
      alert('删除失败');
    }
  };

  const handlePermissionChange = async (permissionId: number, granted: boolean) => {
    if (!selectedUser) return;
    try {
      const res = await fetch('/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, permissionId, granted }),
      });
      const data = await res.json();
      if (data.success) {
        setPermissions(prev =>
          prev.map(p => (p.id === permissionId ? { ...p, granted } : p))
        );
        alert('权限设置成功');
      }
    } catch (error) {
      alert('权限设置失败');
    }
  };

  // 获取所有权限列表
  const fetchAllPermissions = async () => {
    try {
      const res = await fetch('/api/permissions');
      const data = await res.json();
      if (data.success) {
        setAllPermissions(data.permissions);
        // 默认选择所有权限
        setSelectedPermissions(data.permissions.map((p: Permission) => p.code));
      }
    } catch (error) {
      console.error('获取权限列表失败:', error);
    }
  };

  // 生成注册码
  const handleGenerateCode = async () => {
    if (selectedPermissions.length === 0) {
      alert('请至少选择一个权限');
      return;
    }
    if (!selectedDepartmentId) {
      alert('请选择部门');
      return;
    }
    if (!selectedPositionId) {
      alert('请选择职位');
      return;
    }
    try {
      const res = await fetch('/api/registration-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          count: regCodeCount, 
          permissions: selectedPermissions,
          expireHours: regCodeExpireHours,
          departmentId: selectedDepartmentId,
          positionId: selectedPositionId
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedCode(data.codes.join('\n'));
      } else {
        alert('错误: ' + data.error);
      }
    } catch (error) {
      alert('生成注册码失败');
    }
  };

  // 获取注册码列表
  const fetchRegCodeList = async () => {
    try {
      const res = await fetch('/api/registration-codes');
      const data = await res.json();
      if (data.success) {
        setRegCodeList(data.codes);
      }
    } catch (error) {
      console.error('获取注册码列表失败:', error);
    }
  };

  // 复制注册码
  const handleCopyCode = async () => {
    if (!generatedCode.trim()) {
      alert('没有可复制的注册码');
      return;
    }
    
    try {
      // 尝试使用 Clipboard API
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Clipboard API 失败，尝试备用方案:', err);
      // 备用方案：创建临时 textarea
      const textarea = document.createElement('textarea');
      textarea.value = generatedCode;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (copyErr) {
        console.error('备用复制方案也失败:', copyErr);
        alert('复制失败，请手动复制');
      } finally {
        document.body.removeChild(textarea);
      }
    }
  };

  // 打开发送通知对话框
  const handleOpenNotify = () => {
    setNotifyTitle('');
    setNotifyContent('');
    setNotifyReceiverIds([]);
    setNotifyAll(false);
    setNotifyDialogOpen(true);
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
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`通知发送成功！${data.emailCount > 0 ? `已发送${data.emailCount}封邮件` : ''}`);
        setNotifyDialogOpen(false);
      } else {
        alert(data.error || '发送失败');
      }
    } catch (error) {
      alert('发送失败');
    } finally {
      setSending(false);
    }
  };

  // 获取通知记录
  const handleOpenRecords = async () => {
    try {
      const res = await fetch('/api/notifications/list');
      const data = await res.json();
      if (data.success) {
        setNotificationRecords(data.data.notifications);
        setRecordDialogOpen(true);
      }
    } catch (error) {
      console.error('获取通知记录失败:', error);
    }
  };

  const filteredUsers = users.filter(
    user =>
      user.name.includes(searchTerm) ||
      user.username.includes(searchTerm) ||
      user.department.includes(searchTerm)
  );

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    users: users.filter(u => u.role === 'user').length,
  };

  if (loading) {
    return <div className="p-6">加载中...</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总用户数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">管理员</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.admins}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">普通用户</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.users}</div>
          </CardContent>
        </Card>
      </div>

      {/* 工具栏 */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleAddUser}>
            <Plus className="h-4 w-4 mr-2" />
            新增用户
          </Button>
          <Button variant="outline" onClick={async () => { await fetchAllPermissions(); setGeneratedCode(''); setRegCodeDialogOpen(true); }}>
            <TicketPlus className="h-4 w-4 mr-2" />
            生成注册码
          </Button>
          <Button variant="outline" onClick={async () => { await fetchRegCodeList(); setRegCodeListOpen(true); }}>
            查看注册码
          </Button>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索用户..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* 用户列表 */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户名</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>部门</TableHead>
                  <TableHead>职位</TableHead>
                  <TableHead>直属上级</TableHead>
                  <TableHead>邮箱</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map(user => {
                  const userPosition = positions.find(p => p.id === user.position_id);
                  const userManager = users.find(u => u.id === user.manager_id);
                  return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>{user.name}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : user.role === 'dept_manager' ? 'outline' : 'secondary'}>
                        {user.role === 'admin' ? '管理员' : user.role === 'dept_manager' ? '部门经理' : '普通用户'}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.department || '-'}</TableCell>
                    <TableCell>{userPosition?.name || '-'}</TableCell>
                    <TableCell>{userManager?.name || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{user.email || '-'}</TableCell>
                    <TableCell>{formatChinaDateTime(user.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleManagePermissions(user)}
                          title="权限管理"
                        >
                          <Shield className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {user.username !== 'admin' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteClick(user)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 新增/编辑用户对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedUser ? '编辑用户' : '新增用户'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>用户名</Label>
              <Input
                value={formData.username}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
                disabled={!!selectedUser}
                placeholder="请输入用户名"
              />
            </div>
            <div className="space-y-2">
              <Label>密码 {selectedUser && '(留空则不修改)'}</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                placeholder="请输入密码"
              />
            </div>
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入姓名"
              />
            </div>
            <div className="space-y-2">
              <Label>角色</Label>
              <Select value={formData.role} onValueChange={v => setFormData({ ...formData, role: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择角色" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">管理员（全部权限）</SelectItem>
                  <SelectItem value="manager">部门经理（部门管理权限）</SelectItem>
                  <SelectItem value="user">普通用户</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>部门</Label>
              <Select value={formData.department} onValueChange={v => {
                const dept = departments.find(d => String(d.id) === v);
                const managerId = dept?.manager_id ? String(dept.manager_id) : '';
                setFormData({ ...formData, department: v, position_id: '', manager_id: managerId });
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择部门" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={String(dept.id)}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>职位</Label>
              <Select value={formData.position_id || ''} onValueChange={v => {
                const pos = positions.find(p => String(p.id) === v);
                const isManagerRole = pos && (pos.name.includes('经理') || pos.name.includes('总监') || pos.name.includes('总经理') || pos.level >= 4);
                const newManagerId = isManagerRole ? '0' : formData.manager_id;
                setFormData({ ...formData, position_id: v, manager_id: newManagerId });
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择职位" />
                </SelectTrigger>
                <SelectContent>
                  {positions.filter(p => {
                    if (!formData.department) return true;
                    if (!p.department_id) return true;
                    return String(p.department_id) === formData.department;
                  }).map(pos => (
                    <SelectItem key={pos.id} value={String(pos.id)}>{pos.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>直属上级</Label>
              <Select value={formData.manager_id || ''} onValueChange={v => setFormData({ ...formData, manager_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择直属上级（可选）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">无（顶级/总公司）</SelectItem>
                  {users.filter(u => u.id !== selectedUser?.id).map(user => (
                    <SelectItem key={user.id} value={String(user.id)}>{user.name} ({user.department || '无部门'})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>邮箱</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="请输入邮箱（用于找回密码）"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleSubmit}>
                {selectedUser ? '保存' : '创建'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 权限管理对话框 */}
      <Dialog open={permissionDialogOpen} onOpenChange={setPermissionDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0 pb-4 border-b border-slate-100">
            <DialogTitle className="text-lg font-semibold text-slate-800">权限管理 - {selectedUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-2 py-4 space-y-6">
            <p className="text-sm text-muted-foreground px-2">
              设置用户对各功能模块的访问权限。关闭表示禁止访问该功能。
            </p>
            
            {/* 全选按钮 */}
            <div className="px-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const allGranted = permissions.every(p => p.granted);
                  permissions.forEach(perm => {
                    handlePermissionChange(perm.id, !allGranted);
                  });
                }}
              >
                {permissions.every(p => p.granted) ? '取消全选' : '全选'}
              </Button>
            </div>
            
            {/* 仪表盘 */}
            <div className="bg-slate-50 rounded-xl p-4">
              <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
                仪表盘
              </h3>
              <div className="space-y-2">
                {permissions.filter(p => p.code === 'dashboard').map(perm => (
                  <div key={perm.id} className="flex items-center justify-between p-2 bg-white rounded-lg">
                    <div>
                      <div className="font-medium text-sm">{perm.name}</div>
                      <div className="text-xs text-muted-foreground">{perm.description}</div>
                    </div>
                    <Switch
                      checked={perm.granted !== false}
                      onCheckedChange={checked => handlePermissionChange(perm.id, checked)}
                      className="data-[state=checked]:bg-blue-500"
                    />
                  </div>
                ))}
              </div>
            </div>
            
            {/* 客户管理 */}
            <div className="bg-slate-50 rounded-xl p-4">
              <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-green-500 rounded-full"></span>
                客户管理
              </h3>
              <div className="space-y-2">
                {permissions.filter(p => ['leads', 'customers', 'contacts', 'followup'].includes(p.code)).map(perm => (
                  <div key={perm.id} className="flex items-center justify-between p-2 bg-white rounded-lg">
                    <div>
                      <div className="font-medium text-sm">{perm.name}</div>
                      <div className="text-xs text-muted-foreground">{perm.description}</div>
                    </div>
                    <Switch
                      checked={perm.granted !== false}
                      onCheckedChange={checked => handlePermissionChange(perm.id, checked)}
                      className="data-[state=checked]:bg-green-500"
                    />
                  </div>
                ))}
              </div>
            </div>
            
            {/* 业务管理 */}
            <div className="bg-slate-50 rounded-xl p-4">
              <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-purple-500 rounded-full"></span>
                业务管理
              </h3>
              <div className="space-y-2">
                {permissions.filter(p => ['contracts', 'invoices', 'products', 'assets'].includes(p.code)).map(perm => (
                  <div key={perm.id} className="flex items-center justify-between p-2 bg-white rounded-lg">
                    <div>
                      <div className="font-medium text-sm">{perm.name}</div>
                      <div className="text-xs text-muted-foreground">{perm.description}</div>
                    </div>
                    <Switch
                      checked={perm.granted !== false}
                      onCheckedChange={checked => handlePermissionChange(perm.id, checked)}
                      className="data-[state=checked]:bg-purple-500"
                    />
                  </div>
                ))}
              </div>
            </div>
            
            {/* 审批流程 */}
            <div className="bg-slate-50 rounded-xl p-4">
              <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-orange-500 rounded-full"></span>
                审批流程
              </h3>
              <div className="space-y-2">
                {permissions.filter(p => ['purchase-requests', 'expense-claims', 'approval-center', 'finance-review'].includes(p.code)).map(perm => (
                  <div key={perm.id} className="flex items-center justify-between p-2 bg-white rounded-lg">
                    <div>
                      <div className="font-medium text-sm">{perm.name}</div>
                      <div className="text-xs text-muted-foreground">{perm.description}</div>
                    </div>
                    <Switch
                      checked={perm.granted !== false}
                      onCheckedChange={checked => handlePermissionChange(perm.id, checked)}
                      className="data-[state=checked]:bg-orange-500"
                    />
                  </div>
                ))}
              </div>
            </div>
            
            {/* 组织人事 */}
            <div className="bg-slate-50 rounded-xl p-4">
              <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-cyan-500 rounded-full"></span>
                组织人事
              </h3>
              <div className="space-y-2">
                {permissions.filter(p => ['usermanage', 'personnel', 'administration', 'human-resources', 'assets', 'salary'].includes(p.code)).map(perm => (
                  <div key={perm.id} className="flex items-center justify-between p-2 bg-white rounded-lg">
                    <div>
                      <div className="font-medium text-sm">{perm.name}</div>
                      <div className="text-xs text-muted-foreground">{perm.description}</div>
                    </div>
                    <Switch
                      checked={perm.granted !== false}
                      onCheckedChange={checked => handlePermissionChange(perm.id, checked)}
                      className="data-[state=checked]:bg-cyan-500"
                    />
                  </div>
                ))}
              </div>
            </div>
            
            {/* 系统管理 */}
            <div className="bg-slate-50 rounded-xl p-4">
              <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-red-500 rounded-full"></span>
                系统管理
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {permissions.filter(p => ['taskmanage', 'todo', 'distribution', 'finance', 'generate', 'ai-chat', 'smtp', 'database-backup', 'operation-logs', 'settings'].includes(p.code)).map(perm => (
                  <div key={perm.id} className="flex items-center justify-between p-2 bg-white rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{perm.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{perm.description}</div>
                    </div>
                    <Switch
                      checked={perm.granted !== false}
                      onCheckedChange={checked => handlePermissionChange(perm.id, checked)}
                      className="data-[state=checked]:bg-red-500 flex-shrink-0 ml-2"
                    />
                  </div>
                ))}
              </div>
            </div>
            
            {/* 发送通知中心 */}
            <div className="bg-slate-50 rounded-xl p-4">
              <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
                发送通知中心
              </h3>
              <div className="space-y-2">
                {permissions.filter(p => p.code === 'notification-center').map(perm => (
                  <div key={perm.id} className="flex items-center justify-between p-2 bg-white rounded-lg">
                    <div>
                      <div className="font-medium text-sm">{perm.name}</div>
                      <div className="text-xs text-muted-foreground">{perm.description}</div>
                    </div>
                    <Switch
                      checked={perm.granted !== false}
                      onCheckedChange={checked => handlePermissionChange(perm.id, checked)}
                      className="data-[state=checked]:bg-indigo-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex-shrink-0 px-6 py-3 border-t border-slate-100">
            <Button variant="outline" onClick={() => setPermissionDialogOpen(false)} className="w-full">
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除用户 &quot;{selectedUser?.name}&quot; 吗？此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 生成注册码对话框 */}
      <Dialog open={regCodeDialogOpen} onOpenChange={setRegCodeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>生成注册码</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {generatedCode ? (
              <>
                <div className="p-3 bg-green-50 rounded-lg text-sm text-green-700">
                  注册码已生成！请将注册码发送给需要注册的用户。
                </div>
                <div className="space-y-2">
                  <Label>注册码</Label>
                  <Textarea
                    value={generatedCode}
                    readOnly
                    className="font-mono text-sm"
                    rows={Math.min(generatedCode.split('\n').length, 5)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setRegCodeDialogOpen(false)} className="flex-1">
                    关闭
                  </Button>
                  <Button onClick={handleCopyCode} className="flex-1">
                    {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                    {copied ? '已复制' : '复制注册码'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  生成注册码后，新用户可以使用注册码自行注册账号。注册后用户将自动获得所选权限。
                </p>
                <div className="space-y-2">
                  <Label>生成数量</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={regCodeCount}
                    onChange={e => setRegCodeCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>有效期（小时）</Label>
                  <Input
                    type="number"
                    min={1}
                    max={720}
                    value={regCodeExpireHours}
                    onChange={e => setRegCodeExpireHours(Math.min(720, Math.max(1, parseInt(e.target.value) || 24)))}
                    placeholder="默认24小时"
                  />
                  <p className="text-xs text-muted-foreground">注册码将在指定小时后失效，最大720小时（30天）</p>
                </div>
                <div className="space-y-2">
                  <Label>所属部门 *</Label>
                  <Select value={selectedDepartmentId} onValueChange={v => { setSelectedDepartmentId(v); setSelectedPositionId(''); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择部门" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map(dept => (
                        <SelectItem key={dept.id} value={String(dept.id)}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>职位 *</Label>
                  <Select value={selectedPositionId} onValueChange={handlePositionChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="请选择职位" />
                    </SelectTrigger>
                    <SelectContent>
                      {positions.filter(p => {
                        if (!selectedDepartmentId) return true;
                        if (!p.department_id) return true;
                        return String(p.department_id) === selectedDepartmentId;
                      }).map(pos => (
                        <SelectItem key={pos.id} value={String(pos.id)}>{pos.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>分配权限</Label>
                  <p className="text-xs text-muted-foreground">选择注册用户可访问的功能模块</p>
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {allPermissions.map(perm => (
                      <div key={perm.id} className="flex items-center justify-between p-3">
                        <div className="flex-1">
                          <div className="text-sm font-medium">{perm.name}</div>
                          <div className="text-xs text-muted-foreground">{perm.description}</div>
                        </div>
                        <Switch
                          checked={selectedPermissions.includes(perm.code)}
                          onCheckedChange={checked => {
                            if (checked) {
                              setSelectedPermissions([...selectedPermissions, perm.code]);
                            } else {
                              setSelectedPermissions(selectedPermissions.filter(p => p !== perm.code));
                            }
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setRegCodeDialogOpen(false)} className="flex-1">
                    取消
                  </Button>
                  <Button onClick={handleGenerateCode} className="flex-1">
                    <TicketPlus className="h-4 w-4 mr-2" />
                    生成
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 注册码列表对话框 */}
      <Dialog open={regCodeListOpen} onOpenChange={setRegCodeListOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>注册码列表</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>注册码</TableHead>
                  <TableHead>权限</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>过期时间</TableHead>
                  <TableHead>使用者</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {regCodeList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      暂无注册码
                    </TableCell>
                  </TableRow>
                ) : (
                  regCodeList.map((code) => (
                    <TableRow key={code.id}>
                      <TableCell className="font-mono text-sm">{code.code}</TableCell>
                      <TableCell className="max-w-32 truncate" title={code.permissions}>
                        {code.permissions ? JSON.parse(code.permissions).length + '项权限' : '-'}
                      </TableCell>
                      <TableCell>
                        {code.used ? (
                          <Badge variant="secondary">已使用</Badge>
                        ) : code.expires_at && new Date(code.expires_at) < new Date() ? (
                          <Badge variant="destructive">已过期</Badge>
                        ) : (
                          <Badge variant="default">未使用</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{formatChinaDateTime(code.created_at)}</TableCell>
                      <TableCell className="text-sm">
                        {code.expires_at ? formatChinaDateTime(code.expires_at) : '永久'}
                      </TableCell>
                      <TableCell>{code.user_name || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* 发送通知对话框 */}
      <Dialog open={notifyDialogOpen} onOpenChange={setNotifyDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>发送通知</DialogTitle>
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
                      暂无可选用户，请先添加用户
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

      {/* 通知记录对话框 */}
      <Dialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>通知记录</DialogTitle>
            <DialogDescription>
              查看所有已发送的通知及其状态
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh]">
            {notificationRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                暂无通知记录
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>标题</TableHead>
                    <TableHead>接收人</TableHead>
                    <TableHead>发送时间</TableHead>
                    <TableHead>阅读状态</TableHead>
                    <TableHead>邮件状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notificationRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{record.title}</div>
                          {record.content && (
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {record.content}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{record.receiver_name}</TableCell>
                      <TableCell>
                        {formatChinaDateTime(record.created_at)}
                      </TableCell>
                      <TableCell>
                        {record.is_read ? (
                          <span className="text-green-600 flex items-center gap-1">
                            <Check className="h-4 w-4" /> 已读
                            {record.read_at && (
                              <span className="text-xs text-muted-foreground">
                                ({formatChinaDateTime(record.read_at)})
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-orange-600 flex items-center gap-1">
                            <span className="h-2 w-2 rounded-full bg-orange-500"></span> 未读
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {record.email_sent === 1 ? (
                          <span className="text-green-600 flex items-center gap-1">
                            <Check className="h-4 w-4" /> 已发送
                          </span>
                        ) : record.email_error ? (
                          <span className="text-red-600" title={record.email_error}>
                            发送失败
                          </span>
                        ) : (
                          <span className="text-muted-foreground">未发送</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
