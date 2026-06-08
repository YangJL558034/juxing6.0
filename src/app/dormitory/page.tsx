'use client';

import { useState } from 'react';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Home,
  IdCard,
  Loader2,
  Phone,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { defaultDormitoryData } from '@/lib/dormitory-records';
import { cn } from '@/lib/utils';
import type { DormitoryApplicationData } from '@/types/dormitory';

const today = () => new Date().toISOString().slice(0, 10);

function createInitialData(): DormitoryApplicationData {
  return {
    ...defaultDormitoryData,
    expectedCheckInDate: today(),
    submittedDate: today(),
  };
}

function Field({
  label,
  required,
  icon,
  children,
}: {
  label: string;
  required?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
        <span className="text-blue-600">{icon}</span>
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function DormitoryApplicationPage() {
  const [data, setData] = useState<DormitoryApplicationData>(createInitialData);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const updateField = <K extends keyof DormitoryApplicationData>(field: K, value: DormitoryApplicationData[K]) => {
    setData((current) => ({ ...current, [field]: value }));
  };

  const submit = async () => {
    if (!data.name.trim()) {
      alert('请填写姓名');
      return;
    }
    if (!data.phone.trim()) {
      alert('请填写手机号');
      return;
    }
    if (!data.department.trim()) {
      alert('请填写所在部门');
      return;
    }
    if (!data.position.trim()) {
      alert('请填写职位');
      return;
    }
    if (!data.idCard.trim()) {
      alert('请填写身份证号');
      return;
    }
    if (!data.expectedCheckInDate) {
      alert('请选择安排入住日期');
      return;
    }
    if (!data.reason.trim()) {
      alert('请填写入住原因');
      return;
    }
    if (!data.agreedToRules) {
      alert('请确认遵守宿舍管理条款');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/dormitory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      const result = await response.json().catch(() => ({})) as { success?: boolean; error?: string };

      if (!response.ok || !result.success) {
        throw new Error(result.error || '提交住宿申请失败');
      }

      setSubmitted(true);
    } catch (error) {
      alert(error instanceof Error ? error.message : '提交住宿申请失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <main className="min-h-dvh bg-slate-50 px-4 py-6 text-slate-950">
        <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-[430px] flex-col justify-center">
          <div className="rounded-lg border border-slate-100 bg-white px-5 py-10 text-center shadow-sm">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
              <CheckCircle2 className="h-11 w-11 text-blue-600" />
            </div>
            <h1 className="mt-6 text-xl font-semibold text-slate-950">住宿申请提交成功</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              行政审核通过后会安排入住，办理结果请等待行政通知。
            </p>
            <Button
              className="mt-8 w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                setData(createInitialData());
                setSubmitted(false);
              }}
            >
              重新填写
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-slate-50 pb-[calc(88px+env(safe-area-inset-bottom))] text-slate-950">
      <div className="mx-auto w-full max-w-[430px]">
        <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 px-4 py-4 backdrop-blur">
          <div className="flex items-center justify-center gap-2">
            <Home className="h-5 w-5 text-blue-600" />
            <h1 className="text-base font-semibold">员工住宿舍申请</h1>
          </div>
        </header>

        <div className="p-4">
          <section className="rounded-lg border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <ClipboardCheck className="h-5 w-5 text-blue-600" />
              <h2 className="text-base font-semibold">入住申请信息</h2>
            </div>
            <div className="space-y-4 p-4">
              <Field label="申请人" required icon={<UserRound className="h-4 w-4" />}>
                <Input value={data.name} onChange={(event) => updateField('name', event.target.value)} placeholder="请输入姓名" className="h-11 text-base" />
              </Field>
              <Field label="手机号" required icon={<Phone className="h-4 w-4" />}>
                <Input value={data.phone} onChange={(event) => updateField('phone', event.target.value)} placeholder="请输入手机号" inputMode="tel" className="h-11 text-base" />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="所在部门" required icon={<Building2 className="h-4 w-4" />}>
                  <Input value={data.department} onChange={(event) => updateField('department', event.target.value)} placeholder="请输入部门" className="h-11 text-base" />
                </Field>
                <Field label="职位" required icon={<UserRound className="h-4 w-4" />}>
                  <Input value={data.position} onChange={(event) => updateField('position', event.target.value)} placeholder="请输入职位" className="h-11 text-base" />
                </Field>
              </div>
              <Field label="身份证号" required icon={<IdCard className="h-4 w-4" />}>
                <Input value={data.idCard} onChange={(event) => updateField('idCard', event.target.value)} placeholder="请输入身份证号" className="h-11 text-base" />
              </Field>
              <Field label="安排入住日期" required icon={<CalendarDays className="h-4 w-4" />}>
                <Input type="date" value={data.expectedCheckInDate} onChange={(event) => updateField('expectedCheckInDate', event.target.value)} className="h-11 text-base" />
              </Field>
              <Field label="入住原因" required icon={<Home className="h-4 w-4" />}>
                <Textarea
                  value={data.reason}
                  onChange={(event) => updateField('reason', event.target.value)}
                  placeholder="请填写申请住宿原因"
                  className="min-h-28 text-base"
                />
              </Field>
            </div>
          </section>

          <section className="mt-4 rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">住宿条款确认</h2>
            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              <p>1. 自觉遵守《公司员工宿舍管理办法》和员工宿舍区有关管理制度，不私自调换宿舍和床位。</p>
              <p>2. 自觉维护宿舍区域公共卫生，爱护公物，损害公物自觉赔偿，自觉遵守消防安全。</p>
              <p>3. 公司只提供住宿，安全问题自己承担，水电费用个人承担。</p>
              <p>4. 退宿舍应归还钥匙，未归还钥匙罚款 50 元。</p>
            </div>
            <label className="mt-4 flex items-start gap-2 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
              <Checkbox
                checked={data.agreedToRules}
                onCheckedChange={(checked) => updateField('agreedToRules', checked === true)}
                className="mt-0.5"
              />
              <span className={cn(data.agreedToRules && 'text-blue-700')}>本人自愿填写申请表，并愿意遵守以上条款。</span>
            </label>
          </section>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-100 bg-white/95 px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="mx-auto w-full max-w-[430px]">
          <Button className="h-12 w-full bg-blue-600 text-base hover:bg-blue-700" onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            提交申请
          </Button>
        </div>
      </div>
    </main>
  );
}
