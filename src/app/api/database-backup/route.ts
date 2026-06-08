import { NextRequest, NextResponse } from 'next/server';
import SQLite from 'better-sqlite3';
import { existsSync } from 'fs';
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { verifyToken } from '@/lib/auth';
import { db, getDatabaseFilePath } from '@/lib/database';

export const runtime = 'nodejs';

interface BackupSettingsRow {
  auto_enabled: number;
  interval_hours: number;
  last_backup_at: string | null;
  last_backup_file: string | null;
}

const backupDir = path.join(process.cwd(), 'data', 'backups');
const tempDir = path.join(backupDir, 'restore-temp');

async function requireBackupUser(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value || request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const user = await verifyToken(token);
  if (!user) return null;
  if (user.role === 'admin' || user.role === 'super_admin') return user;

  const allowed = db.prepare(`
    SELECT p.code
    FROM user_permissions up
    JOIN permissions p ON p.id = up.permission_id
    WHERE up.user_id = ? AND up.granted = 1 AND p.code IN ('settings', 'database-backup')
    LIMIT 1
  `).get(user.id);

  return allowed ? user : null;
}

function localDateTime() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

function fileTimestamp() {
  return localDateTime().replaceAll('-', '').replace(' ', '_').replaceAll(':', '');
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function sqlString(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function ensureBackupDir() {
  await mkdir(backupDir, { recursive: true });
  await mkdir(tempDir, { recursive: true });
}

function ensureSettingsRow() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS database_backup_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      auto_enabled INTEGER DEFAULT 0,
      interval_hours INTEGER DEFAULT 24,
      last_backup_at TEXT,
      last_backup_file TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS database_backup_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      backup_type TEXT DEFAULT 'manual',
      created_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))
    )
  `);
  const exists = db.prepare('SELECT id FROM database_backup_settings WHERE id = 1').get();
  if (!exists) {
    db.prepare('INSERT INTO database_backup_settings (id) VALUES (1)').run();
  }
}

function getSettings() {
  ensureSettingsRow();
  const row = db.prepare('SELECT * FROM database_backup_settings WHERE id = 1').get() as BackupSettingsRow | undefined;
  return {
    autoEnabled: row?.auto_enabled === 1,
    intervalHours: Number(row?.interval_hours || 24),
    lastBackupAt: row?.last_backup_at || null,
    lastBackupFile: row?.last_backup_file || null,
    backupDir,
  };
}

async function listBackups() {
  await ensureBackupDir();
  const entries = await readdir(backupDir, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && /\.(db|sqlite|sqlite3)$/i.test(entry.name))
      .map(async (entry) => {
        const filePath = path.join(backupDir, entry.name);
        const info = await stat(filePath);
        return {
          fileName: entry.name,
          size: info.size,
          createdAt: info.birthtime.toISOString(),
          updatedAt: info.mtime.toISOString(),
        };
      }),
  );
  return files.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function createBackup(type: 'manual' | 'auto' | 'before-restore') {
  ensureSettingsRow();
  await ensureBackupDir();
  db.pragma('wal_checkpoint(FULL)');

  const fileName = `crm_backup_${type}_${fileTimestamp()}.db`;
  const filePath = path.join(backupDir, fileName);
  await (db as unknown as { backup: (destinationFile: string) => Promise<void> }).backup(filePath);
  const info = await stat(filePath);
  const createdAt = localDateTime();

  db.prepare(`
    INSERT INTO database_backup_records (file_name, file_path, file_size, backup_type, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(fileName, filePath, info.size, type, createdAt);

  if (type === 'auto') {
    db.prepare(`
      UPDATE database_backup_settings
      SET last_backup_at = ?, last_backup_file = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(createdAt, fileName);
  }

  return { fileName, filePath, size: info.size, createdAt, type };
}

async function runDueAutoBackup() {
  const settings = getSettings();
  if (!settings.autoEnabled) return null;

  const lastTime = settings.lastBackupAt ? new Date(settings.lastBackupAt).getTime() : 0;
  const dueAt = lastTime + settings.intervalHours * 60 * 60 * 1000;
  if (!lastTime || Date.now() >= dueAt) {
    return createBackup('auto');
  }
  return null;
}

function validateBackupFile(filePath: string) {
  const testDb = new SQLite(filePath, { readonly: true, fileMustExist: true });
  try {
    const integrity = testDb.pragma('integrity_check') as Array<{ integrity_check: string }>;
    if (integrity[0]?.integrity_check !== 'ok') {
      throw new Error('数据库完整性校验失败');
    }
    const hasUsers = testDb.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'").get();
    if (!hasUsers) {
      throw new Error('备份文件不是本系统数据库');
    }
  } finally {
    testDb.close();
  }
}

function ensurePostRestoreSeeds() {
  ensureSettingsRow();
  const permissions = [
    { code: 'personnel', name: '人事管理', description: '管理员工入职登记和员工档案' },
    { code: 'administration', name: '行政管理', description: '管理员工住宿申请和入住办理' },
    { code: 'human-resources', name: '人力资源', description: '管理招聘职位和简历投递' },
    { code: 'database-backup', name: '数据库备份', description: '备份和恢复系统数据库' },
  ];
  for (const perm of permissions) {
    const exists = db.prepare('SELECT id FROM permissions WHERE code = ?').get(perm.code);
    if (!exists) {
      db.prepare('INSERT INTO permissions (code, name, description) VALUES (?, ?, ?)').run(perm.code, perm.name, perm.description);
    }
  }
}

function restoreDataFromBackup(filePath: string) {
  db.pragma('foreign_keys = OFF');
  let attached = false;
  let inTransaction = false;

  try {
    db.exec(`ATTACH DATABASE ${sqlString(filePath)} AS restore_db`);
    attached = true;
    db.exec('BEGIN IMMEDIATE');
    inTransaction = true;

    const mainTables = db.prepare(`
      SELECT name
      FROM main.sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    `).all() as Array<{ name: string }>;
    const restoreTables = db.prepare(`
      SELECT name, sql
      FROM restore_db.sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    `).all() as Array<{ name: string; sql: string | null }>;

    const mainSet = new Set(mainTables.map((table) => table.name));

    for (const table of mainTables) {
      db.exec(`DELETE FROM main.${quoteIdentifier(table.name)}`);
    }

    for (const table of restoreTables) {
      if (!mainSet.has(table.name) && table.sql) {
        db.exec(table.sql);
      }
      db.exec(`INSERT INTO main.${quoteIdentifier(table.name)} SELECT * FROM restore_db.${quoteIdentifier(table.name)}`);
    }

    try {
      db.exec('DELETE FROM main.sqlite_sequence');
      db.exec('INSERT INTO main.sqlite_sequence SELECT * FROM restore_db.sqlite_sequence');
    } catch {
      // Some databases do not have sqlite_sequence.
    }

    db.exec('COMMIT');
    inTransaction = false;
    db.exec('DETACH DATABASE restore_db');
    attached = false;
  } catch (error) {
    if (inTransaction) {
      db.exec('ROLLBACK');
    }
    if (attached) {
      try {
        db.exec('DETACH DATABASE restore_db');
      } catch {
        // Ignore detach failure after rollback.
      }
    }
    throw error;
  } finally {
    db.pragma('foreign_keys = ON');
  }

  ensurePostRestoreSeeds();
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireBackupUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '无权限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'download') {
      const backup = await createBackup('manual');
      const bytes = await readFile(backup.filePath);
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(backup.fileName)}`,
          'Cache-Control': 'no-store',
        },
      });
    }

    if (action === 'file') {
      const fileName = path.basename(searchParams.get('file') || '');
      if (!fileName) {
        return NextResponse.json({ success: false, error: '缺少备份文件名' }, { status: 400 });
      }
      const filePath = path.join(backupDir, fileName);
      if (!existsSync(filePath) || path.dirname(filePath) !== backupDir) {
        return NextResponse.json({ success: false, error: '备份文件不存在' }, { status: 404 });
      }
      const bytes = await readFile(filePath);
      return new NextResponse(new Uint8Array(bytes), {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const autoBackup = await runDueAutoBackup();
    return NextResponse.json({
      success: true,
      config: getSettings(),
      backups: await listBackups(),
      autoBackup,
      databasePath: getDatabaseFilePath(),
    });
  } catch (error) {
    console.error('Database backup GET error:', error);
    return NextResponse.json({ success: false, error: '获取数据库备份信息失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireBackupUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '无权限' }, { status: 403 });
    }

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      await ensureBackupDir();
      const formData = await request.formData();
      const file = formData.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ success: false, error: '请选择数据库备份文件' }, { status: 400 });
      }

      const ext = path.extname(file.name).toLowerCase();
      if (!['.db', '.sqlite', '.sqlite3'].includes(ext)) {
        return NextResponse.json({ success: false, error: '只支持 .db/.sqlite/.sqlite3 备份文件' }, { status: 400 });
      }
      if (file.size > 1024 * 1024 * 1024) {
        return NextResponse.json({ success: false, error: '备份文件不能超过 1GB' }, { status: 400 });
      }

      const tempPath = path.join(tempDir, `restore_${Date.now()}${ext}`);
      await writeFile(tempPath, Buffer.from(await file.arrayBuffer()));
      try {
        validateBackupFile(tempPath);
        const beforeRestore = await createBackup('before-restore');
        restoreDataFromBackup(tempPath);
        return NextResponse.json({
          success: true,
          message: '数据库恢复成功',
          beforeRestore,
          config: getSettings(),
          backups: await listBackups(),
        });
      } finally {
        await unlink(tempPath).catch(() => undefined);
      }
    }

    const body = await request.json();
    const action = String(body?.action || '');

    if (action === 'backup') {
      const backup = await createBackup('manual');
      return NextResponse.json({ success: true, backup, backups: await listBackups() });
    }

    if (action === 'save-config') {
      const autoEnabled = Boolean(body?.autoEnabled);
      const intervalHours = Math.max(1, Math.min(24 * 30, Number(body?.intervalHours || 24)));
      ensureSettingsRow();
      db.prepare(`
        UPDATE database_backup_settings
        SET auto_enabled = ?, interval_hours = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `).run(autoEnabled ? 1 : 0, intervalHours);
      const autoBackup = await runDueAutoBackup();
      return NextResponse.json({ success: true, config: getSettings(), backups: await listBackups(), autoBackup });
    }

    return NextResponse.json({ success: false, error: '未知操作' }, { status: 400 });
  } catch (error) {
    console.error('Database backup POST error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '数据库备份操作失败',
    }, { status: 500 });
  }
}
