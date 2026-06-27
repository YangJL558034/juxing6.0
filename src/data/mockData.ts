import {
  MetricCard,
  SummaryCard,
  ChartData,
  TodoItem,
  CustomerItem,
  TaskItem,
  LeaderboardItem,
} from '@/types/crm';

export const metricCards: MetricCard[][] = [
  [
    { title: '新增客户(人)', value: 231, change: -56 },
    { title: '新增联系人(人)', value: 102, change: -76 },
    { title: '新增商机(个)', value: 123, change: 5 },
    { title: '新增合同(份)', value: 24, change: -81 },
  ],
  [
    { title: '合同金额(元)', value: 2310320, change: 56 },
    { title: '回款金额(元)', value: 1235820, change: -22 },
    { title: '新增跟进记录(条)', value: 427130, change: -15 },
    { title: '新增跟进记录(条)', value: 231, change: -81 },
  ],
];

export const summaryCards: SummaryCard[] = [
  {
    title: '客户汇总',
    items: [
      { label: '新增客户', value: '23个' },
      { label: '转成交客户', value: '0个' },
    ],
  },
  {
    title: '跟进汇总',
    items: [
      { label: '跟进客户', value: '8个' },
      { label: '新增未跟进客户', value: '23个' },
    ],
  },
  {
    title: '商机汇总',
    items: [
      { label: '新增商机', value: '8个' },
      { label: '商机总金额', value: '122,400元' },
      { label: '赢单商机', value: '1个' },
    ],
  },
  {
    title: '合同汇总',
    items: [
      { label: '合同签订', value: '1份' },
      { label: '合同金额', value: '62,400元' },
    ],
  },
  {
    title: '回款金额',
    items: [
      { label: '回款金额', value: '0.00元' },
      { label: '预计回款金额', value: '62,400元' },
    ],
  },
];

export const contractChartData: ChartData[] = [
  { name: '1月', 金额: 4000, 当月目标金额: 2400 },
  { name: '2月', 金额: 3000, 当月目标金额: 1398 },
  { name: '3月', 金额: 2000, 当月目标金额: 9800 },
  { name: '4月', 金额: 2780, 当月目标金额: 3908 },
  { name: '5月', 金额: 1890, 当月目标金额: 4800 },
  { name: '6月', 金额: 2390, 当月目标金额: 3800 },
  { name: '7月', 金额: 3490, 当月目标金额: 4300 },
  { name: '8月', 金额: 5000, 当月目标金额: 4500 },
  { name: '9月', 金额: 8000, 当月目标金额: 6000 },
  { name: '10月', 金额: 10022, 当月目标金额: 8000 },
  { name: '11月', 金额: 10922, 当月目标金额: 9000 },
  { name: '12月', 金额: 15022, 当月目标金额: 12000 },
];

export const funnelChartData: ChartData[] = [
  { name: '线索', value: 120 },
  { name: '意向', value: 80 },
  { name: '报价', value: 50 },
  { name: '成交', value: 25 },
];

export const reminderChartData: ChartData[] = [
  { name: '7天未联系', value: 15 },
  { name: '15天未联系', value: 10 },
  { name: '30天未联系', value: 8 },
  { name: '3个月未联系', value: 5 },
  { name: '6个月未联系', value: 3 },
  { name: '逾期未联系', value: 2 },
];

export const leaderboardData: LeaderboardItem[] = [
  { rank: 1, name: '张明', amount: 156000, target: 200000, progress: 78 },
  { rank: 2, name: '李华', amount: 142000, target: 180000, progress: 79 },
  { rank: 3, name: '王芳', amount: 128000, target: 180000, progress: 71 },
  { rank: 4, name: '刘伟', amount: 115000, target: 200000, progress: 58 },
  { rank: 5, name: '陈静', amount: 98000, target: 150000, progress: 65 },
];

export const todoCategories = [
  '今日需联系线索',
  '今日需联系商机',
  '分配给我的线索',
  '分配给我的客户',
  '待进入公海的客户',
  '待审核合同',
  '待审核回款',
  '待回款提醒',
  '即将到期的合同',
  '待回访合同',
  '待审核发票',
];

