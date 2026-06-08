'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Settings as SettingsIcon, 
  Bell, 
  Shield, 
  Database,
  Palette,
  Globe,
  Mail,
  Save,
  Server,
  CheckCircle,
  XCircle,
  Bot,
  MessageSquare,
  Play,
  Square,
  RefreshCw,
  Download,
  UploadCloud,
  HardDrive,
} from 'lucide-react';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from_name: string;
  from_email: string;
}

interface ServerInfo {
  platform: string;
  platformName: string;
  release: string;
  arch: string;
  hostname: string;
  cpus: number;
  totalMem: string;
  freeMem: string;
  uptime: string;
}

interface DatabaseBackupConfig {
  autoEnabled: boolean;
  intervalHours: number;
  lastBackupAt: string | null;
  lastBackupFile: string | null;
  backupDir: string;
}

interface DatabaseBackupFile {
  fileName: string;
  size: number;
  createdAt: string;
  updatedAt: string;
}

export function SettingsPage() {
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [backupConfig, setBackupConfig] = useState<DatabaseBackupConfig>({
    autoEnabled: false,
    intervalHours: 24,
    lastBackupAt: null,
    lastBackupFile: null,
    backupDir: '',
  });
  const [backupFiles, setBackupFiles] = useState<DatabaseBackupFile[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupSaving, setBackupSaving] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [basicSettings, setBasicSettings] = useState({
    siteName: '聚星数据平台',
    siteDesc: '企业级客户关系管理系统',
    logo: '/logo.png',
  });

  const [notifySettings, setNotifySettings] = useState({
    emailNotify: true,
    smsNotify: false,
    systemNotify: true,
    taskReminder: true,
    contractExpiry: true,
  });

  const [securitySettings, setSecuritySettings] = useState({
    passwordMinLength: 8,
    passwordRequireSpecial: true,
    loginFailLimit: 5,
    sessionTimeout: 30,
    twoFactorAuth: false,
  });

  const [emailConfig, setEmailConfig] = useState<EmailConfig>({
    host: '',
    port: 465,
    secure: true,
    user: '',
    password: '',
    from_name: '聚星数据平台',
    from_email: '',
  });
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailTestLoading, setEmailTestLoading] = useState(false);
  const [emailTestResult, setEmailTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // AI 配置
  const [aiConfigs, setAiConfigs] = useState({
    deepSeekApiKey: '',
    doubaoApiKey: '',
    doubaoSecret: '',
    defaultProvider: 'deepseek' as 'deepseek' | 'doubao',
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  // 加载服务器信息
  useEffect(() => {
    const loadServerInfo = async () => {
      try {
        const res = await fetch('/api/system/info');
        const data = await res.json();
        if (data.success) {
          setServerInfo(data.data);
        }
      } catch (error) {
        console.error('Load server info error:', error);
      }
    };
    loadServerInfo();
  }, []);

  const loadBackupInfo = useCallback(async () => {
    setBackupLoading(true);
    try {
      const res = await fetch('/api/database-backup', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setBackupConfig(data.config);
        setBackupFiles(data.backups || []);
      }
    } catch (error) {
      console.error('Load database backup info error:', error);
    } finally {
      setBackupLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBackupInfo();
  }, [loadBackupInfo]);

  // 加载邮箱配置
  useEffect(() => {
    const loadEmailConfig = async () => {
      try {
        const res = await fetch('/api/email-config');
        const data = await res.json();
        if (data && data.host !== undefined) {
          setEmailConfig({
            host: data.host || '',
            port: data.port || 465,
            secure: data.secure === true || data.secure === 1,
            user: data.user || '',
            password: '',
            from_name: data.from_name || '聚星数据平台',
            from_email: data.from_email || '',
          });
        }
      } catch (error) {
        console.error('Load email config error:', error);
      }
    };
    loadEmailConfig();
  }, []);

  // 加载 AI 配置
  useEffect(() => {
    const loadAiConfig = async () => {
      try {
        const res = await fetch('/api/ai-config');
        const data = await res.json();
        if (data.success) {
          setAiConfigs({
            deepSeekApiKey: data.config.deepSeekApiKey || '',
            doubaoApiKey: data.config.doubaoApiKey || '',
            doubaoSecret: data.config.doubaoSecret || '',
            defaultProvider: (data.config.defaultProvider as 'deepseek' | 'doubao') || 'deepseek',
          });
        }
      } catch (error) {
        console.error('Load AI config error:', error);
      }
    };
    loadAiConfig();
  }, []);

  const handleSave = (section: string) => {
    alert(`${section}设置已保存`);
  };

  const handleSaveEmailConfig = async () => {
    setEmailLoading(true);
    try {
      const res = await fetch('/api/email-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailConfig),
      });
      const data = await res.json();
      if (data.success) {
        alert('邮箱配置保存成功');
      } else {
        alert(data.error || '保存失败');
      }
    } catch (error) {
      alert('网络错误');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleTestEmail = async () => {
    setEmailTestLoading(true);
    setEmailTestResult(null);
    try {
      const res = await fetch('/api/email-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailConfig),
      });
      const data = await res.json();
      setEmailTestResult({
        success: data.success,
        message: data.success ? '邮件发送成功，请检查收件箱' : (data.error || '发送失败'),
      });
    } catch (error) {
      setEmailTestResult({
        success: false,
        message: '网络错误',
      });
    } finally {
      setEmailTestLoading(false);
    }
  };

  // 保存 AI 配置
  const handleSaveAiConfig = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiConfigs),
      });
      const data = await res.json();
      if (data.success) {
        alert('AI 配置保存成功');
      } else {
        alert(data.error || '保存失败');
      }
    } catch (error) {
      alert('网络错误');
    } finally {
      setAiLoading(false);
    }
  };

  // 测试 AI 连接
  const handleTestAiConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/ai-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiConfigs),
      });
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.success ? 'AI 连接测试成功！' : (data.error || '连接失败'),
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: '网络错误',
      });
    } finally {
      setTesting(false);
    }
  };

  const formatBackupSize = (size: number) => {
    if (!size) return '-';
    if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatBackupTime = (value?: string | null) => {
    if (!value) return '-';
    return new Date(value).toLocaleString('zh-CN');
  };

  const handleDownloadDatabaseBackup = () => {
    window.location.assign('/api/database-backup?action=download');
    setTimeout(() => {
      loadBackupInfo();
    }, 1200);
  };

  const handleDownloadBackupFile = (fileName: string) => {
    window.location.assign(`/api/database-backup?action=file&file=${encodeURIComponent(fileName)}`);
  };

  const handleSaveBackupConfig = async () => {
    setBackupSaving(true);
    try {
      const res = await fetch('/api/database-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-config',
          autoEnabled: backupConfig.autoEnabled,
          intervalHours: backupConfig.intervalHours,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBackupConfig(data.config);
        setBackupFiles(data.backups || []);
        alert('数据库自动备份设置已保存');
      } else {
        alert(data.error || '保存自动备份设置失败');
      }
    } catch (error) {
      alert('保存自动备份设置失败');
    } finally {
      setBackupSaving(false);
    }
  };

  const handleRestoreDatabase = async () => {
    if (!restoreFile) {
      alert('请先选择要恢复的数据库备份文件');
      return;
    }
    if (!confirm('恢复数据库会覆盖当前数据。系统会先自动备份当前数据库，确定继续吗？')) {
      return;
    }

    setRestoreLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', restoreFile);
      const res = await fetch('/api/database-backup', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setRestoreFile(null);
        setBackupConfig(data.config);
        setBackupFiles(data.backups || []);
        alert('数据库恢复成功，请刷新页面确认数据');
      } else {
        alert(data.error || '数据库恢复失败');
      }
    } catch (error) {
      alert('数据库恢复失败');
    } finally {
      setRestoreLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-6 h-6" />
          系统设置
        </h1>
      </div>

      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-7 w-full md:w-auto">
          <TabsTrigger value="basic" className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            <span className="hidden sm:inline">基本设置</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="w-4 h-4" />
            <span className="hidden sm:inline">邮箱配置</span>
          </TabsTrigger>
          <TabsTrigger value="notify" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">通知设置</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">安全设置</span>
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Bot className="w-4 h-4" />
            <span className="hidden sm:inline">AI助手</span>
          </TabsTrigger>
          <TabsTrigger value="backup" className="flex items-center gap-2">
            <HardDrive className="w-4 h-4" />
            <span className="hidden sm:inline">数据库备份</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline">系统信息</span>
          </TabsTrigger>
        </TabsList>

        {/* 基本设置 */}
        <TabsContent value="basic">
          <Card>
            <CardHeader>
              <CardTitle>基本设置</CardTitle>
              <CardDescription>配置平台的基本信息和外观</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="siteName">平台名称</Label>
                  <Input
                    id="siteName"
                    value={basicSettings.siteName}
                    onChange={(e) => setBasicSettings({ ...basicSettings, siteName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siteDesc">平台描述</Label>
                  <Input
                    id="siteDesc"
                    value={basicSettings.siteDesc}
                    onChange={(e) => setBasicSettings({ ...basicSettings, siteDesc: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo">Logo 路径</Label>
                <Input
                  id="logo"
                  value={basicSettings.logo}
                  onChange={(e) => setBasicSettings({ ...basicSettings, logo: e.target.value })}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={() => handleSave('基本')}>
                  <Save className="w-4 h-4 mr-2" />
                  保存设置
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 邮箱配置 */}
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle>邮箱服务器配置</CardTitle>
              <CardDescription>配置SMTP服务器用于发送验证码和通知邮件</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="emailHost">SMTP服务器地址</Label>
                  <Input
                    id="emailHost"
                    placeholder="smtp.example.com"
                    value={emailConfig.host}
                    onChange={(e) => setEmailConfig({ ...emailConfig, host: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailPort">端口</Label>
                  <Input
                    id="emailPort"
                    type="number"
                    placeholder="465"
                    value={emailConfig.port}
                    onChange={(e) => setEmailConfig({ ...emailConfig, port: parseInt(e.target.value) || 465 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailUser">邮箱账号</Label>
                  <Input
                    id="emailUser"
                    placeholder="your@email.com"
                    value={emailConfig.user}
                    onChange={(e) => setEmailConfig({ ...emailConfig, user: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emailPassword">邮箱密码/授权码</Label>
                  <Input
                    id="emailPassword"
                    type="password"
                    placeholder="请输入密码或授权码"
                    value={emailConfig.password}
                    onChange={(e) => setEmailConfig({ ...emailConfig, password: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fromName">发件人名称</Label>
                  <Input
                    id="fromName"
                    placeholder="聚星数据平台"
                    value={emailConfig.from_name}
                    onChange={(e) => setEmailConfig({ ...emailConfig, from_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fromEmail">发件人邮箱</Label>
                  <Input
                    id="fromEmail"
                    placeholder="noreply@example.com"
                    value={emailConfig.from_email}
                    onChange={(e) => setEmailConfig({ ...emailConfig, from_email: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-gray-500" />
                  <div>
                    <p className="font-medium">使用SSL加密</p>
                    <p className="text-sm text-gray-500">推荐开启，端口465通常使用SSL</p>
                  </div>
                </div>
                <Switch
                  checked={emailConfig.secure}
                  onCheckedChange={(v) => setEmailConfig({ ...emailConfig, secure: v })}
                />
              </div>

              {emailTestResult && (
                <div className={`p-4 rounded-lg flex items-center gap-3 ${
                  emailTestResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {emailTestResult.success ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                  {emailTestResult.message}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleTestEmail}
                  disabled={emailTestLoading || !emailConfig.host || !emailConfig.user}
                >
                  {emailTestLoading ? '发送中...' : '发送测试邮件'}
                </Button>
                <Button 
                  onClick={handleSaveEmailConfig}
                  disabled={emailLoading}
                >
                  <Save className="w-4 h-4 mr-2" />
                  {emailLoading ? '保存中...' : '保存配置'}
                </Button>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700 mb-2">
                  💡 常用邮箱SMTP配置参考：
                </p>
                <div className="text-xs text-blue-600 space-y-1">
                  <p>• QQ邮箱: smtp.qq.com, 端口465, 需使用授权码</p>
                  <p>• 163邮箱: smtp.163.com, 端口465, 需使用授权码</p>
                  <p>• Gmail: smtp.gmail.com, 端口587, 需启用应用专用密码</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 通知设置 */}
        <TabsContent value="notify">
          <Card>
            <CardHeader>
              <CardTitle>通知设置</CardTitle>
              <CardDescription>配置系统通知和提醒方式</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-medium">邮件通知</p>
                      <p className="text-sm text-gray-500">通过邮件发送重要通知</p>
                    </div>
                  </div>
                  <Switch
                    checked={notifySettings.emailNotify}
                    onCheckedChange={(v) => setNotifySettings({ ...notifySettings, emailNotify: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-medium">系统通知</p>
                      <p className="text-sm text-gray-500">在系统内显示通知消息</p>
                    </div>
                  </div>
                  <Switch
                    checked={notifySettings.systemNotify}
                    onCheckedChange={(v) => setNotifySettings({ ...notifySettings, systemNotify: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-medium">任务提醒</p>
                      <p className="text-sm text-gray-500">任务到期前自动提醒</p>
                    </div>
                  </div>
                  <Switch
                    checked={notifySettings.taskReminder}
                    onCheckedChange={(v) => setNotifySettings({ ...notifySettings, taskReminder: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-medium">合同到期提醒</p>
                      <p className="text-sm text-gray-500">合同即将到期时发送提醒</p>
                    </div>
                  </div>
                  <Switch
                    checked={notifySettings.contractExpiry}
                    onCheckedChange={(v) => setNotifySettings({ ...notifySettings, contractExpiry: v })}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => handleSave('通知')}>
                  <Save className="w-4 h-4 mr-2" />
                  保存设置
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI 助手配置 */}
        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                AI 助手配置
              </CardTitle>
              <CardDescription>配置 AI 服务提供商（DeepSeek 或 豆包）</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 默认 AI 提供商 */}
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <SettingsIcon className="w-4 h-4" />
                  默认 AI 提供商
                </h3>
                <div className="flex gap-4">
                  <Button
                    variant={aiConfigs.defaultProvider === 'deepseek' ? 'default' : 'outline'}
                    onClick={() => setAiConfigs({ ...aiConfigs, defaultProvider: 'deepseek' })}
                    className="flex-1"
                  >
                    DeepSeek
                  </Button>
                  <Button
                    variant={aiConfigs.defaultProvider === 'doubao' ? 'default' : 'outline'}
                    onClick={() => setAiConfigs({ ...aiConfigs, defaultProvider: 'doubao' })}
                    className="flex-1"
                  >
                    豆包
                  </Button>
                </div>
              </div>

              {/* DeepSeek AI 配置 */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  DeepSeek AI
                </h3>
                <p className="text-sm text-muted-foreground">
                  配置 DeepSeek API Key，用于智能对话功能
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="deepSeekApiKey">API Key</Label>
                    <Input
                      id="deepSeekApiKey"
                      type="password"
                      placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                      value={aiConfigs.deepSeekApiKey}
                      onChange={(e) => setAiConfigs({ ...aiConfigs, deepSeekApiKey: e.target.value })}
                    />
                  </div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-700">
                      <p className="font-medium mb-2">获取方式：</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>访问 <a href="https://platform.deepseek.com/" target="_blank" className="underline">DeepSeek 平台</a> 注册账号</li>
                        <li>创建 API Key</li>
                        <li>复制 API Key 粘贴到上方输入框</li>
                      </ul>
                      <p className="mt-2">
                        <a href="https://api-docs.deepseek.com/zh-cn/" target="_blank" className="underline">API 文档</a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 豆包 AI 配置 */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  豆包 AI
                </h3>
                <p className="text-sm text-muted-foreground">
                  配置豆包 API Key 和 Secret，用于智能对话功能
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="doubaoApiKey">API Key</Label>
                    <Input
                      id="doubaoApiKey"
                      type="password"
                      placeholder="24.xxxxxxxxxxxxxxxxxx"
                      value={aiConfigs.doubaoApiKey}
                      onChange={(e) => setAiConfigs({ ...aiConfigs, doubaoApiKey: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="doubaoSecret">Secret</Label>
                    <Input
                      id="doubaoSecret"
                      type="password"
                      placeholder="xxxxxxxxxxxxxxxxxx"
                      value={aiConfigs.doubaoSecret}
                      onChange={(e) => setAiConfigs({ ...aiConfigs, doubaoSecret: e.target.value })}
                    />
                  </div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-700">
                      <p className="font-medium mb-2">获取方式：</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>访问 <a href="https://console.doubao.com/" target="_blank" className="underline">豆包开放平台</a> 注册账号</li>
                        <li>创建应用并获取 API Key 和 Secret</li>
                        <li>复制到上方输入框</li>
                      </ul>
                      <p className="mt-2">
                        <a href="https://open.doubao.com/docs/api/" target="_blank" className="underline">API 文档</a>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {testResult && (
                  <div className={`p-4 rounded-lg flex items-center gap-3 ${
                    testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {testResult.success ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <XCircle className="w-5 h-5" />
                    )}
                    {testResult.message}
                  </div>
                )}
                
                <div className="flex justify-end gap-3">
                  <Button 
                    variant="outline" 
                    onClick={handleTestAiConnection}
                    disabled={testing}
                  >
                    {testing ? '测试中...' : '测试连接'}
                  </Button>
                  <Button 
                    onClick={handleSaveAiConfig}
                    disabled={aiLoading}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {aiLoading ? '保存中...' : '保存配置'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 安全设置 */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>安全设置</CardTitle>
              <CardDescription>配置账户安全和访问控制</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="passwordMinLength">密码最小长度</Label>
                  <Input
                    id="passwordMinLength"
                    type="number"
                    value={securitySettings.passwordMinLength}
                    onChange={(e) => setSecuritySettings({ ...securitySettings, passwordMinLength: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loginFailLimit">登录失败次数限制</Label>
                  <Input
                    id="loginFailLimit"
                    type="number"
                    value={securitySettings.loginFailLimit}
                    onChange={(e) => setSecuritySettings({ ...securitySettings, loginFailLimit: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">会话超时时间（分钟）</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    value={securitySettings.sessionTimeout}
                    onChange={(e) => setSecuritySettings({ ...securitySettings, sessionTimeout: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">密码要求特殊字符</p>
                    <p className="text-sm text-gray-500">密码必须包含特殊字符</p>
                  </div>
                  <Switch
                    checked={securitySettings.passwordRequireSpecial}
                    onCheckedChange={(v) => setSecuritySettings({ ...securitySettings, passwordRequireSpecial: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">双因素认证</p>
                    <p className="text-sm text-gray-500">启用双因素认证增强安全性</p>
                  </div>
                  <Switch
                    checked={securitySettings.twoFactorAuth}
                    onCheckedChange={(v) => setSecuritySettings({ ...securitySettings, twoFactorAuth: v })}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => handleSave('安全')}>
                  <Save className="w-4 h-4 mr-2" />
                  保存设置
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 数据库备份 */}
        <TabsContent value="backup">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  数据库备份与恢复
                </CardTitle>
                <CardDescription>备份当前 SQLite 数据库，或上传备份文件恢复系统数据</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">自动备份</p>
                    <p className="mt-2 text-2xl font-semibold">{backupConfig.autoEnabled ? '已开启' : '未开启'}</p>
                    <p className="mt-1 text-xs text-slate-500">间隔 {backupConfig.intervalHours} 小时</p>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">上次自动备份</p>
                    <p className="mt-2 text-sm font-medium">{formatBackupTime(backupConfig.lastBackupAt)}</p>
                    <p className="mt-1 break-all text-xs text-slate-500">{backupConfig.lastBackupFile || '-'}</p>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">备份目录</p>
                    <p className="mt-2 break-all text-xs font-medium text-slate-700">{backupConfig.backupDir || '-'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <div className="flex items-start gap-3">
                      <Download className="mt-1 h-5 w-5 text-blue-600" />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium">立即备份数据库</h3>
                        <p className="mt-1 text-sm text-slate-500">生成当前数据库快照，并下载安装到本机。</p>
                      </div>
                    </div>
                    <Button className="mt-4 w-full bg-blue-600 hover:bg-blue-700" onClick={handleDownloadDatabaseBackup}>
                      <Download className="mr-2 h-4 w-4" />
                      备份并下载
                    </Button>
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="flex items-start gap-3">
                      <UploadCloud className="mt-1 h-5 w-5 text-orange-600" />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium">恢复数据库</h3>
                        <p className="mt-1 text-sm text-slate-500">支持 .db/.sqlite/.sqlite3 文件，恢复前会先备份当前数据库。</p>
                      </div>
                    </div>
                    <div className="mt-4 space-y-3">
                      <Input
                        type="file"
                        accept=".db,.sqlite,.sqlite3"
                        onChange={(event) => setRestoreFile(event.target.files?.[0] || null)}
                      />
                      {restoreFile && (
                        <p className="break-all text-xs text-slate-500">已选择：{restoreFile.name}</p>
                      )}
                      <Button
                        variant="outline"
                        className="w-full border-orange-200 text-orange-700 hover:bg-orange-50"
                        onClick={handleRestoreDatabase}
                        disabled={restoreLoading}
                      >
                        <UploadCloud className="mr-2 h-4 w-4" />
                        {restoreLoading ? '恢复中...' : '上传并恢复'}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="font-medium">自动备份设置</h3>
                      <p className="mt-1 text-sm text-slate-500">打开后，系统设置页加载时会检查是否到达备份时间并自动生成备份。</p>
                    </div>
                    <Switch
                      checked={backupConfig.autoEnabled}
                      onCheckedChange={(checked) => setBackupConfig((current) => ({ ...current, autoEnabled: checked }))}
                    />
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr] md:items-end">
                    <div className="space-y-2">
                      <Label htmlFor="backupInterval">备份间隔（小时）</Label>
                      <Input
                        id="backupInterval"
                        type="number"
                        min={1}
                        max={720}
                        value={backupConfig.intervalHours}
                        onChange={(event) => setBackupConfig((current) => ({
                          ...current,
                          intervalHours: Math.max(1, Number(event.target.value || 24)),
                        }))}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={loadBackupInfo} disabled={backupLoading}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        刷新
                      </Button>
                      <Button onClick={handleSaveBackupConfig} disabled={backupSaving}>
                        <Save className="mr-2 h-4 w-4" />
                        {backupSaving ? '保存中...' : '保存自动备份'}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>备份文件列表</CardTitle>
                <CardDescription>系统已生成的数据库备份文件</CardDescription>
              </CardHeader>
              <CardContent>
                {backupLoading ? (
                  <div className="py-8 text-center text-sm text-slate-500">正在加载备份文件...</div>
                ) : backupFiles.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500">暂无备份文件</div>
                ) : (
                  <div className="space-y-2">
                    {backupFiles.map((file) => (
                      <div key={file.fileName} className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <p className="break-all text-sm font-medium">{file.fileName}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatBackupSize(file.size)} · {formatBackupTime(file.updatedAt)}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => handleDownloadBackupFile(file.fileName)}>
                          <Download className="mr-2 h-4 w-4" />
                          下载
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 系统信息 */}
        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle>系统信息</CardTitle>
              <CardDescription>查看系统运行状态和版本信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-500">系统版本</span>
                    <Badge>v1.0.0</Badge>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-500">数据库类型</span>
                    <span>SQLite</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-500">运行环境</span>
                    <Badge variant="outline">Development</Badge>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-500">服务器端口</span>
                    <span>5000</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-500">前端框架</span>
                    <span>Next.js 16</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-500">UI 组件库</span>
                    <span>shadcn/ui</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-500">样式框架</span>
                    <span>Tailwind CSS 4</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-500">编程语言</span>
                    <span>TypeScript 5</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-500">操作系统</span>
                    <span className="font-medium text-gray-800">{serverInfo?.platformName || '加载中...'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-500">系统版本</span>
                    <span>{serverInfo?.release || '加载中...'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-500">CPU 核心数</span>
                    <span>{serverInfo?.cpus || '加载中...'} 核</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-500">内存容量</span>
                    <span>{serverInfo?.totalMem || '加载中...'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-500">可用内存</span>
                    <span>{serverInfo?.freeMem || '加载中...'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-500">运行时长</span>
                    <span>{serverInfo?.uptime || '加载中...'}</span>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  💡 系统运行正常，所有服务已启动。如需帮助请联系管理员。
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default SettingsPage;
