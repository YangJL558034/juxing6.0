import { serialize, parse } from 'cookie';
import { SignJWT, jwtVerify } from 'jose';
import { query } from './database';
import bcrypt from 'bcryptjs';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'crm-platform-secret-key-2024'
);

export interface User {
  id: number;
  username: string;
  name: string;
  avatar?: string;
  role: string;
  department?: string;
}

interface AuthUserRow {
  id: number;
  username: string;
  password?: string;
  name: string;
  avatar?: string | null;
  role: string;
  department?: string | null;
}

function toAuthUser(user: AuthUserRow): User {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    avatar: user.avatar || undefined,
    role: user.role,
    department: user.department || undefined,
  };
}

// 验证用户登录
export async function login(username: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const user = query.findUserByUsername.get(username) as AuthUserRow | undefined;
    
    if (!user) {
      return { success: false, error: '用户名不存在' };
    }
    
    const isValid = user.password ? bcrypt.compareSync(password, user.password) : false;
    
    if (!isValid) {
      return { success: false, error: '密码错误' };
    }
    
    return {
      success: true,
      user: toAuthUser(user),
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: '登录失败，请稍后重试' };
  }
}

// 生成 JWT Token
export async function generateToken(user: User): Promise<string> {
  return await new SignJWT({ user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

// 验证 JWT Token
export async function verifyToken(token: string): Promise<User | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload.user as User;
  } catch (error) {
    return null;
  }
}

// 设置认证 Cookie
export function setAuthCookie(token: string): string {
  const isSecure = process.env.COZE_PROJECT_ENV === 'PROD';
  return serialize('auth_token', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: isSecure ? ('none' as const) : ('lax' as const),
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
}

// 清除认证 Cookie
export function clearAuthCookie(): string {
  const isSecure = process.env.COZE_PROJECT_ENV === 'PROD';
  return serialize('auth_token', '', {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'none' as const,
    maxAge: 0,
    path: '/',
    domain: undefined,
  });
}

// 从请求头获取 Token
export function getTokenFromHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const cookies = parse(cookieHeader);
  return cookies.auth_token || null;
}

// 获取当前用户
export async function getCurrentUser(cookieHeader: string | null): Promise<User | null> {
  const token = getTokenFromHeader(cookieHeader);
  if (!token) return null;
  const tokenUser = await verifyToken(token);
  if (!tokenUser) return null;

  const freshUser = query.findUserById.get(tokenUser.id) as AuthUserRow | undefined;
  return freshUser ? toAuthUser(freshUser) : tokenUser;
}

// 用户注册
export async function register(
  username: string,
  password: string,
  name: string,
  department?: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const existingUser = query.findUserByUsername.get(username);
    
    if (existingUser) {
      return { success: false, error: '用户名已存在' };
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const result = query.createUser.run(username, hashedPassword, name, 'user', department || null);
    
    return {
      success: true,
      user: {
        id: result.lastInsertRowid as number,
        username,
        name,
        role: 'user',
        department,
      },
    };
  } catch (error) {
    console.error('Register error:', error);
    return { success: false, error: '注册失败，请稍后重试' };
  }
}