export const todoList: TodoItem[] = [
  {
    id: '1',
    name: '北京科技有限公司',
    industry: '互联网',
    level: '优质客户',
    source: '搜索引擎',
    phone: '138-0012-3456',
    address: '北京市朝阳区建国路88号',
    remark: '有意向购买企业版套餐',
    lastFollowUp: '已电话沟通，需求详细',
    creator: '张明',
    department: '销售一部',
    createTime: '2024-01-15 10:30',
    lastFollowUpTime: '2024-01-20 14:20',
    owner: '李华',
  },
  {
    id: '2',
    name: '上海贸易集团',
    industry: '贸易',
    level: '无效客户',
    source: '客户介绍',
    phone: '139-8876-5432',
    address: '上海市浦东新区世纪大道100号',
    remark: '暂无需求',
    lastFollowUp: '电话无人接听',
    creator: '王芳',
    department: '销售二部',
    createTime: '2024-01-10 09:15',
    lastFollowUpTime: '2024-01-18 16:45',
    owner: '刘伟',
  },
  {
    id: '3',
    name: '深圳创新科技',
    industry: '科技',
    level: '优质客户',
    source: '注册用户',
    phone: '136-7654-3210',
    address: '深圳市南山区科技园南路88号',
    remark: '关注SaaS服务',
    lastFollowUp: '在线会议演示完成',
    creator: '李华',
    department: '销售一部',
    createTime: '2024-01-12 11:00',
    lastFollowUpTime: '2024-01-19 10:30',
    owner: '张明',
  },
  {
    id: '4',
    name: '广州制造业公司',
    industry: '制造业',
    level: '优质客户',
    source: '展会资源',
    phone: '135-6789-0123',
    address: '广州市天河区珠江新城花城大道',
    remark: '需要定制化解决方案',
    lastFollowUp: '等待技术方案',
    creator: '刘伟',
    department: '销售三部',
    createTime: '2024-01-08 14:20',
    lastFollowUpTime: '2024-01-17 15:10',
    owner: '陈静',
  },
  {
    id: '5',
    name: '成都软件园',
    industry: '软件',
    level: '无效客户',
    source: '促销活动',
    phone: '137-2345-6789',
    address: '成都市高新区天府大道中段666号',
    remark: '预算不足',
    lastFollowUp: '已发送报价方案',
    creator: '陈静',
    department: '销售二部',
    createTime: '2024-01-05 16:00',
    lastFollowUpTime: '2024-01-16 11:25',
    owner: '王芳',
  },
];

export const customerList: CustomerItem[] = [
  {
    id: '1',
    name: '杭州网络科技',
    level: '优质客户',
    source: '搜索引擎',
    submitTime: '2024-01-20',
    followDuration: '15天',
    tags: ['有车', '有社保', '良好信贷'],
    status: '未成交',
    phone: '138-1234-5678',
    address: '杭州市西湖区文三路120号',
    creator: '张明',
    department: '销售一部',
    owner: '李华',
  },
  {
    id: '2',
    name: '武汉物流公司',
    level: '普通客户',
    source: '客户介绍',
    submitTime: '2024-01-18',
    followDuration: '8天',
    tags: ['无车', '无社保'],
    status: '跟进中',
    phone: '139-8765-4321',
    address: '武汉市江汉区解放大道888号',
    creator: '王芳',
    department: '销售二部',
    owner: '刘伟',
  },
  {
    id: '3',
    name: '南京智能制造',
    level: '优质客户',
    source: '注册用户',
    submitTime: '2024-01-15',
    followDuration: '22天',
    tags: ['有车', '有社保', '良好信贷', '高收入'],
    status: '已成交',
    phone: '136-5555-8888',
    address: '南京市鼓楼区中山北路200号',
    creator: '李华',
    department: '销售一部',
    owner: '张明',
  },
  {
    id: '4',
    name: '西安旅游集团',
    level: '普通客户',
    source: '展会资源',
    submitTime: '2024-01-12',
    followDuration: '30天',
    tags: ['有车', '有社保'],
    status: '未成交',
    phone: '135-9999-0000',
    address: '西安市雁塔区雁展路600号',
    creator: '刘伟',
    department: '销售三部',
    owner: '陈静',
  },
  {
    id: '5',
    name: '天津港务集团',
    level: 'VIP客户',
    source: '促销活动',
    submitTime: '2024-01-10',
    followDuration: '45天',
    tags: ['有车', '有社保', '良好信贷', '企业客户'],
    status: '已成交',
    phone: '137-1111-2222',
    address: '天津市滨海新区港口路888号',
    creator: '陈静',
    department: '销售二部',
    owner: '王芳',
  },
];

export const taskList: TaskItem[] = [
  {
    id: '1',
    name: '跟进北京科技客户',
    tags: ['重要', '客户'],
    priority: '高',
    deadline: '2024-01-25',
    status: '进行中',
    owner: '李华',
  },
  {
    id: '2',
    name: '准备产品演示',
    tags: ['常规'],
    priority: '中',
    deadline: '2024-01-28',
    status: '进行中',
    owner: '张明',
  },
  {
    id: '3',
    name: '签订合同文件',
    tags: ['紧急', '合同'],
    priority: '高',
    deadline: '2024-01-22',
    status: '已逾期',
    owner: '王芳',
  },
  {
    id: '4',
    name: '客户回访计划',
    tags: ['重要'],
    priority: '低',
    deadline: '2024-02-01',
    status: '进行中',
    owner: '刘伟',
  },
  {
    id: '5',
    name: '月度销售报告',
    tags: ['常规', '报告'],
    priority: '中',
    deadline: '2024-01-30',
    status: '进行中',
    owner: '陈静',
  },
];

