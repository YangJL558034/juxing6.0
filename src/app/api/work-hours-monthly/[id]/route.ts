import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { hasPermission } from '@/lib/permission-check';

async function requireSalaryManager(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  if (!token) return { error: NextResponse.json({ success: false, error: '未登录' }, { status: 401 }) };
  const user = await verifyToken(token);
  if (!user) return { error: NextResponse.json({ success: false, error: '登录已过期' }, { status: 401 }) };
  if (!hasPermission(user, 'salary')) {
    return { error: NextResponse.json({ success: false, error: '无权管理工资工时' }, { status: 403 }) };
  }
  return { user };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSalaryManager(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    const body = await request.json();
    
    const {
      base_salary,
      is_full_attendance,
      id_card,
      bank_name,
      performance_allowance,
      other_subsidy_base,
      required_hours,
      full_attendance_hours,
      normal_hours,
      weekday_overtime,
      weekend_overtime,
      holiday_overtime_hours,
      night_shift_days,
      absent_days,
      personal_leave_hours,
      sick_leave_hours,
      late_early_minutes,
      late_early_count,
      sign_card_count,
      evaluation_coefficient,
      normal_pay,
      performance_pay,
      weekday_overtime_pay,
      weekend_overtime_pay,
      holiday_overtime_pay,
      sick_pay,
      living_subsidy,
      other_pay,
      seniority_award,
      full_attendance_award,
      position_subsidy,
      work_reward,
      spring_festival_subsidy,
      social_security_subsidy,
      deduct_social_security,
      deduct_loan,
      deduct_urgent,
      deduct_other,
      deduct_utilities,
      total_deduction,
      total_payable,
      actual_amount,
      bank_account,
      remark,
      // 办公室格式扣除项目
      housing_fund,
      social_insurance,
      social_pension_adj
    } = body;
    
    // 计算应扣合计
    let calculatedTotalDeduction = total_deduction;
    const isOfficeRecord = body.location === '办公室' || body.location === 'office';
    if (isOfficeRecord && (housing_fund !== undefined || social_insurance !== undefined)) {
      // 办公室格式：公积金 + 社会保险 + 社保养老调
      calculatedTotalDeduction = (housing_fund || 0) + (social_insurance || 0) + (social_pension_adj || 0);
    } else if (
      total_deduction === undefined &&
      (
        deduct_social_security !== undefined ||
        deduct_loan !== undefined ||
        deduct_urgent !== undefined ||
        deduct_other !== undefined ||
        deduct_utilities !== undefined
      )
    ) {
      // 车间格式：扣社保 + 借款 + 急辞扣款 + 其他 + 水电费
      calculatedTotalDeduction = (
        (deduct_social_security || 0) +
        (deduct_loan || 0) +
        (deduct_urgent || 0) +
        (deduct_other || 0) +
        (deduct_utilities || 0)
      );
    }
    
    const stmt = db.prepare(`
      UPDATE work_hours_monthly SET 
        base_salary = ?,
        is_full_attendance = ?,
        id_card = ?,
        bank_name = ?,
        performance_allowance = ?,
        other_subsidy_base = ?,
        required_hours = ?,
        full_attendance_hours = ?,
        normal_hours = ?,
        weekday_overtime = ?,
        weekend_overtime = ?,
        holiday_overtime_hours = ?,
        night_shift_days = ?,
        absent_days = ?,
        personal_leave_hours = ?,
        sick_leave_hours = ?,
        late_early_minutes = ?,
        late_early_count = ?,
        sign_card_count = ?,
        evaluation_coefficient = ?,
        normal_pay = ?,
        performance_pay = ?,
        weekday_overtime_pay = ?,
        weekend_overtime_pay = ?,
        holiday_overtime_pay = ?,
        sick_pay = ?,
        living_subsidy = ?,
        other_pay = ?,
        seniority_award = ?,
        full_attendance_award = ?,
        position_subsidy = ?,
        work_reward = ?,
        spring_festival_subsidy = ?,
        social_security_subsidy = ?,
        deduct_social_security = ?,
        deduct_loan = ?,
        deduct_urgent = ?,
        deduct_other = ?,
        deduct_utilities = ?,
        total_deduction = ?,
        total_payable = ?,
        actual_amount = ?,
        bank_account = ?,
        remark = ?,
        housing_fund = ?,
        social_insurance = ?,
        social_pension_adj = ?
      WHERE id = ?
    `);
    
    stmt.run(
      base_salary || 0,
      is_full_attendance || '',
      id_card || '',
      bank_name || '',
      performance_allowance || 0,
      other_subsidy_base || 0,
      required_hours || 0,
      full_attendance_hours || 0,
      normal_hours || 0,
      weekday_overtime || 0,
      weekend_overtime || 0,
      holiday_overtime_hours || 0,
      night_shift_days || 0,
      absent_days || 0,
      personal_leave_hours || 0,
      sick_leave_hours || 0,
      late_early_minutes || 0,
      late_early_count || 0,
      sign_card_count || 0,
      evaluation_coefficient || 1,
      normal_pay || 0,
      performance_pay || 0,
      weekday_overtime_pay || 0,
      weekend_overtime_pay || 0,
      holiday_overtime_pay || 0,
      sick_pay || 0,
      living_subsidy || 0,
      other_pay || 0,
      seniority_award || 0,
      full_attendance_award || 0,
      position_subsidy || 0,
      work_reward || 0,
      spring_festival_subsidy || 0,
      social_security_subsidy || 0,
      deduct_social_security || 0,
      deduct_loan || 0,
      deduct_urgent || 0,
      deduct_other || 0,
      deduct_utilities || 0,
      calculatedTotalDeduction || 0,
      total_payable || 0,
      actual_amount || 0,
      bank_account || '',
      remark || '',
      housing_fund || 0,
      social_insurance || 0,
      social_pension_adj || 0,
      parseInt(id)
    );
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新工资记录失败:', error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSalaryManager(request);
    if (auth.error) return auth.error;

    const { id } = await params;
    
    db.prepare('DELETE FROM work_hours_monthly WHERE id = ?').run(parseInt(id));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除工资记录失败:', error);
    return NextResponse.json({ error: '删除失败' }, { status: 500 });
  }
}
