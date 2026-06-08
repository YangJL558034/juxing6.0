'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Shield,
  User,
  Building,
  Edit2,
  Trash2,
  Plus,
  RefreshCw,
} from 'lucide-react';

interface Role {
  id: number;
  name: string;
  description: string;
  permissions: string[];
  created_at: string;
}

interface Permission {
  id: number;
  name: string;
  code: string;
  description: string;
  module: string;
}

const permissionModules = [
  { name: '客户管理', code: 'customer' },
  { name: '商机管理', code: 'opportunity' },
  { name: '合同管理', code: 'contract' },
  { name: '请购单', code: 'purchase' },
  { name: '报销管理', code: 'expense' },
  { name: '组织架构', code: 'organization' },
  { name: '组织人事', code: 'hr' },
  { name: '系统设置', code: 'settings' },
];

const defaultPermissions = [
  { id: 1, name: '查看客户', code: 'customer_view', description: '查看客户列表和详情', module: 'customer' },
  { id: 2, name: '创建客户', code: 'customer_create', description: '创建新客户', module: 'customer' },
  { id: 3, name: '编辑客户', code: 'customer_edit', description: '编辑客户信息', module: 'customer' },
  { id: 4, name: '删除客户', code: 'customer_delete', description: '删除客户', module: 'customer' },
  { id: 5, name: '查看商机', code: 'opportunity_view', description: '查看商机列表和详情', module: 'opportunity' },
  { id: 6, name: '创建商机', code: 'opportunity_create', description: '创建新商机', module: 'opportunity' },
  { id: 7, name: '编辑商机', code: 'opportunity_edit', description: '编辑商机信息', module: 'opportunity' },
  { id: 8, name: '查看合同', code: 'contract_view', description: '查看合同列表和详情', module: 'contract' },
  { id: 9, name: '创建合同', code: 'contract_create', description: '创建新合同', module: 'contract' },
  { id: 10, name: '提交请购单', code: 'purchase_submit', description: '提交请购单申请', module: 'purchase' },
  { id: 11, name: '审批请购单', code: 'purchase_approve', description: '审批下属请购单', module: 'purchase' },
  { id: 12, name: '提交报销', code: 'expense_submit', description: '提交费用报销', module: 'expense' },
  { id: 13, name: '审批报销', code: 'expense_approve', description: '审批下属报销', module: 'expense' },
  { id: 14, name: '财务终审', code: 'finance_review', description: '财务终审权限', module: 'expense' },
  { id: 15, name: '管理组织', code: 'organization_manage', description: '管理组织架构', module: 'organization' },
  { id: 16, name: '系统设置', code: 'settings_manage', description: '系统设置权限', module: 'settings' },
  { id: 17, name: '用户管理', code: 'usermanage', description: '管理系统用户', module: 'hr' },
  { id: 18, name: '人事管理', code: 'personnel', description: '管理员工入职登记和员工档案', module: 'hr' },
  { id: 19, name: '行政管理', code: 'administration', description: '管理员工住宿、水表和行政申请', module: 'hr' },
  { id: 20, name: '人力资源', code: 'human-resources', description: '管理招聘职位和简历投递', module: 'hr' },
  { id: 21, name: '资产管理', code: 'assets', description: '管理公司资产', module: 'hr' },
  { id: 22, name: '工资工时查询', code: 'salary', description: '查询工资工时信息', module: 'hr' },
  { id: 23, name: '数据库备份', code: 'database-backup', description: '备份和恢复系统数据库', module: 'settings' },
  { id: 24, name: '邮件配置', code: 'smtp', description: '配置系统邮件发送', module: 'settings' },
  { id: 25, name: '通知中心', code: 'notification-center', description: '发送和查看系统通知', module: 'settings' },
];

const defaultRoles: Role[] = [
  { id: 1, name: '超级管理员', description: '拥有系统全部权限', permissions: defaultPermissions.map(p => p.code), created_at: '2024-01-01' },
  { id: 2, name: '部门经理', description: '管理部门业务，审批下属单据', permissions: ['customer_view', 'customer_create', 'customer_edit', 'opportunity_view', 'opportunity_create', 'opportunity_edit', 'contract_view', 'contract_create', 'purchase_submit', 'purchase_approve', 'expense_submit', 'expense_approve'], created_at: '2024-01-01' },
  { id: 3, name: '普通员工', description: '仅能操作个人业务', permissions: ['customer_view', 'opportunity_view', 'contract_view', 'purchase_submit', 'expense_submit'], created_at: '2024-01-01' },
  { id: 4, name: '财务人员', description: '财务终审权限', permissions: ['contract_view', 'purchase_approve', 'expense_approve', 'finance_review'], created_at: '2024-01-01' },
];

