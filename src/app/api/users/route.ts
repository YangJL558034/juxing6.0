import { NextRequest, NextResponse } from 'next/server';
import { query, db } from '@/lib/database';
import bcrypt from 'bcryptjs';

interface UserRow {
  id: number;
  role: string;
}

interface PermissionRow {
  code: string;
  name: string;
  granted: number | null;
}

interface DepartmentRow {
  id: number;
  name: string;
}

function resolveDepartment(department: unknown) {
  const value = String(department || '').trim();
  if (!value) return { name: '', id: null as number | null };

  const row = db.prepare(`
    SELECT id, name
    FROM departments
    WHERE CAST(id AS TEXT) = ?
       OR name = ?
    LIMIT 1
  `).get(value, value) as DepartmentRow | undefined;

  return row ? { name: row.name, id: row.id } : { name: value, id: null as number | null };
}

// 获取所有用户
export async function GET(request: NextRequest) {
  try {
    const users = query.getAllUsersDetail.all() as Array<{ id: number; role: string }>;
    
    // 为每个用户获取权限
    const usersWithPermissions = users.map((user) => {
      const permissions = query.getUserPermissions.all(user.id) as PermissionRow[];
      const permissionList = permissions.map((p) => ({
        code: p.code,
        name: p.name,
        granted: p.granted === null ? (user.role === 'admin') : p.granted === 1 // 管理员默认有权限，普通用户需要有权限记录
      }));
      return { ...user, permissions: permissionList };
    });
    
    return NextResponse.json({ success: true, users: usersWithPermissions });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json({ success: false, error: '获取用户列表失败' }, { status: 500 });
  }
}

// 新增用户
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, name, role, department, email, position_id, manager_id } = body;
    
    if (!username || !password || !name) {
      return NextResponse.json({ success: false, error: '用户名、密码和姓名不能为空' }, { status: 400 });
    }
    
    // 检查用户名是否已存在
    const existingUser = db!.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return NextResponse.json({ success: false, error: '用户名已存在' }, { status: 400 });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const posId = position_id && position_id !== '0' ? parseInt(position_id) : null;
    const mgrId = manager_id && manager_id !== '0' ? parseInt(manager_id) : null;
    const resolvedDepartment = resolveDepartment(department);
    
    const result = db!.prepare(`
      INSERT INTO users (username, password, name, role, department, department_id, email, position_id, manager_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(username, hashedPassword, name, role || 'user', resolvedDepartment.name, resolvedDepartment.id, email || '', posId, mgrId);
    
    return NextResponse.json({ 
      success: true, 
      userId: result.lastInsertRowid,
      message: '用户创建成功'
    });
  } catch (error) {
    console.error('创建用户失败:', error);
    return NextResponse.json({ success: false, error: '创建用户失败' }, { status: 500 });
  }
}

// 更新用户
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, role, department, email, password, position_id, manager_id } = body;
    
    if (!id) {
      return NextResponse.json({ success: false, error: '用户ID不能为空' }, { status: 400 });
    }
    
    const posId = position_id && position_id !== '0' ? parseInt(position_id) : null;
    const mgrId = manager_id && manager_id !== '0' ? parseInt(manager_id) : null;
    const resolvedDepartment = resolveDepartment(department);
    
    if (password) {
      const hashedPassword = bcrypt.hashSync(password, 10);
      db!.prepare('UPDATE users SET name = ?, role = ?, department = ?, department_id = ?, email = ?, password = ?, position_id = ?, manager_id = ? WHERE id = ?')
        .run(name, role, resolvedDepartment.name, resolvedDepartment.id, email || '', hashedPassword, posId, mgrId, id);
    } else {
      db!.prepare('UPDATE users SET name = ?, role = ?, department = ?, department_id = ?, email = ?, position_id = ?, manager_id = ? WHERE id = ?')
        .run(name, role, resolvedDepartment.name, resolvedDepartment.id, email || '', posId, mgrId, id);
    }
    
    return NextResponse.json({ success: true, message: '用户更新成功' });
  } catch (error) {
    console.error('更新用户失败:', error);
    return NextResponse.json({ success: false, error: '更新用户失败' }, { status: 500 });
  }
}

// 删除用户
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ success: false, error: '用户ID不能为空' }, { status: 400 });
    }
    
    // 不能删除管理员
    const user = query.findUserById.get(parseInt(id)) as (UserRow & { username?: string }) | undefined;
    if (user && user.username === 'admin') {
      return NextResponse.json({ success: false, error: '不能删除管理员账号' }, { status: 400 });
    }
    
    // 删除用户权限关联
    db!.prepare('DELETE FROM user_permissions WHERE user_id = ?').run(parseInt(id));
    // 删除用户
    query.deleteUser.run(parseInt(id));
    
    return NextResponse.json({ success: true, message: '用户删除成功' });
  } catch (error) {
    console.error('删除用户失败:', error);
    return NextResponse.json({ success: false, error: '删除用户失败' }, { status: 500 });
  }
}
