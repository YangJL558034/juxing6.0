'use client';

import { useRef, useState, type ReactNode } from 'react';
import {
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  CircleHelp,
  ClipboardList,
  ContactRound,
  FilePenLine,
  HeartPulse,
  IdCard,
  Maximize2,
  Minimize2,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { defaultOnboardingData } from '@/lib/onboarding-records';
import { chinaToday } from '@/lib/china-time';
import { isCompleteIdCard, isCompleteMainlandMobile, normalizeIdCard, normalizeMobile } from '@/lib/identity-validation';
import { cn } from '@/lib/utils';
import type { OnboardingFormData } from '@/types/onboarding';

const steps = [
  { id: 1, label: '岗位' },
  { id: 2, label: '个人' },
  { id: 3, label: '联系人' },
  { id: 4, label: '健康' },
  { id: 5, label: '须知' },
  { id: 6, label: '承诺' },
  { id: 7, label: '签名' },
  { id: 8, label: '完成' },
];

const today = chinaToday;

function createInitialData(): OnboardingFormData {
  return {
    ...defaultOnboardingData,
    fillDate: today(),
    hireDate: today(),
    signatureDate: today(),
    contractTerm: '0',
    probationMonths: '0',
    probationSalary: '2200',
    wageMethod: '底薪和加班费',
  };
}

function Stepper({ activeStep }: { activeStep: number }) {
  return (
    <div className="grid grid-cols-8 gap-0.5 px-2 pb-2.5">
      {steps.map((step) => {
        const isActive = step.id === activeStep;
        const isDone = step.id < activeStep;
        return (
          <div key={step.id} className="min-w-0 text-center">
            <div
              className={cn(
                'mx-auto flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                isActive && 'bg-blue-600 text-white',
                isDone && 'bg-blue-100 text-blue-600',
                !isActive && !isDone && 'bg-slate-100 text-slate-400',
              )}
            >
              {isDone ? <Check className="h-3.5 w-3.5" /> : step.id}
            </div>
            <p className={cn('mt-1 truncate text-[10px] leading-none', isActive ? 'font-medium text-blue-600' : 'text-slate-400')}>
              {step.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function SectionCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-100 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-3">
        <span className="text-blue-600">{icon}</span>
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      </div>
      <div className="space-y-4 p-3">{children}</div>
    </section>
  );
}

function RequiredMark() {
  return <span className="ml-0.5 text-red-500">*</span>;
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = 'text',
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  type?: string;
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  maxLength?: number;
}) {
  return (
    <div className="grid grid-cols-[82px_minmax(0,1fr)] items-center gap-2">
      <label className="break-words text-sm font-medium leading-5 text-slate-800">
        {label}
        {required && <RequiredMark />}
      </label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        inputMode={inputMode}
        maxLength={maxLength}
        placeholder={placeholder}
        className="h-11 min-w-0 rounded-md border-slate-200 text-base"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required,
  placeholder = '请选择',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="grid grid-cols-[82px_minmax(0,1fr)] items-center gap-2">
      <label className="break-words text-sm font-medium leading-5 text-slate-800">
        {label}
        {required && <RequiredMark />}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-base text-slate-800 outline-none focus:border-blue-500"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function RadioGroup<T extends string>({
  label,
  value,
  onChange,
  options,
  required,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: T[];
  required?: boolean;
}) {
  return (
    <div className="grid grid-cols-[82px_minmax(0,1fr)] items-center gap-2">
      <label className="break-words text-sm font-medium leading-5 text-slate-800">
        {label}
        {required && <RequiredMark />}
      </label>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {options.map((option) => (
          <label key={option} className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              checked={value === option}
              onChange={() => onChange(option)}
              className="h-4 w-4 accent-blue-600"
            />
            {option}
          </label>
        ))}
      </div>
    </div>
  );
}

function CheckRow({ checked, onChange, children }: { checked: boolean; onChange?: (value: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex items-start gap-2 text-sm leading-6 text-slate-700">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onChange?.(Boolean(value))}
        className="mt-1 border-blue-600 data-[state=checked]:bg-blue-600"
      />
      <span>{children}</span>
    </label>
  );
}

type Updater = <K extends keyof OnboardingFormData>(key: K, value: OnboardingFormData[K]) => void;

function PositionStep({ data, update }: { data: OnboardingFormData; update: Updater }) {
  const selectedSource = data.recruitmentSource[0] || '';
  const selectSource = (source: string) => {
    update('recruitmentSource', [source]);
    if (source !== '其他') update('otherRecruitmentSource', '');
  };

  return (
    <>
      <SectionCard icon={<BriefcaseBusiness className="h-4 w-4" />} title="岗位信息">
        <TextField label="岗位" required value={data.position} onChange={(value) => update('position', value)} placeholder="请输入入职岗位" />
        <TextField label="部门" value={data.department} onChange={(value) => update('department', value)} placeholder="请输入部门" />
        <TextField label="填表日期" required type="date" value={data.fillDate} onChange={(value) => update('fillDate', value)} placeholder="请选择日期" />
      </SectionCard>

      <SectionCard icon={<ClipboardList className="h-4 w-4" />} title="招聘来源">
        <div className="grid grid-cols-2 gap-3">
          {['网络', '人才市场', '内部推荐', '其他'].map((item) => (
            <label key={item} className="flex items-center gap-3 text-sm text-slate-700">
              <input
                type="radio"
                name="recruitmentSource"
                checked={selectedSource === item}
                onChange={() => selectSource(item)}
                className="h-4 w-4 accent-blue-600"
              />
              {item}
            </label>
          ))}
        </div>
        <Input
          value={data.otherRecruitmentSource}
          onChange={(event) => update('otherRecruitmentSource', event.target.value)}
          placeholder={selectedSource === '其他' ? '可填写其他招聘来源' : '选择“其他”后填写来源'}
          disabled={selectedSource !== '其他'}
          className="h-11 rounded-md border-slate-200 text-base disabled:bg-slate-100 disabled:text-slate-400"
        />
      </SectionCard>
    </>
  );
}

function PersonalStep({ data, update }: { data: OnboardingFormData; update: Updater }) {
  return (
    <SectionCard icon={<UserRound className="h-4 w-4" />} title="个人基本信息">
      <TextField label="姓名" required value={data.name} onChange={(value) => update('name', value)} placeholder="请输入姓名" />
      <RadioGroup label="性别" required value={data.gender} onChange={(value) => update('gender', value)} options={['男', '女']} />
      <TextField label="民族" required value={data.ethnicity} onChange={(value) => update('ethnicity', value)} placeholder="请输入民族" />
      <TextField label="籍贯" required value={data.nativePlace} onChange={(value) => update('nativePlace', value)} placeholder="请输入籍贯" />
      <SelectField label="学历" required value={data.education} onChange={(value) => update('education', value)} options={['初中', '高中/中专', '大专', '本科', '研究生及以上']} />
      <SelectField label="政治面貌" required value={data.politicalStatus} onChange={(value) => update('politicalStatus', value)} options={['群众', '共青团员', '中共党员', '其他']} />
      <RadioGroup
        label="婚姻状况"
        required
        value={data.maritalStatus}
        onChange={(value) => update('maritalStatus', value)}
        options={['已婚有子女', '已婚无子女', '未婚', '其他']}
      />
      <TextField label="身份证号" required value={data.idCard} onChange={(value) => update('idCard', normalizeIdCard(value))} placeholder="请输入身份证号" inputMode="text" maxLength={18} />
      <TextField label="联系电话" required value={data.phone} onChange={(value) => update('phone', normalizeMobile(value))} placeholder="请输入联系电话" inputMode="tel" maxLength={11} />
      <TextField label="微信/QQ" value={data.wechat} onChange={(value) => update('wechat', value)} placeholder="请输入微信号或QQ号" />
      <TextField label="邮箱" value={data.email} onChange={(value) => update('email', value)} placeholder="请输入邮箱" />
    </SectionCard>
  );
}

function EmergencyStep({ data, update }: { data: OnboardingFormData; update: Updater }) {
  const contact = data.emergencyContacts[0] || { name: '', relation: '', address: '', phone: '' };
  const updateContact = (key: keyof typeof contact, value: string) => update('emergencyContacts', [{ ...contact, [key]: value }]);

  return (
    <SectionCard icon={<ContactRound className="h-4 w-4" />} title="紧急联系人">
      <p className="text-xs text-slate-500">紧急联系人（请填写常居住的亲友）</p>
      <div className="rounded-lg bg-slate-50">
        <div className="border-b border-slate-100 px-3 py-3">
          <span className="text-sm font-medium text-slate-800">联系人 1</span>
        </div>
        <div className="space-y-4 p-2.5">
          <TextField label="姓名" required value={contact.name} onChange={(value) => updateContact('name', value)} placeholder="请输入联系人姓名" />
          <TextField label="关系" required value={contact.relation} onChange={(value) => updateContact('relation', value)} placeholder="请输入关系" />
          <TextField label="单位地址" required value={contact.address} onChange={(value) => updateContact('address', value)} placeholder="请输入工作单位和现住址" />
          <TextField label="联系电话" required value={contact.phone} onChange={(value) => updateContact('phone', normalizeMobile(value))} placeholder="请输入联系电话" inputMode="tel" maxLength={11} />
        </div>
      </div>
    </SectionCard>
  );
}

function HealthQuestion({
  title,
  value,
  note,
  onValue,
  onNote,
}: {
  title: string;
  value: '无' | '有';
  note: string;
  onValue: (value: '无' | '有') => void;
  onNote: (value: string) => void;
}) {
  return (
    <div className="space-y-3 border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
      <p className="text-sm font-medium leading-6 text-slate-800">
        {title}
        <RequiredMark />
      </p>
      <div className="flex flex-wrap gap-x-12 gap-y-3">
        {(['无', '有'] as const).map((option) => (
          <label key={option} className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              checked={value === option}
              onChange={() => {
                onValue(option);
                if (option === '无') onNote('');
              }}
              className="h-4 w-4 accent-blue-600"
            />
            {option}
          </label>
        ))}
      </div>
      <Input
        value={value === '无' ? '' : note}
        onChange={(event) => onNote(event.target.value)}
        placeholder={value === '无' ? '选择“有”后填写说明' : '请说明'}
        disabled={value === '无'}
        className="h-11 rounded-md border-slate-200 text-base disabled:bg-slate-100 disabled:text-slate-400"
      />
    </div>
  );
}

function HealthStep({ data, update }: { data: OnboardingFormData; update: Updater }) {
  return (
    <SectionCard icon={<HeartPulse className="h-4 w-4" />} title="健康信息">
      <RadioGroup label="利手" required value={data.dominantHand} onChange={(value) => update('dominantHand', value)} options={['右', '左']} />
      <HealthQuestion title="是否有重大疾病或家族病史" value={data.majorDisease} note={data.majorDiseaseNote} onValue={(value) => update('majorDisease', value)} onNote={(value) => update('majorDiseaseNote', value)} />
      <HealthQuestion title="是否曾被认定工作或患有残疾人证明" value={data.disabilityProof} note={data.disabilityProofNote} onValue={(value) => update('disabilityProof', value)} onNote={(value) => update('disabilityProofNote', value)} />
      <HealthQuestion title="是否从事过特别繁重体力劳动及有毒有害工种" value={data.heavyWork} note={data.heavyWorkNote} onValue={(value) => update('heavyWork', value)} onNote={(value) => update('heavyWorkNote', value)} />
      <HealthQuestion title="是否有职业病或慢性影响工作的疾病或怀孕" value={data.occupationalDisease} note={data.occupationalDiseaseNote} onValue={(value) => update('occupationalDisease', value)} onNote={(value) => update('occupationalDiseaseNote', value)} />
    </SectionCard>
  );
}

function NoticeStep({ data, update }: { data: OnboardingFormData; update: Updater }) {
  return (
    <SectionCard icon={<IdCard className="h-4 w-4" />} title="入厂须知">
      <TextField label="入厂日期" required type="date" value={data.hireDate} onChange={(value) => update('hireDate', value)} placeholder="请选择日期" />
      <TextField label="合同期限" required value={data.contractTerm} onChange={(value) => update('contractTerm', value)} placeholder="请输入合同期限" />
      <div className="space-y-4 rounded-lg border border-slate-100 p-3">
        <TextField label="试用期" required value={data.probationMonths} onChange={(value) => update('probationMonths', value)} placeholder="月数" />
        <TextField label="试用工资(底薪)" required value={data.probationSalary} onChange={(value) => update('probationSalary', value)} placeholder="金额" />
      </div>
      <TextField label="入职岗位" required value={data.position} onChange={(value) => update('position', value)} placeholder="请输入入职岗位" />
      <TextField label="机器约定" value={data.machineAgreement} onChange={(value) => update('machineAgreement', value)} placeholder="请填写使用机器约定" />
      <SelectField
        label="工资方式"
        required
        value={data.wageMethod}
        onChange={(value) => update('wageMethod', value)}
        options={['底薪和加班费', '月薪', '计件工资', '计时工资', '底薪加提成', '其他']}
      />
      <CheckRow checked onChange={() => {}}>超过工必须提交书面辞工书，经领导审批后一个月之后方可离开工作岗位。</CheckRow>
      <CheckRow checked onChange={() => {}}>认真做好本职工作，服从主管的安排。</CheckRow>
    </SectionCard>
  );
}

function PromiseStep({ data, update }: { data: OnboardingFormData; update: Updater }) {
  return (
    <SectionCard icon={<ClipboardList className="h-4 w-4" />} title="入职承诺">
      <div className="space-y-4 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
        <p>1. 本人在填写本《入职登记表》时，已保证自己符合国家法定的劳动年龄和劳动用工规定，且与其他任何用人单位、机构、组织、团体无劳动关系。</p>
        <p>2. 本人在填写《入职登记表》时，用人单位已如实告知工作内容、工作地点、工作条件、职业危害、安全生产状况、劳动报酬以及本人所需了解的所有情况。</p>
        <p>3. 本人如有传染病、精神病或其他可能影响在用人单位工作的病史，本人应以书面形式向用人单位说明。</p>
        <p>4. 本人承诺已与原单位解除劳动关系，且无仍然生效的保密协议、竞业限制协议。</p>
        <p>5. 本人填写的《入职登记表》所有信息真实有效，如有任何虚假，用人单位可按照严重违纪解除劳动合同。</p>
      </div>
      <CheckRow checked={data.promiseConfirmed} onChange={(value) => update('promiseConfirmed', value)}>
        我已认真阅读并同意以上承诺内容
      </CheckRow>
    </SectionCard>
  );
}

function SignatureStep({
  data,
  update,
  canvasRef,
  hasSignature,
  setHasSignature,
}: {
  data: OnboardingFormData;
  update: Updater;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  hasSignature: boolean;
  setHasSignature: (value: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const openExpanded = () => {
    window.alert('请把手机横过来签字，签完点“收起”。');
    setExpanded(true);
  };

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const point = getPoint(event);
    if (!canvas || !point) return;
    canvas.setPointerCapture(event.pointerId);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.buttons !== 1 && event.pointerType === 'mouse') return;
    const point = getPoint(event);
    const ctx = canvasRef.current?.getContext('2d');
    if (!point || !ctx) return;
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    setHasSignature(true);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  return (
    <SectionCard icon={<FilePenLine className="h-4 w-4" />} title="电子签名">
      <p className="text-sm leading-6 text-slate-600">
        本人已充分了解上述资料的真实性提交方式并订立劳动合同的前提条件，本人自愿遵守以上承诺内容。
      </p>
      <div className={expanded ? 'fixed inset-0 z-50 flex flex-col bg-white p-4' : 'space-y-2'}>
        <div className={expanded ? 'flex min-h-0 flex-1 flex-col' : 'space-y-2'}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <label className="text-sm font-medium text-slate-800">
                {expanded ? '横屏签字' : '签名'}
                <RequiredMark />
              </label>
              {expanded && <p className="text-xs text-slate-500">请横屏签字，签完点收起。</p>}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => {
              if (expanded) {
                setExpanded(false);
              } else {
                openExpanded();
              }
            }}>
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {expanded ? '收起' : '放大签字'}
            </Button>
          </div>
          <canvas
            ref={canvasRef}
            width={720}
            height={260}
            onPointerDown={start}
            onPointerMove={draw}
            className={`${expanded ? 'h-[52dvh] min-h-[240px]' : 'h-32'} w-full touch-none rounded-lg border border-dashed border-slate-300 bg-white`}
          />
          <button type="button" onClick={clear} className="mx-auto flex items-center gap-1 text-sm text-blue-600">
            <CircleHelp className="h-4 w-4" />
            清除{hasSignature ? '' : '签名'}
          </button>
        </div>
      </div>
      <TextField label="日期" required type="date" value={data.signatureDate} onChange={(value) => update('signatureDate', value)} placeholder="请选择日期" />
    </SectionCard>
  );
}

function SuccessStep({ recordId, onRestart }: { recordId: number | null; onRestart: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-10 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-50">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/25">
          <CheckCircle2 className="h-10 w-10" />
        </div>
      </div>
      <h1 className="mt-8 text-xl font-semibold text-slate-950">入职登记提交成功！</h1>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        感谢您的填写，我们会尽快审核。审核结果将通过您填写的联系方式通知您。
      </p>
      {recordId && <p className="mt-4 text-xs text-slate-400">登记编号：{recordId}</p>}
      <div className="mt-16 w-full space-y-3">
        <Button type="button" variant="outline" className="h-12 w-full border-blue-200 text-blue-600" onClick={onRestart}>
          返回首页
        </Button>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [recordId, setRecordId] = useState<number | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [data, setData] = useState<OnboardingFormData>(() => createInitialData());

  const update: Updater = (key, value) => setData((current) => ({ ...current, [key]: value }));
  const isSuccess = step === 8;

  const validateCurrent = () => {
    if (step === 1 && !data.position.trim()) return '请填写入职岗位';
    if (step === 2) {
      if (!data.name.trim() || !data.idCard.trim() || !data.phone.trim()) return '请填写姓名、身份证号和联系电话';
      if (!isCompleteIdCard(data.idCard)) return '身份证号必须填写完整，请输入18位身份证号';
      if (!isCompleteMainlandMobile(data.phone)) return '联系电话必须填写完整，请输入11位手机号';
    }
    if (step === 3) {
      const contact = data.emergencyContacts[0];
      if (!contact?.name.trim() || !contact?.phone.trim()) return '请填写紧急联系人姓名和电话';
      if (!isCompleteMainlandMobile(contact.phone)) return '紧急联系人电话必须填写完整，请输入11位手机号';
    }
    if (step === 5 && (!data.hireDate || !data.wageMethod.trim())) return '请填写入职日期和工资计算方式';
    if (step === 6 && !data.promiseConfirmed) return '请勾选入职承诺确认';
    return '';
  };

  const goNext = () => {
    const error = validateCurrent();
    if (error) {
      alert(error);
      return;
    }
    setStep((current) => Math.min(7, current + 1));
  };
  const goPrev = () => setStep((current) => Math.max(1, current - 1));

  const restartForm = () => {
    setData(createInitialData());
    setRecordId(null);
    setHasSignature(false);
    setSubmitting(false);
    setStep(1);
  };

  const handleSubmit = async () => {
    if (!hasSignature) {
      alert('请完成电子签名');
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;

    const payload: OnboardingFormData = {
      ...data,
      signatureDataUrl: canvas.toDataURL('image/png'),
      signatureDate: data.signatureDate || today(),
    };

    setSubmitting(true);
    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload }),
      });
      const result = await response.json();
      if (!result.success) {
        alert(result.error || '提交失败');
        return;
      }
      setRecordId(result.id || null);
      setStep(8);
    } catch (error) {
      console.error('Submit onboarding error:', error);
      alert('提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-dvh overflow-x-hidden bg-slate-100 text-slate-950">
      <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-white shadow-sm">
        {!isSuccess && (
          <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur">
            <div className="relative flex h-11 items-center justify-center px-3">
              <h1 className="text-base font-semibold">入职登记</h1>
            </div>
            <Stepper activeStep={step} />
          </header>
        )}

        {isSuccess ? (
          <SuccessStep recordId={recordId} onRestart={restartForm} />
        ) : (
          <>
            <div className="space-y-4 bg-slate-50 px-3 py-3 pb-[calc(8rem+env(safe-area-inset-bottom))]">
              {step === 1 && <PositionStep data={data} update={update} />}
              {step === 2 && <PersonalStep data={data} update={update} />}
              {step === 3 && <EmergencyStep data={data} update={update} />}
              {step === 4 && <HealthStep data={data} update={update} />}
              {step === 5 && <NoticeStep data={data} update={update} />}
              {step === 6 && <PromiseStep data={data} update={update} />}
              {step === 7 && <SignatureStep data={data} update={update} canvasRef={canvasRef} hasSignature={hasSignature} setHasSignature={setHasSignature} />}
            </div>
            <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] border-t border-slate-100 bg-white px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              {step === 7 ? (
                <div className="space-y-3">
                  <Button onClick={handleSubmit} disabled={submitting} className="mobile-submit-button h-12 w-full bg-blue-600 hover:bg-blue-700">
                    {submitting ? '提交中...' : '提交'}
                  </Button>
                  <Button onClick={goPrev} variant="outline" className="h-12 w-full border-blue-200 text-blue-600">
                    上一步
                  </Button>
                </div>
              ) : step === 1 ? (
                <Button type="button" onClick={goNext} className="h-12 w-full bg-blue-600 hover:bg-blue-700">
                  下一步
                </Button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Button type="button" variant="outline" onClick={goPrev} className="h-12 border-blue-200 text-blue-600">
                    上一步
                  </Button>
                  <Button type="button" onClick={goNext} className="h-12 bg-blue-600 hover:bg-blue-700">
                    下一步
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