export default function PermissionPage() {
  const [roles, setRoles] = useState<Role[]>(defaultRoles);
  const [permissions] = useState<Permission[]>(defaultPermissions);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [newRole, setNewRole] = useState({ name: '', description: '', permissions: [] as string[] });
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const handleOpenRoleDialog = (role?: Role) => {
    if (role) {
      setEditingRole(role);
      setNewRole({
        name: role.name,
        description: role.description,
        permissions: [...role.permissions],
      });
    } else {
      setEditingRole(null);
      setNewRole({ name: '', description: '', permissions: [] });
    }
    setShowRoleDialog(true);
  };

  const handleSaveRole = () => {
    if (!newRole.name.trim()) return;

    if (editingRole) {
      setRoles(roles.map(r => r.id === editingRole.id ? { ...r, ...newRole, id: r.id, created_at: r.created_at } : r));
    } else {
      const newId = Math.max(...roles.map(r => r.id)) + 1;
      setRoles([...roles, { ...newRole, id: newId, created_at: new Date().toISOString().split('T')[0] }]);
    }
    setShowRoleDialog(false);
  };

  const handleDeleteRole = (roleId: number) => {
    if (confirm('确定要删除这个角色吗？')) {
      setRoles(roles.filter(r => r.id !== roleId));
    }
  };

  const togglePermission = (code: string) => {
    setNewRole(prev => ({
      ...prev,
      permissions: prev.permissions.includes(code)
        ? prev.permissions.filter(p => p !== code)
        : [...prev.permissions, code],
    }));
  };

  const groupedPermissions = permissionModules.map(module => ({
    ...module,
    permissions: permissions.filter(p => p.module === module.code),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">层级权限配置</h1>
          <p className="text-slate-500 mt-1">管理系统角色和权限分配</p>
        </div>
        <Button onClick={() => handleOpenRoleDialog()} className="bg-blue-500 hover:bg-blue-600">
          <Plus className="w-4 h-4 mr-2" />
          新建角色
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-500" />
              角色列表
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {roles.map(role => (
              <div
                key={role.id}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedRole?.id === role.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
                onClick={() => setSelectedRole(role)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="font-medium">{role.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleOpenRoleDialog(role); }}
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    {role.id !== 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={(e) => { e.stopPropagation(); handleDeleteRole(role.id); }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-500 mt-1">{role.description}</p>
                <p className="text-xs text-slate-400 mt-2">
                  权限数: {role.permissions.length} | 创建于: {role.created_at}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5 text-blue-500" />
              {selectedRole ? `${selectedRole.name} 的权限配置` : '选择角色查看权限'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedRole ? (
              <div className="space-y-4">
                {groupedPermissions.map(module => (
                  <div key={module.code} className="border rounded-lg overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 border-b flex items-center justify-between">
                      <span className="font-medium text-slate-700">{module.name}</span>
                      <span className="text-sm text-slate-500">
                        {selectedRole.permissions.filter(p => permissions.find(perm => perm.code === p && perm.module === module.code) !== undefined).length}/{module.permissions.length}
                      </span>
                    </div>
                    <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {module.permissions.map(perm => (
                        <div
                          key={perm.id}
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            selectedRole.permissions.includes(perm.code)
                              ? 'bg-blue-50 border border-blue-200'
                              : 'bg-slate-50 border border-transparent'
                          }`}
                        >
                          <div>
                            <span className="font-medium text-sm">{perm.name}</span>
                            <p className="text-xs text-slate-500 mt-0.5">{perm.description}</p>
                          </div>
                          <Switch
                            checked={selectedRole.permissions.includes(perm.code)}
                            onCheckedChange={() => {
                              setSelectedRole(prev => prev ? {
                                ...prev,
                                permissions: prev.permissions.includes(perm.code)
                                  ? prev.permissions.filter(p => p !== perm.code)
                                  : [...prev.permissions, perm.code],
                              } : null);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="flex justify-end">
                  <Button
                    onClick={() => {
                      const updatedRoles = roles.map(r => r.id === selectedRole.id ? selectedRole : r);
                      setRoles(updatedRoles);
                    }}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    保存权限
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Shield className="w-12 h-12 mb-4" />
                <p>请从左侧选择一个角色</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogTrigger asChild>
          <Button variant="outline">新建角色</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRole ? '编辑角色' : '新建角色'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="role-name">角色名称</Label>
              <Input
                id="role-name"
                value={newRole.name}
                onChange={(e) => setNewRole(prev => ({ ...prev, name: e.target.value }))}
                placeholder="请输入角色名称"
              />
            </div>
            <div>
              <Label htmlFor="role-description">角色描述</Label>
              <Input
                id="role-description"
                value={newRole.description}
                onChange={(e) => setNewRole(prev => ({ ...prev, description: e.target.value }))}
                placeholder="请输入角色描述"
              />
            </div>
            <div>
              <Label>权限选择</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {permissions.map(perm => (
                  <label
                    key={perm.id}
                    className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
                      newRole.permissions.includes(perm.code)
                        ? 'bg-blue-50 border border-blue-200'
                        : 'bg-slate-50 border border-transparent hover:border-slate-200'
                    }`}
                  >
                    <Switch
                      checked={newRole.permissions.includes(perm.code)}
                      onCheckedChange={() => togglePermission(perm.code)}
                    />
                    <span className="text-sm">{perm.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
                取消
              </Button>
              <Button onClick={handleSaveRole} className="bg-blue-500 hover:bg-blue-600">
                {editingRole ? '保存修改' : '创建角色'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