export interface NavMenuItem {
  key: string;
  label: string;
  icon: string;
  children?: NavMenuItem[];
}

export const navMenuItems: NavMenuItem[] = [
  { key: 'dashboard', label: '仪表盘', icon: 'LayoutDashboard' },
  
  { 
    key: 'customer', 
    label: '客户管理', 
    icon: 'Users',
    children: [
      { key: 'leads', label: '线索', icon: 'Users' },
      { key: 'customers', label: '客户', icon: 'Building2' },
      { key: 'contacts', label: '联系人', icon: 'Contact' },
      { key: 'followup', label: '回访', icon: 'MessageSquare' },
    ]
  },
  
  { 
    key: 'business', 
    label: '业务管理', 
    icon: 'FileText',
    children: [
      { key: 'contracts', label: '合同', icon: 'FileText' },
      { key: 'invoices', label: '发票', icon: 'Receipt' },
      { key: 'products', label: '产品', icon: 'Package' },
    ]
  },
  
  { 
    key: 'workflow', 
    label: '审批流程', 
    icon: 'CheckCircle',
    children: [
      { key: 'purchase-requests', label: '请购单管理', icon: 'Package' },
      { key: 'expense-claims', label: '费用报销', icon: 'Receipt' },
      { key: 'approval-center', label: '审批中心', icon: 'CheckCircle' },
      { key: 'finance-review', label: '财务终审', icon: 'Landmark' },
    ]
  },
  
  { 
    key: 'organization', 
    label: '组织人事', 
    icon: 'Building',
    children: [
      {
        key: 'personnel',
        label: '人事管理',
        icon: 'Users',
        children: [
          { key: 'personnel-onboarding', label: '入职登记', icon: 'Users' },
          { key: 'personnel-social-security', label: '社保管理', icon: 'Shield' },
          { key: 'personnel-social-security-purchase', label: '购买社保', icon: 'Shield' },
          { key: 'personnel-regularization', label: '转正申请', icon: 'CheckCircle' },
          { key: 'personnel-work-certificate', label: '工作证明', icon: 'FileText' },
          { key: 'personnel-resignation', label: '离职申请', icon: 'FileText' },
          { key: 'personnel-resignation-certificate', label: '离职证明', icon: 'FileText' },
          { key: 'personnel-labor-termination', label: '解除劳动合同', icon: 'ClipboardList' },
          { key: 'personnel-leave-request', label: '请假申请', icon: 'Calendar' },
          { key: 'human-resources', label: '人力资源', icon: 'Briefcase' },
        ],
      },
      {
        key: 'administration',
        label: '行政管理',
        icon: 'Home',
        children: [
          { key: 'administration-dormitory', label: '住宿申请', icon: 'Home' },
          { key: 'administration-rooms', label: '房号管理', icon: 'Home' },
          { key: 'administration-beds', label: '床号管理', icon: 'Home' },
          { key: 'administration-water-meter', label: '水表记录', icon: 'Home' },
        ],
      },
      {
        key: 'assets',
        label: '资产管理',
        icon: 'Folder',
        children: [
          { key: 'assets-overview', label: '资产总览', icon: 'Folder' },
        ],
      },
      {
        key: 'salary',
        label: '工资工时查询',
        icon: 'Clock',
        children: [
          { key: 'salary-employees', label: '员工管理', icon: 'Users' },
          { key: 'salary-detail', label: '工资明细', icon: 'DollarSign' },
          { key: 'salary-workhours', label: '工时记录', icon: 'Clock' },
          { key: 'salary-attendance', label: '打卡记录', icon: 'CheckCircle' },
        ],
      },
    ]
  },
  
  { 
    key: 'system', 
    label: '系统管理', 
    icon: 'Settings',
    children: [
      { key: 'usermanage', label: '用户管理', icon: 'UserCog' },
      { key: 'taskmanage', label: '任务管理', icon: 'ClipboardList' },
      { key: 'todo', label: '待办事项', icon: 'CheckSquare' },
      { key: 'distribution', label: '分销达人', icon: 'Share2' },
      { key: 'finance', label: '财务明细', icon: 'DollarSign' },
      { key: 'generate', label: '生成管理', icon: 'FileText' },
      { key: 'ai-chat', label: 'AI对话', icon: 'Bot' },
      { key: 'smtp', label: '邮件配置', icon: 'Mail' },
      { key: 'operation-logs', label: '操作日志', icon: 'FileText' },
      { key: 'settings', label: '系统设置', icon: 'Settings' },
    ]
  },
  
  { 
    key: 'notification-center', 
    label: '发送通知中心', 
    icon: 'Bell',
  },
];

export const topNavItems = [
  { key: 'customers', label: '客户管理' },
  { key: 'tasks', label: '任务/审批' },
  { key: 'logs', label: '日志' },
  { key: 'contacts', label: '通讯录' },
  { key: 'projects', label: '项目管理' },
  { key: 'bi', label: '商业智能' },
  { key: 'calendar', label: '日历' },
];
