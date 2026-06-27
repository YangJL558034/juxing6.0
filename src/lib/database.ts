import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { chinaNowSql, formatChinaDateTime } from './china-time';

// 检测是否在构建环境中 - 只在 Next.js 构建阶段返回 true
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

// 数据库文件路径
const getDbPath = () => process.env.COZE_PROJECT_ENV === 'PROD' 
  ? '/tmp/crm.db'  // 生产环境使用 /tmp
  : path.join(/* turbopackIgnore: true */ process.cwd(), 'data', 'crm.db');

export function getDatabaseFilePath() {
  return getDbPath();
}

// 延迟初始化数据库
let _db: Database.Database | null = null;
let _isInitialized = false;
const backupSchedulerKey = '__crmDatabaseBackupSchedulerStarted';

function backupLocalDateTime() {
  return chinaNowSql();
}

async function runScheduledDatabaseBackup(dbInstance: Database.Database) {
  try {
    const settings = dbInstance.prepare('SELECT * FROM database_backup_settings WHERE id = 1').get() as {
      auto_enabled: number;
      interval_hours: number;
      last_backup_at: string | null;
    } | undefined;

    if (!settings?.auto_enabled) return;

    const lastTime = settings.last_backup_at ? new Date(settings.last_backup_at).getTime() : 0;
    const intervalMs = Math.max(1, Number(settings.interval_hours || 24)) * 60 * 60 * 1000;
    if (lastTime && Date.now() < lastTime + intervalMs) return;

    const backupDir = path.join(/* turbopackIgnore: true */ process.cwd(), 'data', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    dbInstance.pragma('wal_checkpoint(FULL)');
    const backupTime = backupLocalDateTime();
    const fileName = `crm_backup_auto_${backupTime.replaceAll('-', '').replace(' ', '_').replaceAll(':', '')}.db`;
    const filePath = path.join(backupDir, fileName);
    await dbInstance.backup(filePath);
    const info = fs.statSync(filePath);

    dbInstance.prepare(`
      INSERT INTO database_backup_records (file_name, file_path, file_size, backup_type, created_at)
      VALUES (?, ?, ?, 'auto', ?)
    `).run(fileName, filePath, info.size, backupTime);
    dbInstance.prepare(`
      UPDATE database_backup_settings
      SET last_backup_at = ?, last_backup_file = ?, updated_at = datetime('now', '+8 hours')
      WHERE id = 1
    `).run(backupTime, fileName);
  } catch (error) {
    console.error('Scheduled database backup failed:', error);
  }
}

function startDatabaseBackupScheduler(dbInstance: Database.Database) {
  const globalState = globalThis as unknown as Record<string, boolean>;
  if (globalState[backupSchedulerKey]) return;
  globalState[backupSchedulerKey] = true;

  setTimeout(() => {
    void runScheduledDatabaseBackup(dbInstance);
  }, 5000);
  setInterval(() => {
    void runScheduledDatabaseBackup(dbInstance);
  }, 30 * 60 * 1000);
}

const chinaTimestampSql = "datetime('now', '+8 hours')";
const timestampColumns = [
  'created_at',
  'updated_at',
  'changed_at',
  'reviewed_at',
  'checked_in_at',
  'checked_out_at',
  'signature_time',
  'read_at',
  'used_at',
  'completed_at',
];

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function ensureColumns(
  dbInstance: Database.Database,
  tableName: string,
  columns: { name: string; definition: string }[],
) {
  const existingColumns = dbInstance.prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`).all() as { name: string }[];
  const existingNames = new Set(existingColumns.map(col => col.name));
  const quotedTableName = quoteIdentifier(tableName);

  for (const column of columns) {
    if (existingNames.has(column.name)) continue;
    dbInstance.exec(`ALTER TABLE ${quotedTableName} ADD COLUMN ${quoteIdentifier(column.name)} ${column.definition}`);
    existingNames.add(column.name);
  }
}

function ensureChinaTimeTriggers(dbInstance: Database.Database) {
  const tables = dbInstance.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
  `).all() as { name: string }[];

  for (const table of tables) {
    const columns = dbInstance.prepare(`PRAGMA table_info(${quoteIdentifier(table.name)})`).all() as { name: string; pk: number }[];
    const hasId = columns.some(col => col.name === 'id' && col.pk > 0);
    if (!hasId) continue;

    const existingTimestampColumns = timestampColumns.filter(col => columns.some(column => column.name === col));
    if (existingTimestampColumns.length === 0) continue;

    const tableName = quoteIdentifier(table.name);
    dbInstance.exec(`DROP TRIGGER IF EXISTS ${quoteIdentifier(`trg_${table.name}_china_time_insert`)}`);
    dbInstance.exec(`DROP TRIGGER IF EXISTS ${quoteIdentifier(`trg_${table.name}_china_time_update`)}`);

    const insertAssignments = existingTimestampColumns.map(col => {
      const columnName = quoteIdentifier(col);
      return `${columnName} = CASE WHEN NEW.${columnName} IS NULL OR NEW.${columnName} = CURRENT_TIMESTAMP THEN ${chinaTimestampSql} ELSE NEW.${columnName} END`;
    });
    const updateAssignments = existingTimestampColumns
      .filter(col => col !== 'created_at')
      .map(col => {
        const columnName = quoteIdentifier(col);
        if (col === 'updated_at') {
          return `${columnName} = ${chinaTimestampSql}`;
        }
        return `${columnName} = CASE WHEN NEW.${columnName} = CURRENT_TIMESTAMP THEN ${chinaTimestampSql} ELSE NEW.${columnName} END`;
      });

    if (insertAssignments.length > 0) {
      dbInstance.exec(`
        CREATE TRIGGER IF NOT EXISTS ${quoteIdentifier(`trg_${table.name}_china_time_insert`)}
        AFTER INSERT ON ${tableName}
        FOR EACH ROW
        BEGIN
          UPDATE ${tableName}
          SET ${insertAssignments.join(', ')}
          WHERE id = NEW.id;
        END;
      `);
    }

    if (updateAssignments.length > 0) {
      dbInstance.exec(`
        CREATE TRIGGER IF NOT EXISTS ${quoteIdentifier(`trg_${table.name}_china_time_update`)}
        AFTER UPDATE ON ${tableName}
        FOR EACH ROW
        BEGIN
          UPDATE ${tableName}
          SET ${updateAssignments.join(', ')}
          WHERE id = NEW.id;
        END;
      `);
    }
  }
}

function ensureOperationLogsChinaTimeMigration(dbInstance: Database.Database) {
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS app_time_migrations (
      key TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT (datetime('now', '+8 hours'))
    )
  `);

  const key = 'operation_logs_utc_to_china_20260610';
  const migrated = dbInstance.prepare('SELECT key FROM app_time_migrations WHERE key = ?').get(key);
  if (migrated) return;

  const row = dbInstance
    .prepare('SELECT MAX(id) as max_id FROM operation_logs WHERE created_at IS NOT NULL AND created_at <= CURRENT_TIMESTAMP')
    .get() as { max_id: number | null } | undefined;

  if (row?.max_id) {
    dbInstance
      .prepare("UPDATE operation_logs SET created_at = datetime(created_at, '+8 hours') WHERE id <= ?")
      .run(row.max_id);
  }

  dbInstance.prepare('INSERT INTO app_time_migrations (key) VALUES (?)').run(key);
}

function ensureEmployeeSalaryLocationMigration(dbInstance: Database.Database) {
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS app_time_migrations (
      key TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT (datetime('now', '+8 hours'))
    )
  `);

  const key = 'employees_salary_location_repair_20260610';
  const migrated = dbInstance.prepare('SELECT key FROM app_time_migrations WHERE key = ?').get(key);
  if (migrated) return;

  dbInstance.exec(`
    UPDATE employees
    SET location = CAST(X'E58A9EE585ACE5AEA4' AS TEXT)
    WHERE location IS NULL
       OR TRIM(location) = ''
       OR location = '???'
       OR location NOT IN (
         CAST(X'E58A9EE585ACE5AEA4' AS TEXT),
         'office',
         CAST(X'E8BDA6E997B4' AS TEXT),
         'workshop'
       );

    UPDATE employees
    SET status = CAST(X'E7A6BBE8818C' AS TEXT),
        resign_date = COALESCE(resign_date, date('now', '+8 hours'))
    WHERE EXISTS (
      SELECT 1
      FROM onboarding_records o
      WHERE o.status = CAST(X'E5B7B2E7A6BBE8818C' AS TEXT)
        AND (
          (o.employee_id IS NOT NULL AND o.employee_id = employees.id)
          OR (o.id_card IS NOT NULL AND o.id_card <> '' AND employees.id_card IS NOT NULL AND employees.id_card <> '' AND o.id_card = employees.id_card)
          OR o.name = employees.name
        )
    );
  `);

  dbInstance.prepare('INSERT INTO app_time_migrations (key) VALUES (?)').run(key);
}

function ensureProductionEmployeesWorkshopMigration(dbInstance: Database.Database) {
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS app_time_migrations (
      key TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT (datetime('now', '+8 hours'))
    )
  `);

  const key = 'employees_production_department_to_workshop_20260610';
  const migrated = dbInstance.prepare('SELECT key FROM app_time_migrations WHERE key = ?').get(key);
  if (migrated) return;

  dbInstance.exec(`
    UPDATE employees
    SET location = CAST(X'E8BDA6E997B4' AS TEXT)
    WHERE REPLACE(REPLACE(COALESCE(department, ''), ' ', ''), CHAR(9), '') = CAST(X'E7949FE4BAA7E983A8' AS TEXT)
       OR REPLACE(REPLACE(COALESCE(department, ''), ' ', ''), CHAR(9), '') LIKE CAST(X'E7949FE4BAA7' AS TEXT) || '%'
       OR REPLACE(REPLACE(COALESCE(department, ''), ' ', ''), CHAR(9), '') LIKE '%' || CAST(X'E8BDA6E997B4' AS TEXT) || '%';
  `);

  dbInstance.prepare('INSERT INTO app_time_migrations (key) VALUES (?)').run(key);
}

function getDb(): Database.Database {
  // 构建时返回空对象，避免数据库初始化
  if (isBuildTime) {
    return {} as Database.Database;
  }
  
  if (!_db) {
    const dbPath = getDbPath();
    
    // 确保数据目录存在
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    _db = new Database(dbPath);
    _db.pragma('journal_mode = WAL');
    
    if (!_isInitialized) {
      initDatabase(_db);
      _isInitialized = true;
    }
  }
  return _db;
}

// 创建一个 mock statement 对象用于构建时
const mockStatement = {
  run: () => ({ changes: 0, lastInsertRowid: 0 }),
  get: () => null,
  all: () => [],
  pluck: () => mockStatement,
  bind: () => mockStatement,
};

// 导出一个 getter 而不是直接导出 db
export const db = new Proxy({} as Database.Database, {
  get(target, prop) {
    // 构建时返回 mock 对象
    if (isBuildTime) {
      if (prop === 'prepare') {
        return () => mockStatement;
      }
      if (prop === 'exec') {
        return () => {};
      }
      if (prop === 'pragma') {
        return () => {};
      }
      if (typeof prop === 'string') {
        return () => mockStatement;
      }
    }
    
    const actualDb = getDb();
    const value = (actualDb as unknown as Record<string, unknown>)[prop as string];
    if (typeof value === 'function') {
      return value.bind(actualDb);
    }
    return value;
  }
});

// 初始化数据库表
export function initDatabase(dbInstance: Database.Database) {
  // 临时禁用外键约束，避免表创建顺序问题
  dbInstance.pragma('foreign_keys = OFF');
  
  // 用户表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar TEXT,
      role TEXT DEFAULT 'user',
      department TEXT,
      department_id INTEGER,
      position_id INTEGER,
      manager_id INTEGER,
      phone TEXT,
      email TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (position_id) REFERENCES positions(id),
      FOREIGN KEY (manager_id) REFERENCES users(id)
    )
  `);

  // 部门表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER,
      manager TEXT,
      manager_id INTEGER,
      manager_name TEXT,
      description TEXT,
      status TEXT DEFAULT '正常运营',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      FOREIGN KEY (parent_id) REFERENCES departments(id)
    );

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT,
      name TEXT NOT NULL,
      id_card TEXT,
      phone TEXT,
      department TEXT,
      position TEXT,
      base_salary REAL DEFAULT 0,
      status TEXT DEFAULT '在职',
      location TEXT DEFAULT '车间',
      resign_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name)
    );

    CREATE TABLE IF NOT EXISTS employee_work_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      shift TEXT DEFAULT '白班',
      check_in_time TEXT,
      check_out_time TEXT,
      work_hours REAL DEFAULT 0,
      overtime_hours REAL DEFAULT 0,
      status TEXT DEFAULT '正常',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS onboarding_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT DEFAULT '待审核',
      name TEXT NOT NULL,
      gender TEXT,
      phone TEXT,
      id_card TEXT,
      position TEXT,
      department TEXT,
      hire_date TEXT,
      recruitment_source TEXT,
      data_json TEXT NOT NULL,
      reviewer_name TEXT,
      hr_opinion TEXT,
      reviewed_at DATETIME,
      employee_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS regularization_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT DEFAULT '待处理',
      applicant_name TEXT NOT NULL,
      department TEXT,
      position TEXT,
      hire_date TEXT,
      regularization_date TEXT,
      data_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      deleted_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS work_certificate_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT DEFAULT '待审核',
      name TEXT NOT NULL,
      gender TEXT,
      id_card TEXT,
      phone TEXT,
      department TEXT,
      position TEXT,
      hire_date TEXT,
      purpose TEXT,
      data_json TEXT NOT NULL,
      reviewer_name TEXT,
      reviewed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      deleted_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS labor_contract_termination_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_name TEXT NOT NULL,
      honorific TEXT,
      termination_date TEXT,
      reason TEXT,
      procedure_deadline TEXT,
      company_name TEXT,
      notice_date TEXT,
      data_json TEXT NOT NULL,
      created_by_name TEXT,
      exported_at DATETIME,
      printed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      deleted_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS resignation_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT DEFAULT '待审核',
      name TEXT NOT NULL,
      employee_no TEXT,
      department TEXT,
      id_card TEXT,
      position TEXT,
      hire_date TEXT,
      contract_end_date TEXT,
      apply_date TEXT,
      resignation_date TEXT,
      handover_date TEXT,
      resignation_type TEXT,
      data_json TEXT NOT NULL,
      reviewer_name TEXT,
      reviewed_at DATETIME,
      exported_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      deleted_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS resignation_certificate_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT DEFAULT '待审核',
      certificate_type TEXT DEFAULT 'personal',
      employee_name TEXT NOT NULL,
      id_card TEXT,
      phone TEXT,
      email TEXT,
      honorific TEXT,
      department TEXT,
      position TEXT,
      hire_date TEXT,
      leave_date TEXT,
      issue_date TEXT,
      company_name TEXT,
      receipt_date TEXT,
      data_json TEXT NOT NULL,
      created_by_name TEXT,
      reviewer_name TEXT,
      reviewed_at DATETIME,
      review_remark TEXT,
      stamped_file_name TEXT,
      stamped_file_mime TEXT,
      stamped_file_data TEXT,
      completed_at DATETIME,
      email_sent_at DATETIME,
      email_error TEXT,
      certificate_exported_at DATETIME,
      receipt_exported_at DATETIME,
      certificate_printed_at DATETIME,
      receipt_printed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      deleted_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS social_security_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_type TEXT NOT NULL,
      status TEXT DEFAULT '待审核',
      name TEXT NOT NULL,
      id_card TEXT,
      phone TEXT,
      department TEXT,
      position TEXT,
      hire_date TEXT,
      application_date TEXT,
      data_json TEXT NOT NULL,
      reviewer_name TEXT,
      reviewed_at DATETIME,
      exported_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      deleted_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS social_security_purchase_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      contract_status TEXT,
      department TEXT,
      employee_name TEXT NOT NULL,
      domicile TEXT,
      id_card TEXT,
      phone TEXT,
      bank_card TEXT,
      gender TEXT,
      birth_date TEXT,
      education TEXT,
      insurance_status TEXT,
      contract_count TEXT,
      contract_start_date TEXT,
      contract_term_years TEXT,
      contract_end_date TEXT,
      due_days TEXT,
      employment_status TEXT,
      resignation_date TEXT,
      confidentiality_agreement TEXT,
      probation_salary TEXT,
      remarks TEXT,
      data_json TEXT NOT NULL,
      exported_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      deleted_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS leave_request_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT DEFAULT '待审核',
      employee_id INTEGER,
      employee_name TEXT NOT NULL,
      id_card TEXT,
      phone TEXT,
      department TEXT,
      position TEXT,
      leave_date TEXT NOT NULL,
      leave_start_date TEXT,
      leave_end_date TEXT,
      duration TEXT DEFAULT 'full',
      half_day_period TEXT,
      leave_type TEXT,
      reason TEXT,
      applicant_signature_data_url TEXT,
      created_by_name TEXT,
      reviewer_name TEXT,
      reviewed_at DATETIME,
      exported_at DATETIME,
      printed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      deleted_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS dormitory_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT DEFAULT '待审核',
      name TEXT NOT NULL,
      phone TEXT,
      department TEXT,
      position TEXT,
      id_card TEXT,
      expected_check_in_date TEXT,
      reason TEXT,
      data_json TEXT NOT NULL,
      reviewer_name TEXT,
      review_opinion TEXT,
      reviewed_at DATETIME,
      room_no TEXT,
      bed_no TEXT,
      room_bed TEXT,
      key_issued TEXT,
      handler_name TEXT,
      checked_in_at DATETIME,
      checkout_apply_date TEXT,
      move_out_date TEXT,
      checkout_reason TEXT,
      key_returned TEXT,
      checkout_handler_name TEXT,
      checked_out_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS dormitory_rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_no TEXT NOT NULL UNIQUE,
      capacity INTEGER DEFAULT 0,
      room_type TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS dormitory_beds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      bed_no TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(room_id, bed_no),
      FOREIGN KEY (room_id) REFERENCES dormitory_rooms(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS dormitory_room_change_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dormitory_record_id INTEGER NOT NULL,
      employee_name TEXT NOT NULL,
      from_room_no TEXT,
      from_bed_no TEXT,
      from_room_bed TEXT,
      to_room_no TEXT NOT NULL,
      to_bed_no TEXT NOT NULL,
      to_room_bed TEXT NOT NULL,
      handler_name TEXT NOT NULL,
      reason TEXT,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (dormitory_record_id) REFERENCES dormitory_records(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS dormitory_delete_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dormitory_record_id INTEGER NOT NULL,
      employee_name TEXT NOT NULL,
      phone TEXT,
      department TEXT,
      position TEXT,
      room_no TEXT,
      bed_no TEXT,
      room_bed TEXT,
      checked_in_at DATETIME,
      checked_out_at DATETIME,
      deleted_by_user_id INTEGER,
      deleted_by_name TEXT NOT NULL,
      deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      record_snapshot TEXT,
      created_at DATETIME DEFAULT (datetime('now', '+8 hours'))
    );

    CREATE TABLE IF NOT EXISTS water_meter_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_no TEXT NOT NULL,
      reading_date TEXT NOT NULL,
      previous_reading REAL,
      previous_reading_text TEXT,
      current_reading REAL NOT NULL,
      current_reading_text TEXT,
      usage_amount REAL,
      unit_price REAL,
      fee_amount REAL,
      recorder_name TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS item_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      unit TEXT DEFAULT '个',
      quantity INTEGER DEFAULT 0,
      unit_price REAL DEFAULT 0,
      remark TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now', '+8 hours')),
      updated_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS item_claim_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      applicant_id INTEGER,
      applicant_name TEXT NOT NULL,
      department TEXT DEFAULT '',
      quantity INTEGER DEFAULT 1,
      reason TEXT DEFAULT '',
      status TEXT DEFAULT '待审核',
      reviewer_name TEXT DEFAULT '',
      reviewed_at DATETIME,
      created_at DATETIME DEFAULT (datetime('now', '+8 hours')),
      updated_at DATETIME,
      deleted_at DATETIME,
      FOREIGN KEY (item_id) REFERENCES item_inventory(id)
    );

    CREATE TABLE IF NOT EXISTS recruitment_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      department TEXT,
      location TEXT,
      salary_range TEXT,
      headcount INTEGER DEFAULT 1,
      deadline TEXT,
      requirements TEXT,
      responsibilities TEXT,
      benefits TEXT,
      status TEXT DEFAULT '招聘中',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS recruitment_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      job_title TEXT NOT NULL,
      applicant_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      education TEXT,
      experience_years TEXT,
      current_company TEXT,
      expected_salary TEXT,
      message TEXT,
      resume_url TEXT NOT NULL,
      resume_file_name TEXT NOT NULL,
      resume_file_size INTEGER DEFAULT 0,
      status TEXT DEFAULT '新投递',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      FOREIGN KEY (job_id) REFERENCES recruitment_jobs(id)
    );

    CREATE TABLE IF NOT EXISTS employee_salary_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      base_salary REAL DEFAULT 0,
      overtime_hours REAL DEFAULT 0,
      overtime_pay REAL DEFAULT 0,
      bonus REAL DEFAULT 0,
      deduction REAL DEFAULT 0,
      actual_salary REAL DEFAULT 0,
      status TEXT DEFAULT '待发放',
      signature TEXT,
      signature_time DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    );

    CREATE TABLE IF NOT EXISTS work_hours_monthly (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      total_days INTEGER DEFAULT 0,
      work_hours REAL DEFAULT 0,
      overtime_hours REAL DEFAULT 0,
      weekend_overtime REAL DEFAULT 0,
      details TEXT,
      signature TEXT,
      signature_time DATETIME,
      employee_name TEXT,
      year INTEGER,
      month_num INTEGER,
      normal_hours REAL DEFAULT 0,
      weekday_overtime REAL DEFAULT 0,
      base_salary REAL DEFAULT 0,
      normal_pay REAL DEFAULT 0,
      weekday_overtime_pay REAL DEFAULT 0,
      weekend_overtime_pay REAL DEFAULT 0,
      total_payable REAL DEFAULT 0,
      deduction REAL DEFAULT 0,
      actual_amount REAL DEFAULT 0,
      location TEXT DEFAULT '办公室',
      -- 完整工资条字段
      is_full_attendance TEXT DEFAULT '',
      id_card TEXT DEFAULT '',
      bank_account TEXT DEFAULT '',
      bank_name TEXT DEFAULT '',
      performance_allowance REAL DEFAULT 0,
      other_subsidy_base REAL DEFAULT 0,
      required_hours REAL DEFAULT 176,
      full_attendance_hours REAL DEFAULT 176,
      holiday_overtime_hours REAL DEFAULT 0,
      night_shift_days REAL DEFAULT 0,
      absent_days REAL DEFAULT 0,
      personal_leave_hours REAL DEFAULT 0,
      sick_leave_hours REAL DEFAULT 0,
      late_early_minutes REAL DEFAULT 0,
      late_early_count REAL DEFAULT 0,
      sign_card_count REAL DEFAULT 0,
      evaluation_coefficient REAL DEFAULT 1,
      performance_pay REAL DEFAULT 0,
      holiday_overtime_pay REAL DEFAULT 0,
      sick_pay REAL DEFAULT 0,
      living_subsidy REAL DEFAULT 0,
      other_pay REAL DEFAULT 0,
      seniority_award REAL DEFAULT 0,
      full_attendance_award REAL DEFAULT 0,
      position_subsidy REAL DEFAULT 0,
      work_reward REAL DEFAULT 0,
      spring_festival_subsidy REAL DEFAULT 0,
      social_security_subsidy REAL DEFAULT 0,
      deduct_social_security REAL DEFAULT 0,
      deduct_loan REAL DEFAULT 0,
      deduct_urgent REAL DEFAULT 0,
      deduct_other REAL DEFAULT 0,
      deduct_utilities REAL DEFAULT 0,
      total_deduction REAL DEFAULT 0,
      remark TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id)
    )
  `);

  try {
    ensureColumns(dbInstance, 'employees', [
      { name: 'employee_id', definition: 'TEXT' },
      { name: 'name', definition: 'TEXT' },
      { name: 'id_card', definition: 'TEXT' },
      { name: 'phone', definition: 'TEXT' },
      { name: 'department', definition: 'TEXT' },
      { name: 'position', definition: 'TEXT' },
      { name: 'base_salary', definition: 'REAL DEFAULT 0' },
      { name: 'status', definition: 'TEXT' },
      { name: 'location', definition: 'TEXT' },
      { name: 'resign_date', definition: 'TEXT' },
      { name: 'created_at', definition: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { name: 'hire_date', definition: 'TEXT' },
      { name: 'department_id', definition: 'INTEGER' },
      { name: 'position_id', definition: 'INTEGER' },
      { name: 'manager_id', definition: 'INTEGER' },
      { name: 'user_id', definition: 'INTEGER' },
    ]);

    ensureColumns(dbInstance, 'onboarding_records', [
      { name: 'status', definition: 'TEXT' },
      { name: 'name', definition: 'TEXT' },
      { name: 'created_at', definition: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
    ]);
    ensureColumns(dbInstance, 'regularization_records', [
      { name: 'status', definition: 'TEXT' },
      { name: 'applicant_name', definition: 'TEXT' },
      { name: 'created_at', definition: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
    ]);
    ensureColumns(dbInstance, 'work_certificate_records', [
      { name: 'status', definition: 'TEXT' },
      { name: 'name', definition: 'TEXT' },
      { name: 'created_at', definition: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
    ]);
    ensureColumns(dbInstance, 'labor_contract_termination_records', [
      { name: 'employee_name', definition: 'TEXT' },
      { name: 'created_at', definition: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { name: 'deleted_at', definition: 'DATETIME' },
    ]);
    ensureColumns(dbInstance, 'resignation_records', [
      { name: 'status', definition: 'TEXT' },
      { name: 'name', definition: 'TEXT' },
      { name: 'created_at', definition: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { name: 'deleted_at', definition: 'DATETIME' },
    ]);
    ensureColumns(dbInstance, 'resignation_certificate_records', [
      { name: 'status', definition: 'TEXT' },
      { name: 'employee_name', definition: 'TEXT' },
      { name: 'id_card', definition: 'TEXT' },
      { name: 'created_at', definition: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { name: 'deleted_at', definition: 'DATETIME' },
    ]);
    ensureColumns(dbInstance, 'social_security_records', [
      { name: 'document_type', definition: 'TEXT' },
      { name: 'status', definition: 'TEXT' },
      { name: 'name', definition: 'TEXT' },
      { name: 'id_card', definition: 'TEXT' },
      { name: 'reviewer_name', definition: 'TEXT' },
      { name: 'reviewed_at', definition: 'DATETIME' },
      { name: 'created_at', definition: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { name: 'deleted_at', definition: 'DATETIME' },
    ]);
    ensureColumns(dbInstance, 'social_security_purchase_records', [
      { name: 'category', definition: 'TEXT' },
      { name: 'contract_status', definition: 'TEXT' },
      { name: 'department', definition: 'TEXT' },
      { name: 'employee_name', definition: 'TEXT' },
      { name: 'domicile', definition: 'TEXT' },
      { name: 'id_card', definition: 'TEXT' },
      { name: 'phone', definition: 'TEXT' },
      { name: 'bank_card', definition: 'TEXT' },
      { name: 'gender', definition: 'TEXT' },
      { name: 'birth_date', definition: 'TEXT' },
      { name: 'education', definition: 'TEXT' },
      { name: 'insurance_status', definition: 'TEXT' },
      { name: 'contract_count', definition: 'TEXT' },
      { name: 'contract_start_date', definition: 'TEXT' },
      { name: 'contract_term_years', definition: 'TEXT' },
      { name: 'contract_end_date', definition: 'TEXT' },
      { name: 'due_days', definition: 'TEXT' },
      { name: 'employment_status', definition: 'TEXT' },
      { name: 'resignation_date', definition: 'TEXT' },
      { name: 'confidentiality_agreement', definition: 'TEXT' },
      { name: 'probation_salary', definition: 'TEXT' },
      { name: 'remarks', definition: 'TEXT' },
      { name: 'data_json', definition: "TEXT DEFAULT '{}'" },
      { name: 'exported_at', definition: 'DATETIME' },
      { name: 'created_at', definition: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { name: 'updated_at', definition: 'DATETIME' },
      { name: 'deleted_at', definition: 'DATETIME' },
    ]);
    ensureColumns(dbInstance, 'leave_request_records', [
      { name: 'status', definition: "TEXT DEFAULT '待审核'" },
      { name: 'employee_id', definition: 'INTEGER' },
      { name: 'employee_name', definition: 'TEXT' },
      { name: 'id_card', definition: 'TEXT' },
      { name: 'phone', definition: 'TEXT' },
      { name: 'department', definition: 'TEXT' },
      { name: 'position', definition: 'TEXT' },
      { name: 'leave_date', definition: 'TEXT' },
      { name: 'leave_start_date', definition: 'TEXT' },
      { name: 'leave_end_date', definition: 'TEXT' },
      { name: 'duration', definition: "TEXT DEFAULT 'full'" },
      { name: 'half_day_period', definition: 'TEXT' },
      { name: 'leave_type', definition: 'TEXT' },
      { name: 'reason', definition: 'TEXT' },
      { name: 'applicant_signature_data_url', definition: 'TEXT' },
      { name: 'created_by_name', definition: 'TEXT' },
      { name: 'reviewer_name', definition: 'TEXT' },
      { name: 'reviewed_at', definition: 'DATETIME' },
      { name: 'exported_at', definition: 'DATETIME' },
      { name: 'printed_at', definition: 'DATETIME' },
      { name: 'created_at', definition: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { name: 'updated_at', definition: 'DATETIME' },
      { name: 'deleted_at', definition: 'DATETIME' },
    ]);
    ensureColumns(dbInstance, 'dormitory_records', [
      { name: 'status', definition: 'TEXT' },
      { name: 'name', definition: 'TEXT' },
      { name: 'created_at', definition: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
    ]);
    ensureColumns(dbInstance, 'dormitory_room_change_records', [
      { name: 'dormitory_record_id', definition: 'INTEGER' },
      { name: 'changed_at', definition: 'DATETIME' },
    ]);
    ensureColumns(dbInstance, 'dormitory_delete_records', [
      { name: 'deleted_at', definition: 'DATETIME' },
      { name: 'deleted_by_user_id', definition: 'INTEGER' },
    ]);
  } catch (error) {
    console.error('Pre-index compatibility migration failed:', error);
  }

  dbInstance.exec(`
    CREATE INDEX IF NOT EXISTS idx_onboarding_status ON onboarding_records(status);
    CREATE INDEX IF NOT EXISTS idx_onboarding_name ON onboarding_records(name);
    CREATE INDEX IF NOT EXISTS idx_onboarding_created_at ON onboarding_records(created_at);
    CREATE INDEX IF NOT EXISTS idx_regularization_status ON regularization_records(status);
    CREATE INDEX IF NOT EXISTS idx_regularization_applicant_name ON regularization_records(applicant_name);
    CREATE INDEX IF NOT EXISTS idx_regularization_created_at ON regularization_records(created_at);
    CREATE INDEX IF NOT EXISTS idx_work_certificate_status ON work_certificate_records(status);
    CREATE INDEX IF NOT EXISTS idx_work_certificate_name ON work_certificate_records(name);
    CREATE INDEX IF NOT EXISTS idx_work_certificate_created_at ON work_certificate_records(created_at);
    CREATE INDEX IF NOT EXISTS idx_labor_contract_termination_employee ON labor_contract_termination_records(employee_name);
    CREATE INDEX IF NOT EXISTS idx_labor_contract_termination_created_at ON labor_contract_termination_records(created_at);
    CREATE INDEX IF NOT EXISTS idx_labor_contract_termination_deleted_at ON labor_contract_termination_records(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_resignation_status ON resignation_records(status);
    CREATE INDEX IF NOT EXISTS idx_resignation_name ON resignation_records(name);
    CREATE INDEX IF NOT EXISTS idx_resignation_created_at ON resignation_records(created_at);
    CREATE INDEX IF NOT EXISTS idx_resignation_deleted_at ON resignation_records(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_resignation_certificate_status ON resignation_certificate_records(status);
    CREATE INDEX IF NOT EXISTS idx_resignation_certificate_employee ON resignation_certificate_records(employee_name);
    CREATE INDEX IF NOT EXISTS idx_resignation_certificate_id_card ON resignation_certificate_records(id_card);
    CREATE INDEX IF NOT EXISTS idx_resignation_certificate_created_at ON resignation_certificate_records(created_at);
    CREATE INDEX IF NOT EXISTS idx_resignation_certificate_deleted_at ON resignation_certificate_records(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_social_security_type ON social_security_records(document_type);
    CREATE INDEX IF NOT EXISTS idx_social_security_status ON social_security_records(status);
    CREATE INDEX IF NOT EXISTS idx_social_security_name ON social_security_records(name);
    CREATE INDEX IF NOT EXISTS idx_social_security_created_at ON social_security_records(created_at);
    CREATE INDEX IF NOT EXISTS idx_social_security_deleted_at ON social_security_records(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_social_security_purchase_category ON social_security_purchase_records(category);
    CREATE INDEX IF NOT EXISTS idx_social_security_purchase_employee ON social_security_purchase_records(employee_name);
    CREATE INDEX IF NOT EXISTS idx_social_security_purchase_id_card ON social_security_purchase_records(id_card);
    CREATE INDEX IF NOT EXISTS idx_social_security_purchase_created_at ON social_security_purchase_records(created_at);
    CREATE INDEX IF NOT EXISTS idx_social_security_purchase_deleted_at ON social_security_purchase_records(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_leave_request_employee ON leave_request_records(employee_id);
    CREATE INDEX IF NOT EXISTS idx_leave_request_name ON leave_request_records(employee_name);
    CREATE INDEX IF NOT EXISTS idx_leave_request_status ON leave_request_records(status);
    CREATE INDEX IF NOT EXISTS idx_leave_request_date ON leave_request_records(leave_date);
    CREATE INDEX IF NOT EXISTS idx_leave_request_deleted_at ON leave_request_records(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_dormitory_status ON dormitory_records(status);
    CREATE INDEX IF NOT EXISTS idx_dormitory_name ON dormitory_records(name);
    CREATE INDEX IF NOT EXISTS idx_dormitory_created_at ON dormitory_records(created_at);
    CREATE INDEX IF NOT EXISTS idx_dormitory_beds_room_id ON dormitory_beds(room_id);
    CREATE INDEX IF NOT EXISTS idx_dormitory_room_changes_record_id ON dormitory_room_change_records(dormitory_record_id);
    CREATE INDEX IF NOT EXISTS idx_dormitory_room_changes_changed_at ON dormitory_room_change_records(changed_at);
    CREATE INDEX IF NOT EXISTS idx_dormitory_delete_records_deleted_at ON dormitory_delete_records(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_dormitory_delete_records_deleted_by ON dormitory_delete_records(deleted_by_user_id);
    CREATE INDEX IF NOT EXISTS idx_water_meter_room_no ON water_meter_records(room_no);
    CREATE INDEX IF NOT EXISTS idx_water_meter_reading_date ON water_meter_records(reading_date);
    CREATE INDEX IF NOT EXISTS idx_item_inventory_name ON item_inventory(name);
    CREATE INDEX IF NOT EXISTS idx_item_claim_records_item_id ON item_claim_records(item_id);
    CREATE INDEX IF NOT EXISTS idx_item_claim_records_status ON item_claim_records(status);
    CREATE INDEX IF NOT EXISTS idx_item_claim_records_created_at ON item_claim_records(created_at);
  `);

  try {
    ensureColumns(dbInstance, 'onboarding_records', [
      { name: 'status', definition: 'TEXT' },
      { name: 'name', definition: 'TEXT' },
      { name: 'gender', definition: 'TEXT' },
      { name: 'phone', definition: 'TEXT' },
      { name: 'id_card', definition: 'TEXT' },
      { name: 'position', definition: 'TEXT' },
      { name: 'department', definition: 'TEXT' },
      { name: 'hire_date', definition: 'TEXT' },
      { name: 'recruitment_source', definition: 'TEXT' },
      { name: 'data_json', definition: "TEXT DEFAULT '{}'" },
      { name: 'reviewer_name', definition: 'TEXT' },
      { name: 'hr_opinion', definition: 'TEXT' },
      { name: 'reviewed_at', definition: 'DATETIME' },
      { name: 'employee_id', definition: 'INTEGER' },
      { name: 'created_at', definition: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { name: 'updated_at', definition: 'DATETIME' },
    ]);

    ensureColumns(dbInstance, 'regularization_records', [
      { name: 'status', definition: 'TEXT' },
      { name: 'applicant_name', definition: 'TEXT' },
      { name: 'department', definition: 'TEXT' },
      { name: 'position', definition: 'TEXT' },
      { name: 'hire_date', definition: 'TEXT' },
      { name: 'regularization_date', definition: 'TEXT' },
      { name: 'data_json', definition: "TEXT DEFAULT '{}'" },
      { name: 'created_at', definition: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { name: 'updated_at', definition: 'DATETIME' },
      { name: 'deleted_at', definition: 'DATETIME' },
    ]);

    ensureColumns(dbInstance, 'work_certificate_records', [
      { name: 'status', definition: 'TEXT' },
      { name: 'name', definition: 'TEXT' },
      { name: 'gender', definition: 'TEXT' },
      { name: 'id_card', definition: 'TEXT' },
      { name: 'phone', definition: 'TEXT' },
      { name: 'department', definition: 'TEXT' },
      { name: 'position', definition: 'TEXT' },
      { name: 'hire_date', definition: 'TEXT' },
      { name: 'purpose', definition: 'TEXT' },
      { name: 'data_json', definition: "TEXT DEFAULT '{}'" },
      { name: 'reviewer_name', definition: 'TEXT' },
      { name: 'reviewed_at', definition: 'DATETIME' },
      { name: 'created_at', definition: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { name: 'updated_at', definition: 'DATETIME' },
      { name: 'deleted_at', definition: 'DATETIME' },
    ]);

    ensureColumns(dbInstance, 'labor_contract_termination_records', [
      { name: 'employee_name', definition: 'TEXT' },
      { name: 'honorific', definition: 'TEXT' },
      { name: 'termination_date', definition: 'TEXT' },
      { name: 'reason', definition: 'TEXT' },
      { name: 'procedure_deadline', definition: 'TEXT' },
      { name: 'company_name', definition: 'TEXT' },
      { name: 'notice_date', definition: 'TEXT' },
      { name: 'data_json', definition: "TEXT DEFAULT '{}'" },
      { name: 'created_by_name', definition: 'TEXT' },
      { name: 'exported_at', definition: 'DATETIME' },
      { name: 'printed_at', definition: 'DATETIME' },
      { name: 'created_at', definition: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { name: 'updated_at', definition: 'DATETIME' },
      { name: 'deleted_at', definition: 'DATETIME' },
    ]);

    ensureColumns(dbInstance, 'resignation_records', [
      { name: 'status', definition: 'TEXT' },
      { name: 'name', definition: 'TEXT' },
      { name: 'employee_no', definition: 'TEXT' },
      { name: 'department', definition: 'TEXT' },
      { name: 'id_card', definition: 'TEXT' },
      { name: 'position', definition: 'TEXT' },
      { name: 'hire_date', definition: 'TEXT' },
      { name: 'contract_end_date', definition: 'TEXT' },
      { name: 'apply_date', definition: 'TEXT' },
      { name: 'resignation_date', definition: 'TEXT' },
      { name: 'handover_date', definition: 'TEXT' },
      { name: 'resignation_type', definition: 'TEXT' },
      { name: 'data_json', definition: "TEXT DEFAULT '{}'" },
      { name: 'reviewer_name', definition: 'TEXT' },
      { name: 'reviewed_at', definition: 'DATETIME' },
      { name: 'exported_at', definition: 'DATETIME' },
      { name: 'created_at', definition: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { name: 'updated_at', definition: 'DATETIME' },
      { name: 'deleted_at', definition: 'DATETIME' },
    ]);

    ensureColumns(dbInstance, 'resignation_certificate_records', [
      { name: 'status', definition: 'TEXT' },
      { name: 'certificate_type', definition: 'TEXT' },
      { name: 'employee_name', definition: 'TEXT' },
      { name: 'id_card', definition: 'TEXT' },
      { name: 'phone', definition: 'TEXT' },
      { name: 'email', definition: 'TEXT' },
      { name: 'honorific', definition: 'TEXT' },
      { name: 'department', definition: 'TEXT' },
      { name: 'position', definition: 'TEXT' },
      { name: 'hire_date', definition: 'TEXT' },
      { name: 'leave_date', definition: 'TEXT' },
      { name: 'issue_date', definition: 'TEXT' },
      { name: 'company_name', definition: 'TEXT' },
      { name: 'receipt_date', definition: 'TEXT' },
      { name: 'data_json', definition: "TEXT DEFAULT '{}'" },
      { name: 'created_by_name', definition: 'TEXT' },
      { name: 'reviewer_name', definition: 'TEXT' },
      { name: 'reviewed_at', definition: 'DATETIME' },
      { name: 'review_remark', definition: 'TEXT' },
      { name: 'stamped_file_name', definition: 'TEXT' },
      { name: 'stamped_file_mime', definition: 'TEXT' },
      { name: 'stamped_file_data', definition: 'TEXT' },
      { name: 'completed_at', definition: 'DATETIME' },
      { name: 'email_sent_at', definition: 'DATETIME' },
      { name: 'email_error', definition: 'TEXT' },
      { name: 'certificate_exported_at', definition: 'DATETIME' },
      { name: 'receipt_exported_at', definition: 'DATETIME' },
      { name: 'certificate_printed_at', definition: 'DATETIME' },
      { name: 'receipt_printed_at', definition: 'DATETIME' },
      { name: 'created_at', definition: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { name: 'updated_at', definition: 'DATETIME' },
      { name: 'deleted_at', definition: 'DATETIME' },
    ]);

    ensureColumns(dbInstance, 'social_security_records', [
      { name: 'document_type', definition: 'TEXT' },
      { name: 'status', definition: 'TEXT' },
      { name: 'name', definition: 'TEXT' },
      { name: 'id_card', definition: 'TEXT' },
      { name: 'phone', definition: 'TEXT' },
      { name: 'department', definition: 'TEXT' },
      { name: 'position', definition: 'TEXT' },
      { name: 'hire_date', definition: 'TEXT' },
      { name: 'application_date', definition: 'TEXT' },
      { name: 'data_json', definition: "TEXT DEFAULT '{}'" },
      { name: 'reviewer_name', definition: 'TEXT' },
      { name: 'reviewed_at', definition: 'DATETIME' },
      { name: 'exported_at', definition: 'DATETIME' },
      { name: 'created_at', definition: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { name: 'updated_at', definition: 'DATETIME' },
      { name: 'deleted_at', definition: 'DATETIME' },
    ]);
    ensureColumns(dbInstance, 'social_security_purchase_records', [
      { name: 'category', definition: 'TEXT' },
      { name: 'contract_status', definition: 'TEXT' },
      { name: 'department', definition: 'TEXT' },
      { name: 'employee_name', definition: 'TEXT' },
      { name: 'domicile', definition: 'TEXT' },
      { name: 'id_card', definition: 'TEXT' },
      { name: 'phone', definition: 'TEXT' },
      { name: 'bank_card', definition: 'TEXT' },
      { name: 'gender', definition: 'TEXT' },
      { name: 'birth_date', definition: 'TEXT' },
      { name: 'education', definition: 'TEXT' },
      { name: 'insurance_status', definition: 'TEXT' },
      { name: 'contract_count', definition: 'TEXT' },
      { name: 'contract_start_date', definition: 'TEXT' },
      { name: 'contract_term_years', definition: 'TEXT' },
      { name: 'contract_end_date', definition: 'TEXT' },
      { name: 'due_days', definition: 'TEXT' },
      { name: 'employment_status', definition: 'TEXT' },
      { name: 'resignation_date', definition: 'TEXT' },
      { name: 'confidentiality_agreement', definition: 'TEXT' },
      { name: 'probation_salary', definition: 'TEXT' },
      { name: 'remarks', definition: 'TEXT' },
      { name: 'data_json', definition: "TEXT DEFAULT '{}'" },
      { name: 'exported_at', definition: 'DATETIME' },
      { name: 'created_at', definition: 'DATETIME DEFAULT CURRENT_TIMESTAMP' },
      { name: 'updated_at', definition: 'DATETIME' },
      { name: 'deleted_at', definition: 'DATETIME' },
    ]);
  } catch (error) {
    console.error('HR records compatibility migration failed:', error);
  }

  try {
    const regularizationColumns = dbInstance.prepare("PRAGMA table_info(regularization_records)").all() as { name: string }[];
    if (!regularizationColumns.some(col => col.name === 'deleted_at')) {
      dbInstance.exec('ALTER TABLE regularization_records ADD COLUMN deleted_at DATETIME');
    }
    dbInstance.prepare("UPDATE regularization_records SET status = '已审核' WHERE status = '已导出'").run();
    dbInstance.prepare("DELETE FROM regularization_records WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '+8 hours', '-7 days')").run();
  } catch (error) {
    console.error('Regularization status migration failed:', error);
  }

  try {
    const workCertificateColumns = dbInstance.prepare("PRAGMA table_info(work_certificate_records)").all() as { name: string }[];
    if (!workCertificateColumns.some(col => col.name === 'deleted_at')) {
      dbInstance.exec('ALTER TABLE work_certificate_records ADD COLUMN deleted_at DATETIME');
    }
    dbInstance.prepare("DELETE FROM work_certificate_records WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '+8 hours', '-7 days')").run();
  } catch (error) {
    console.error('Work certificate status migration failed:', error);
  }

  try {
    dbInstance.prepare("DELETE FROM labor_contract_termination_records WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '+8 hours', '-7 days')").run();
  } catch (error) {
    console.error('Labor contract termination cleanup failed:', error);
  }

  try {
    dbInstance.prepare("DELETE FROM resignation_records WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '+8 hours', '-7 days')").run();
  } catch (error) {
    console.error('Resignation records cleanup failed:', error);
  }

  try {
    const certificateColumns = dbInstance.prepare("PRAGMA table_info(resignation_certificate_records)").all() as { name: string }[];
    const addColumnIfMissing = (name: string, definition: string) => {
      if (!certificateColumns.some(col => col.name === name)) {
        dbInstance.exec(`ALTER TABLE resignation_certificate_records ADD COLUMN ${name} ${definition}`);
      }
    };
    addColumnIfMissing('status', "TEXT DEFAULT '待审核'");
    addColumnIfMissing('id_card', 'TEXT');
    addColumnIfMissing('phone', 'TEXT');
    addColumnIfMissing('email', 'TEXT');
    addColumnIfMissing('reviewer_name', 'TEXT');
    addColumnIfMissing('reviewed_at', 'DATETIME');
    addColumnIfMissing('review_remark', 'TEXT');
    addColumnIfMissing('stamped_file_name', 'TEXT');
    addColumnIfMissing('stamped_file_mime', 'TEXT');
    addColumnIfMissing('stamped_file_data', 'TEXT');
    addColumnIfMissing('completed_at', 'DATETIME');
    addColumnIfMissing('email_sent_at', 'DATETIME');
    addColumnIfMissing('email_error', 'TEXT');
    dbInstance.prepare("DELETE FROM resignation_certificate_records WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '+8 hours', '-7 days')").run();
  } catch (error) {
    console.error('Resignation certificate records cleanup failed:', error);
  }

  try {
    dbInstance.prepare("DELETE FROM social_security_records WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '+8 hours', '-7 days')").run();
    dbInstance.prepare("DELETE FROM social_security_purchase_records WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', '+8 hours', '-7 days')").run();
  } catch (error) {
    console.error('Social security records cleanup failed:', error);
  }

  try {
    const dormitoryColumns = dbInstance.prepare("PRAGMA table_info(dormitory_records)").all() as { name: string }[];
    if (!dormitoryColumns.some(col => col.name === 'room_no')) {
      dbInstance.exec('ALTER TABLE dormitory_records ADD COLUMN room_no TEXT');
    }
    if (!dormitoryColumns.some(col => col.name === 'bed_no')) {
      dbInstance.exec('ALTER TABLE dormitory_records ADD COLUMN bed_no TEXT');
    }
    if (!dormitoryColumns.some(col => col.name === 'checkout_apply_date')) {
      dbInstance.exec('ALTER TABLE dormitory_records ADD COLUMN checkout_apply_date TEXT');
    }
    if (!dormitoryColumns.some(col => col.name === 'move_out_date')) {
      dbInstance.exec('ALTER TABLE dormitory_records ADD COLUMN move_out_date TEXT');
    }
    if (!dormitoryColumns.some(col => col.name === 'checkout_reason')) {
      dbInstance.exec('ALTER TABLE dormitory_records ADD COLUMN checkout_reason TEXT');
    }
    if (!dormitoryColumns.some(col => col.name === 'key_returned')) {
      dbInstance.exec('ALTER TABLE dormitory_records ADD COLUMN key_returned TEXT');
    }
    if (!dormitoryColumns.some(col => col.name === 'checkout_handler_name')) {
      dbInstance.exec('ALTER TABLE dormitory_records ADD COLUMN checkout_handler_name TEXT');
    }
    if (!dormitoryColumns.some(col => col.name === 'checked_out_at')) {
      dbInstance.exec('ALTER TABLE dormitory_records ADD COLUMN checked_out_at DATETIME');
    }
    dbInstance.exec(`
      CREATE INDEX IF NOT EXISTS idx_dormitory_room_no ON dormitory_records(room_no);
      CREATE INDEX IF NOT EXISTS idx_dormitory_bed_no ON dormitory_records(bed_no);
    `);
  } catch (e) {
    // 忽略已有库迁移错误
  }

  try {
    const roomColumns = dbInstance.prepare("PRAGMA table_info(dormitory_rooms)").all() as { name: string }[];
    if (!roomColumns.some(col => col.name === 'room_type')) {
      dbInstance.exec("ALTER TABLE dormitory_rooms ADD COLUMN room_type TEXT DEFAULT ''");
    }
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS dormitory_room_change_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dormitory_record_id INTEGER NOT NULL,
        employee_name TEXT NOT NULL,
        from_room_no TEXT,
        from_bed_no TEXT,
        from_room_bed TEXT,
        to_room_no TEXT NOT NULL,
        to_bed_no TEXT NOT NULL,
        to_room_bed TEXT NOT NULL,
        handler_name TEXT NOT NULL,
        reason TEXT,
        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dormitory_record_id) REFERENCES dormitory_records(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_dormitory_room_changes_record_id ON dormitory_room_change_records(dormitory_record_id);
      CREATE INDEX IF NOT EXISTS idx_dormitory_room_changes_changed_at ON dormitory_room_change_records(changed_at);
      CREATE TABLE IF NOT EXISTS dormitory_delete_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dormitory_record_id INTEGER NOT NULL,
        employee_name TEXT NOT NULL,
        phone TEXT,
        department TEXT,
        position TEXT,
        room_no TEXT,
        bed_no TEXT,
        room_bed TEXT,
        checked_in_at DATETIME,
        checked_out_at DATETIME,
        deleted_by_user_id INTEGER,
        deleted_by_name TEXT NOT NULL,
        deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        record_snapshot TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_dormitory_delete_records_deleted_at ON dormitory_delete_records(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_dormitory_delete_records_deleted_by ON dormitory_delete_records(deleted_by_user_id);
    `);
  } catch (e) {
    // 忽略已有库迁移错误
  }

  try {
    const deleteRecordColumns = dbInstance.prepare("PRAGMA table_info(dormitory_delete_records)").all() as { name: string }[];
    if (!deleteRecordColumns.some(col => col.name === 'record_snapshot')) {
      dbInstance.exec('ALTER TABLE dormitory_delete_records ADD COLUMN record_snapshot TEXT');
    }
  } catch (e) {
    // 忽略已有库迁移错误
  }

  try {
    const waterMeterColumns = dbInstance.prepare("PRAGMA table_info(water_meter_records)").all() as { name: string }[];
    if (!waterMeterColumns.some(col => col.name === 'previous_reading_text')) {
      dbInstance.exec('ALTER TABLE water_meter_records ADD COLUMN previous_reading_text TEXT');
    }
    if (!waterMeterColumns.some(col => col.name === 'current_reading_text')) {
      dbInstance.exec('ALTER TABLE water_meter_records ADD COLUMN current_reading_text TEXT');
    }
  } catch (e) {
    // 忽略已有库迁移错误
  }

  // 资产表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      department TEXT,
      user TEXT,
      value REAL,
      purchase_date TEXT,
      status TEXT DEFAULT '闲置',
      config TEXT,
      scrap_time TEXT,
      claim_time TEXT,
      scrap_confirmer TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 为 employees 表添加 resign_date 列（如果不存在）
  try {
    const empColumns = dbInstance.prepare("PRAGMA table_info(employees)").all() as { name: string }[];
    if (!empColumns.some(col => col.name === 'resign_date')) {
      dbInstance.exec('ALTER TABLE employees ADD COLUMN resign_date TEXT');
    }
  } catch (e) {
    // 忽略错误
  }

  // 为已存在的表添加 scrap_time、claim_time 和 scrap_confirmer 列（如果不存在）
  try {
    const columns = dbInstance.prepare("PRAGMA table_info(assets)").all() as { name: string }[];
    if (!columns.some(col => col.name === 'scrap_time')) {
      dbInstance.exec('ALTER TABLE assets ADD COLUMN scrap_time TEXT');
    }
    if (!columns.some(col => col.name === 'claim_time')) {
      dbInstance.exec('ALTER TABLE assets ADD COLUMN claim_time TEXT');
    }
    if (!columns.some(col => col.name === 'scrap_confirmer')) {
      dbInstance.exec('ALTER TABLE assets ADD COLUMN scrap_confirmer TEXT');
    }
  } catch (e) {
    // 忽略错误
  };

  // 为 work_hours_monthly 表添加工资相关字段（如果不存在）
  try {
    const workHoursColumns = dbInstance.prepare("PRAGMA table_info(work_hours_monthly)").all() as { name: string }[];
    const addColumnIfNotExists = (colName: string, colDef: string) => {
      if (!workHoursColumns.some(col => col.name === colName)) {
        dbInstance.exec(`ALTER TABLE work_hours_monthly ADD COLUMN ${colName} ${colDef}`);
      }
    };
    addColumnIfNotExists('employee_name', 'TEXT');
    addColumnIfNotExists('year', 'INTEGER DEFAULT 0');
    addColumnIfNotExists('month_num', 'INTEGER DEFAULT 0');
    addColumnIfNotExists('normal_hours', 'REAL DEFAULT 0');
    addColumnIfNotExists('weekday_overtime', 'REAL DEFAULT 0');
    addColumnIfNotExists('base_salary', 'REAL DEFAULT 0');
    addColumnIfNotExists('normal_pay', 'REAL DEFAULT 0');
    addColumnIfNotExists('weekday_overtime_pay', 'REAL DEFAULT 0');
    addColumnIfNotExists('weekend_overtime_pay', 'REAL DEFAULT 0');
    addColumnIfNotExists('total_payable', 'REAL DEFAULT 0');
    addColumnIfNotExists('deduction', 'REAL DEFAULT 0');
    addColumnIfNotExists('actual_amount', 'REAL DEFAULT 0');
    // 车间工资条字段
    addColumnIfNotExists('is_full_attendance', 'TEXT DEFAULT ""');
    addColumnIfNotExists('id_card', 'TEXT DEFAULT ""');
    addColumnIfNotExists('bank_name', 'TEXT DEFAULT ""');
    addColumnIfNotExists('performance_allowance', 'REAL DEFAULT 0');
    addColumnIfNotExists('other_subsidy_base', 'REAL DEFAULT 0');
    addColumnIfNotExists('required_hours', 'REAL DEFAULT 176');
    addColumnIfNotExists('full_attendance_hours', 'REAL DEFAULT 176');
    addColumnIfNotExists('holiday_overtime_hours', 'REAL DEFAULT 0');
    addColumnIfNotExists('night_shift_days', 'REAL DEFAULT 0');
    addColumnIfNotExists('absent_days', 'REAL DEFAULT 0');
    addColumnIfNotExists('personal_leave_hours', 'REAL DEFAULT 0');
    addColumnIfNotExists('sick_leave_hours', 'REAL DEFAULT 0');
    addColumnIfNotExists('late_early_minutes', 'REAL DEFAULT 0');
    addColumnIfNotExists('late_early_count', 'REAL DEFAULT 0');
    addColumnIfNotExists('sign_card_count', 'REAL DEFAULT 0');
    addColumnIfNotExists('evaluation_coefficient', 'REAL DEFAULT 1');
    addColumnIfNotExists('performance_pay', 'REAL DEFAULT 0');
    addColumnIfNotExists('sick_pay', 'REAL DEFAULT 0');
    addColumnIfNotExists('living_subsidy', 'REAL DEFAULT 0');
    addColumnIfNotExists('other_pay', 'REAL DEFAULT 0');
    addColumnIfNotExists('seniority_award', 'REAL DEFAULT 0');
    addColumnIfNotExists('full_attendance_award', 'REAL DEFAULT 0');
    addColumnIfNotExists('position_subsidy', 'REAL DEFAULT 0');
    addColumnIfNotExists('work_reward', 'REAL DEFAULT 0');
    addColumnIfNotExists('spring_festival_subsidy', 'REAL DEFAULT 0');
    addColumnIfNotExists('social_security_subsidy', 'REAL DEFAULT 0');
    addColumnIfNotExists('deduct_social_security', 'REAL DEFAULT 0');
    addColumnIfNotExists('deduct_loan', 'REAL DEFAULT 0');
    addColumnIfNotExists('deduct_urgent', 'REAL DEFAULT 0');
    addColumnIfNotExists('deduct_other', 'REAL DEFAULT 0');
    addColumnIfNotExists('deduct_utilities', 'REAL DEFAULT 0');
    addColumnIfNotExists('total_deduction', 'REAL DEFAULT 0');
    // 办公室工资条额外字段
    addColumnIfNotExists('hire_date', 'TEXT');
    addColumnIfNotExists('employee_code', 'TEXT');
    addColumnIfNotExists('department', 'TEXT');
    addColumnIfNotExists('should_attend_days', 'INTEGER DEFAULT 22');
    addColumnIfNotExists('saturday_days', 'INTEGER DEFAULT 4');
    addColumnIfNotExists('actual_attend_days', 'INTEGER DEFAULT 22');
    addColumnIfNotExists('paid_leave_days', 'INTEGER DEFAULT 0');
    addColumnIfNotExists('holiday_overtime', 'INTEGER DEFAULT 0');
    addColumnIfNotExists('holiday_pay', 'REAL DEFAULT 0');
    addColumnIfNotExists('holiday_overtime_pay', 'REAL DEFAULT 0');
    addColumnIfNotExists('performance_bonus', 'REAL DEFAULT 0');
    addColumnIfNotExists('meal_subsidy', 'REAL DEFAULT 0');
    addColumnIfNotExists('housing_subsidy', 'REAL DEFAULT 0');
    addColumnIfNotExists('transport_subsidy', 'REAL DEFAULT 0');
    addColumnIfNotExists('other_subsidy', 'REAL DEFAULT 0');
    addColumnIfNotExists('fine', 'REAL DEFAULT 0');
    addColumnIfNotExists('other_deduction', 'REAL DEFAULT 0');
    addColumnIfNotExists('housing_fund', 'REAL DEFAULT 0');
    addColumnIfNotExists('social_insurance', 'REAL DEFAULT 0');
    addColumnIfNotExists('social_pension_adj', 'REAL DEFAULT 0');
    addColumnIfNotExists('pre_tax_salary', 'REAL DEFAULT 0');
    addColumnIfNotExists('income_tax', 'REAL DEFAULT 0');
    addColumnIfNotExists('bank_account', 'TEXT');
    addColumnIfNotExists('remark', 'TEXT');
  } catch (e) {
    // 忽略错误
  };

  // 为 users 表添加 email 列（如果不存在）
  try {
    const userColumns = dbInstance.prepare("PRAGMA table_info(users)").all() as { name: string }[];
    if (!userColumns.some(col => col.name === 'email')) {
      dbInstance.exec('ALTER TABLE users ADD COLUMN email TEXT');
    }
  } catch (e) {
    // 忽略错误
  };

  // 线索表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      industry TEXT,
      level TEXT DEFAULT '普通',
      source TEXT,
      phone TEXT,
      address TEXT,
      remark TEXT,
      last_follow TEXT,
      creator TEXT,
      department TEXT,
      owner TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 客户表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      level TEXT DEFAULT '普通',
      source TEXT,
      phone TEXT,
      address TEXT,
      status TEXT DEFAULT '未成交',
      qualifications TEXT,
      creator TEXT,
      department TEXT,
      owner TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 任务表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT,
      priority TEXT DEFAULT '中',
      status TEXT DEFAULT '进行中',
      end_date TEXT,
      owner TEXT,
      department TEXT,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 分销商表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS distributors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      level TEXT DEFAULT '铜牌',
      sales REAL DEFAULT 0,
      commission REAL DEFAULT 0,
      status TEXT DEFAULT '活跃',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 账户表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT,
      balance REAL DEFAULT 0,
      status TEXT DEFAULT '正常',
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 待办事项表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      name TEXT NOT NULL,
      industry TEXT,
      level TEXT DEFAULT '普通',
      source TEXT,
      phone TEXT,
      address TEXT,
      remark TEXT,
      last_follow TEXT,
      creator TEXT,
      department TEXT,
      owner TEXT,
      processed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 权限模块表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 用户权限关联表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS user_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      permission_id INTEGER NOT NULL,
      granted INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (permission_id) REFERENCES permissions(id),
      UNIQUE(user_id, permission_id)
    )
  `);

  // 邮箱配置表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS email_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      host TEXT NOT NULL,
      port INTEGER DEFAULT 465,
      secure INTEGER DEFAULT 1,
      user TEXT NOT NULL,
      password TEXT NOT NULL,
      from_name TEXT DEFAULT '聚星数据平台',
      from_email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS database_backup_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      auto_enabled INTEGER DEFAULT 0,
      interval_hours INTEGER DEFAULT 24,
      last_backup_at TEXT,
      last_backup_file TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS database_backup_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      backup_type TEXT DEFAULT 'manual',
      created_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))
    )
  `);

  const backupSettingsExists = dbInstance.prepare('SELECT id FROM database_backup_settings WHERE id = 1').get();
  if (!backupSettingsExists) {
    dbInstance.prepare('INSERT INTO database_backup_settings (id) VALUES (1)').run();
  }

  // 验证码表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS verification_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      code TEXT NOT NULL,
      type TEXT DEFAULT 'reset_password',
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 注册码表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS registration_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      created_by INTEGER,
      used_by INTEGER,
      used INTEGER DEFAULT 0,
      permissions TEXT DEFAULT '[]',
      department_id INTEGER,
      position_id INTEGER,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      used_at DATETIME,
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (used_by) REFERENCES users(id),
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (position_id) REFERENCES positions(id)
    )
  `);
  
  // 添加缺失的字段（兼容旧表）
  try {
    dbInstance.exec('ALTER TABLE registration_codes ADD COLUMN department_id INTEGER');
  } catch {}
  try {
    dbInstance.exec('ALTER TABLE registration_codes ADD COLUMN position_id INTEGER');
  } catch {}

  // 联系人表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      customer_id INTEGER,
      phone TEXT,
      email TEXT,
      position TEXT,
      department TEXT,
      remark TEXT,
      owner TEXT,
      is_primary INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);

  // 确保 contacts 表有 is_primary 列
  try {
    const contactsCols = dbInstance.prepare("PRAGMA table_info(contacts)").all() as { name: string }[];
    if (!contactsCols.some(col => col.name === 'is_primary')) {
      dbInstance.exec('ALTER TABLE contacts ADD COLUMN is_primary INTEGER DEFAULT 0');
    }
  } catch (e) {
    // 忽略错误
  }

  // 合同表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contract_no TEXT,
      customer_id INTEGER,
      customer_name TEXT,
      title TEXT,
      amount REAL DEFAULT 0,
      start_date TEXT,
      end_date TEXT,
      status TEXT DEFAULT '执行中',
      type TEXT,
      sign_date TEXT,
      signatory TEXT,
      content TEXT,
      remark TEXT,
      owner TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);

  // 确保 contracts 表有所有必要的列
  try {
    const contractsCols = dbInstance.prepare("PRAGMA table_info(contracts)").all() as { name: string }[];
    const requiredCols = [
      ['contract_no', 'TEXT'],
      ['title', 'TEXT'],
      ['signatory', 'TEXT'],
      ['content', 'TEXT'],
      ['proof_file', 'TEXT'],
      ['proof_file_name', 'TEXT']
    ];
    for (const [col, colType] of requiredCols) {
      if (!contractsCols.some(c => c.name === col)) {
        dbInstance.exec(`ALTER TABLE contracts ADD COLUMN ${col} ${colType}`);
      }
    }
    console.log('Added proof_file columns to contracts table');
  } catch (e) {
    // 忽略错误
  }

  // 发票表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT NOT NULL,
      contract_id INTEGER,
      customer_name TEXT,
      amount REAL DEFAULT 0,
      tax_rate REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL DEFAULT 0,
      status TEXT DEFAULT '待开票',
      type TEXT DEFAULT '增值税专用发票',
      issue_date TEXT,
      remark TEXT,
      owner TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contract_id) REFERENCES contracts(id)
    )
  `);

  // 确保 invoices 表有所有必要的列
  try {
    const invoicesCols = dbInstance.prepare("PRAGMA table_info(invoices)").all() as { name: string }[];
    const requiredCols = [
      ['tax_rate', 'REAL DEFAULT 0'],
      ['tax_amount', 'REAL DEFAULT 0'],
      ['proof_file', 'TEXT'],
      ['proof_file_name', 'TEXT']
    ];
    for (const [col, colType] of requiredCols) {
      if (!invoicesCols.some(c => c.name === col)) {
        dbInstance.exec(`ALTER TABLE invoices ADD COLUMN ${col} ${colType}`);
      }
    }
    console.log('Added proof_file columns to invoices table');
  } catch (e) {
    // 忽略错误
  }

  // 回访表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      customer_name TEXT,
      contact_name TEXT,
      visit_date TEXT,
      visit_type TEXT DEFAULT '电话回访',
      content TEXT,
      next_plan TEXT,
      satisfaction TEXT DEFAULT '满意',
      owner TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);

  // 产品表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT,
      price REAL DEFAULT 0,
      unit TEXT DEFAULT '件',
      stock INTEGER DEFAULT 0,
      status TEXT DEFAULT '在售',
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 财务明细表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS finances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      category TEXT,
      amount REAL DEFAULT 0,
      date TEXT,
      related_id INTEGER,
      related_type TEXT,
      remark TEXT,
      owner TEXT,
      department TEXT,
      proof_file TEXT,
      proof_file_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 添加 proof_file 和 proof_file_name 字段（如果不存在）
  try {
    dbInstance.exec(`ALTER TABLE finances ADD COLUMN proof_file TEXT`);
    dbInstance.exec(`ALTER TABLE finances ADD COLUMN proof_file_name TEXT`);
    console.log('Added proof_file columns to finances table');
  } catch (e) {
    // 字段已存在，忽略错误
  }

  // 通知表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT,
      sender_id INTEGER,
      sender_name TEXT,
      receiver_id INTEGER,
      receiver_name TEXT,
      type TEXT DEFAULT 'system',
      is_read INTEGER DEFAULT 0,
      read_at DATETIME,
      email_sent INTEGER DEFAULT 0,
      email_error TEXT,
      attachment_file TEXT,
      attachment_file_name TEXT,
      created_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))
    )
  `);
  
  // 添加 attachment_file 和 attachment_file_name 字段（如果不存在）
  try {
    dbInstance.exec(`ALTER TABLE notifications ADD COLUMN attachment_file TEXT`);
    dbInstance.exec(`ALTER TABLE notifications ADD COLUMN attachment_file_name TEXT`);
    console.log('Added attachment columns to notifications table');
  } catch (e) {
    // 字段已存在，忽略错误
  }

  // SMTP配置表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS smtp_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      host TEXT NOT NULL,
      port INTEGER DEFAULT 587,
      secure INTEGER DEFAULT 0,
      user TEXT NOT NULL,
      pass TEXT NOT NULL,
      from_email TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 操作日志表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      description TEXT,
      ip_address TEXT,
      user_agent TEXT,
      request_url TEXT,
      request_method TEXT,
      request_body TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // AI聊天记录表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (strftime('%Y-%m-%d %H:%M:%S', 'now', 'localtime'))
    )
  `);

  // 确保 smtp_config 表有所有必要的列
  try {
    const smtpCols = dbInstance.prepare("PRAGMA table_info(smtp_config)").all() as { name: string }[];
    const requiredCols = [
      ['pass', 'TEXT DEFAULT \'\''],
      ['from_email', 'TEXT DEFAULT \'\'']
    ];
    for (const [col, colType] of requiredCols) {
      if (!smtpCols.some(c => c.name === col)) {
        dbInstance.exec(`ALTER TABLE smtp_config ADD COLUMN ${col} ${colType}`);
      }
    }
  } catch (e) {
    // 忽略错误
  }

  // 插入默认管理员账号
  const adminExists = dbInstance.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    dbInstance.prepare(`
      INSERT INTO users (username, password, name, role, department, email)
      VALUES (?, ?, ?, 'admin', '总经办', 'admin@example.com')
    `).run('admin', hashedPassword, '系统管理员');
  }
  
  // 如果管理员已存在但没有邮箱，更新邮箱
  const admin = dbInstance.prepare('SELECT id, email FROM users WHERE username = ?').get('admin') as { id: number; email?: string } | undefined;
  if (admin && !admin.email) {
    dbInstance.prepare('UPDATE users SET email = ? WHERE id = ?').run('admin@example.com', admin.id);
  }

  // 初始化权限模块 - 与导航栏菜单项对应
  const permissionsData = [
    // 仪表盘
    { code: 'dashboard', name: '仪表盘', description: '查看仪表盘数据' },
    
    // 客户管理
    { code: 'leads', name: '线索', description: '管理销售线索' },
    { code: 'customers', name: '客户', description: '管理客户信息' },
    { code: 'contacts', name: '联系人', description: '管理客户联系人' },
    { code: 'followup', name: '回访', description: '客户回访管理' },
    
    // 业务管理
    { code: 'contracts', name: '合同', description: '管理合同信息' },
    { code: 'invoices', name: '发票', description: '管理发票信息' },
    { code: 'products', name: '产品', description: '管理产品信息' },
    { code: 'assets', name: '资产管理', description: '管理公司资产' },
    
    // 审批流程
    { code: 'purchase-requests', name: '请购单管理', description: '管理请购单' },
    { code: 'expense-claims', name: '费用报销', description: '管理费用报销' },
    { code: 'approval-center', name: '审批中心', description: '审批处理中心' },
    { code: 'finance-review', name: '财务终审', description: '财务最终审批' },
    
    // 组织人事
    { code: 'usermanage', name: '用户管理', description: '管理系统用户' },
    { code: 'personnel', name: '人事管理', description: '管理员工入职登记和员工档案' },
    { code: 'administration', name: '行政管理', description: '管理员工住宿申请和入住办理' },
    { code: 'human-resources', name: '人力资源', description: '管理招聘职位和简历投递' },
    
    // 系统管理
    { code: 'taskmanage', name: '任务管理', description: '任务管理模块' },
    { code: 'todo', name: '待办事项', description: '管理待办事项' },
    { code: 'distribution', name: '分销达人', description: '分销商管理' },
    { code: 'finance', name: '财务明细', description: '查看财务明细' },
    { code: 'salary', name: '工资工时查询', description: '查询工资工时信息' },
    { code: 'generate', name: '生成管理', description: '生成内容管理' },
    { code: 'ai-chat', name: 'AI对话', description: 'AI对话功能' },
    { code: 'smtp', name: '邮件配置', description: '邮件发送配置' },
    { code: 'database-backup', name: '数据库备份', description: '备份和恢复系统数据库' },
    { code: 'operation-logs', name: '操作日志', description: '查看操作日志' },
    { code: 'settings', name: '系统设置', description: '系统配置管理' },
    
    // 发送通知中心
    { code: 'notification-center', name: '发送通知中心', description: '发送系统通知' },
  ];

  for (const perm of permissionsData) {
    const exists = dbInstance.prepare('SELECT id FROM permissions WHERE code = ?').get(perm.code);
    if (!exists) {
      dbInstance.prepare('INSERT INTO permissions (code, name, description) VALUES (?, ?, ?)').run(perm.code, perm.name, perm.description);
    }
  }

  // 清理离职超过一周的员工数据
  cleanResignedEmployees(dbInstance);

  console.log('Database initialized successfully');
  
  // 数据库迁移：添加 remark 字段（如果不存在）
  try {
    const columns = dbInstance.prepare("PRAGMA table_info(work_hours_monthly)").all() as { name: string }[];
    const hasRemark = columns.some(col => col.name === 'remark');
    if (!hasRemark) {
      dbInstance.exec('ALTER TABLE work_hours_monthly ADD COLUMN remark TEXT DEFAULT ""');
      console.log('Added remark column to work_hours_monthly table');
    }
  } catch (error) {
    console.log('Migration check for remark column:', error);
  }
  
  // 添加 employees 表的 hire_date 列
  try {
    const tableInfo = dbInstance.prepare('PRAGMA table_info(employees)').all() as { name: string }[];
    const hasHireDate = tableInfo.some(col => col.name === 'hire_date');
    if (!hasHireDate) {
      dbInstance.exec('ALTER TABLE employees ADD COLUMN hire_date TEXT');
      console.log('Added hire_date column to employees table');
    }
  } catch (error) {
    console.log('Migration check for hire_date column:', error);
  }
  
  // 添加 operation_logs 表的 user_name 列
  try {
    const tableInfo = dbInstance.prepare('PRAGMA table_info(operation_logs)').all() as { name: string }[];
    const hasUserName = tableInfo.some(col => col.name === 'user_name');
    if (!hasUserName) {
      dbInstance.exec('ALTER TABLE operation_logs ADD COLUMN user_name TEXT DEFAULT ""');
      console.log('Added user_name column to operation_logs table');
    }
  } catch (error) {
    console.log('Migration check for user_name column:', error);
  }
  
  // 添加 operation_logs 表的 details 列
  try {
    const tableInfo = dbInstance.prepare('PRAGMA table_info(operation_logs)').all() as { name: string }[];
    const hasDetails = tableInfo.some(col => col.name === 'details');
    if (!hasDetails) {
      dbInstance.exec('ALTER TABLE operation_logs ADD COLUMN details TEXT DEFAULT ""');
      console.log('Added details column to operation_logs table');
    }
  } catch (error) {
    console.log('Migration check for details column:', error);
  }
  
  // ========== 审批流程系统新表 ==========
  
  // 职位层级表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      level INTEGER DEFAULT 0,
      department_id INTEGER,
      can_approve_purchase INTEGER DEFAULT 0,
      can_approve_expense INTEGER DEFAULT 0,
      approval_limit REAL DEFAULT 0,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id)
    )
  `);
  
  // 请购单表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS purchase_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_no TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      applicant_id INTEGER NOT NULL,
      applicant_name TEXT NOT NULL,
      department TEXT,
      items TEXT NOT NULL,
      total_amount REAL DEFAULT 0,
      reason TEXT,
      urgency TEXT DEFAULT '普通',
      status TEXT DEFAULT '待审批',
      current_approver_id INTEGER,
      current_approver_name TEXT,
      proof_file TEXT,
      proof_file_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (applicant_id) REFERENCES users(id),
      FOREIGN KEY (current_approver_id) REFERENCES users(id)
    )
  `);
  
  // 费用报销单表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS expense_claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      claim_no TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      applicant_id INTEGER NOT NULL,
      applicant_name TEXT NOT NULL,
      department TEXT,
      expense_type TEXT NOT NULL,
      expense_date TEXT,
      items TEXT NOT NULL,
      total_amount REAL DEFAULT 0,
      description TEXT,
      status TEXT DEFAULT '待审批',
      current_approver_id INTEGER,
      current_approver_name TEXT,
      proof_file TEXT,
      proof_file_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (applicant_id) REFERENCES users(id),
      FOREIGN KEY (current_approver_id) REFERENCES users(id)
    )
  `);
  
  // 审批记录表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS approval_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_type TEXT NOT NULL,
      doc_id INTEGER NOT NULL,
      doc_no TEXT NOT NULL,
      approver_id INTEGER NOT NULL,
      approver_name TEXT NOT NULL,
      action TEXT NOT NULL,
      comment TEXT,
      approval_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (approver_id) REFERENCES users(id)
    )
  `);
  
  // 消息通知表
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      type TEXT DEFAULT 'system',
      related_doc_type TEXT,
      related_doc_id INTEGER,
      is_read INTEGER DEFAULT 0,
      read_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  
  // 为 employees 表添加组织架构相关字段
  try {
    const empCols = dbInstance.prepare("PRAGMA table_info(employees)").all() as { name: string }[];
    const addEmpCol = (colName: string, colDef: string) => {
      if (!empCols.some(col => col.name === colName)) {
        dbInstance.exec(`ALTER TABLE employees ADD COLUMN ${colName} ${colDef}`);
        console.log(`Added ${colName} column to employees table`);
      }
    };
    addEmpCol('department_id', 'INTEGER');
    addEmpCol('position_id', 'INTEGER');
    addEmpCol('manager_id', 'INTEGER');
    addEmpCol('user_id', 'INTEGER');
  } catch (e) {
    console.log('Migration for employees org fields:', e);
  }
  
  // 为 users 表添加员工关联字段
  try {
    const userCols = dbInstance.prepare("PRAGMA table_info(users)").all() as { name: string }[];
    if (!userCols.some(col => col.name === 'employee_id')) {
      dbInstance.exec('ALTER TABLE users ADD COLUMN employee_id INTEGER');
      console.log('Added employee_id column to users table');
    }
    if (!userCols.some(col => col.name === 'department_id')) {
      dbInstance.exec('ALTER TABLE users ADD COLUMN department_id INTEGER');
      console.log('Added department_id column to users table');
    }
    if (!userCols.some(col => col.name === 'position_id')) {
      dbInstance.exec('ALTER TABLE users ADD COLUMN position_id INTEGER');
      console.log('Added position_id column to users table');
    }
    if (!userCols.some(col => col.name === 'manager_id')) {
      dbInstance.exec('ALTER TABLE users ADD COLUMN manager_id INTEGER');
      console.log('Added manager_id column to users table');
    }
    if (!userCols.some(col => col.name === 'phone')) {
      dbInstance.exec('ALTER TABLE users ADD COLUMN phone TEXT');
      console.log('Added phone column to users table');
    }
    if (!userCols.some(col => col.name === 'email')) {
      dbInstance.exec('ALTER TABLE users ADD COLUMN email TEXT');
      console.log('Added email column to users table');
    }
    if (!userCols.some(col => col.name === 'status')) {
      dbInstance.exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active'");
      console.log('Added status column to users table');
    }
  } catch (e) {
    console.log('Migration for users fields:', e);
  }
  
  // 为 departments 表添加新字段
  try {
    const deptCols = dbInstance.prepare("PRAGMA table_info(departments)").all() as { name: string }[];
    const addDeptCol = (colName: string, colDef: string) => {
      if (!deptCols.some(col => col.name === colName)) {
        dbInstance.exec(`ALTER TABLE departments ADD COLUMN ${colName} ${colDef}`);
        console.log(`Added ${colName} column to departments table`);
      }
    };
    addDeptCol('manager_id', 'INTEGER');
    addDeptCol('manager_name', 'TEXT');
    addDeptCol('description', 'TEXT');
    addDeptCol('updated_at', 'DATETIME');
  } catch (e) {
    console.log('Migration for departments fields:', e);
  }
  
  // 迁移：为messages表添加缺失的列
  try {
    const msgCols = dbInstance.prepare("PRAGMA table_info(messages)").all() as { name: string }[];
    const addMsgCol = (colName: string, colDef: string) => {
      if (!msgCols.some(col => col.name === colName)) {
        dbInstance.exec(`ALTER TABLE messages ADD COLUMN ${colName} ${colDef}`);
        console.log(`Added ${colName} column to messages table`);
      }
    };
    addMsgCol('related_doc_type', 'TEXT');
    addMsgCol('related_doc_id', 'INTEGER');
    addMsgCol('read_at', 'DATETIME');
  } catch (e) {
    console.log('Migration for messages fields:', e);
  }
  
  // 初始化默认部门
  const defaultDepartments = [
    { id: 1, name: '行政部', description: '负责公司行政管理' },
    { id: 2, name: '财务部', description: '负责公司财务管理' },
    { id: 3, name: '人力资源部', description: '负责人力资源管理' },
    { id: 4, name: '技术部', description: '负责技术研发' },
    { id: 5, name: '市场部', description: '负责市场推广' },
    { id: 6, name: '销售部', description: '负责产品销售' },
    { id: 7, name: '生产部', description: '负责生产制造' },
  ];
  
  for (const dept of defaultDepartments) {
    const exists = dbInstance.prepare('SELECT id FROM departments WHERE id = ?').get(dept.id);
    if (!exists) {
      dbInstance.prepare('INSERT INTO departments (id, name, description) VALUES (?, ?, ?)').run(
        dept.id, dept.name, dept.description
      );
    }
  }
  
  // 初始化默认职位
  const defaultPositions = [
    { name: '普通员工', level: 1, can_approve_purchase: 0, can_approve_expense: 0, approval_limit: 0 },
    { name: '组长', level: 2, can_approve_purchase: 1, can_approve_expense: 1, approval_limit: 5000 },
    { name: '主管', level: 3, can_approve_purchase: 1, can_approve_expense: 1, approval_limit: 20000 },
    { name: '经理', level: 4, can_approve_purchase: 1, can_approve_expense: 1, approval_limit: 50000 },
    { name: '总监', level: 5, can_approve_purchase: 1, can_approve_expense: 1, approval_limit: 100000 },
    { name: '总经理', level: 6, can_approve_purchase: 1, can_approve_expense: 1, approval_limit: 999999999 },
  ];
  
  for (const pos of defaultPositions) {
    const exists = dbInstance.prepare('SELECT id FROM positions WHERE name = ?').get(pos.name);
    if (!exists) {
      dbInstance.prepare('INSERT INTO positions (name, level, can_approve_purchase, can_approve_expense, approval_limit) VALUES (?, ?, ?, ?, ?)').run(
        pos.name, pos.level, pos.can_approve_purchase, pos.can_approve_expense, pos.approval_limit
      );
    }
  }
  
  // 企业微信机器人配置表
  try {
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS wxwork_bot_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        bot_id TEXT DEFAULT '',
        bot_secret TEXT DEFAULT '',
        api_url TEXT DEFAULT '',
        auth_token TEXT DEFAULT '',
        enabled INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 确保有一条配置记录
    const configExists = dbInstance.prepare('SELECT id FROM wxwork_bot_config WHERE id = 1').get();
    if (!configExists) {
      dbInstance.prepare('INSERT INTO wxwork_bot_config (id) VALUES (1)').run();
    }
  } catch (e) {
    console.log('WxWork Bot config table:', e);
  }
  
  // AI 配置表
  try {
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS ai_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        deepseek_api_key TEXT DEFAULT '',
        doubao_api_key TEXT DEFAULT '',
        doubao_secret TEXT DEFAULT '',
        default_provider TEXT DEFAULT 'deepseek',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    const aiConfigExists = dbInstance.prepare('SELECT id FROM ai_config WHERE id = 1').get();
    if (!aiConfigExists) {
      dbInstance.prepare('INSERT INTO ai_config (id) VALUES (1)').run();
    }
  } catch (e) {
    console.log('AI config table:', e);
  }
  
  // 添加权限模块
  const newPermissions = [
    { code: 'purchase_requests', name: '请购单管理', description: '管理请购单' },
    { code: 'expense_claims', name: '费用报销', description: '管理费用报销' },
    { code: 'org_structure', name: '组织架构', description: '管理部门职位架构' },
  ];
  
  for (const perm of newPermissions) {
    const exists = dbInstance.prepare('SELECT id FROM permissions WHERE code = ?').get(perm.code);
    if (!exists) {
      dbInstance.prepare('INSERT INTO permissions (code, name, description) VALUES (?, ?, ?)').run(perm.code, perm.name, perm.description);
    }
  }
  
  // 重新启用外键约束
  dbInstance.pragma('foreign_keys = ON');
  ensureChinaTimeTriggers(dbInstance);
  ensureOperationLogsChinaTimeMigration(dbInstance);
  ensureEmployeeSalaryLocationMigration(dbInstance);
  ensureProductionEmployeesWorkshopMigration(dbInstance);
  
  // 清理35天前的过期日志
  console.log('数据库初始化完成，开始清理过期日志...');
  try {
    // 清理35天前的操作日志
    const cutoffDateStr = formatChinaDateTime(Date.now() - 35 * 24 * 60 * 60 * 1000);
    
    // 检查 operation_logs 表是否存在
    const opTableExists = dbInstance
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='operation_logs'")
      .get();
    
    if (opTableExists) {
      const opResult = dbInstance
        .prepare('DELETE FROM operation_logs WHERE created_at < ?')
        .run(cutoffDateStr);
      console.log(`已删除 ${opResult.changes} 条过期操作日志`);
    }
    
    // 检查 chat_messages 表是否存在
    const chatTableExists = dbInstance
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_messages'")
      .get();
    
    if (chatTableExists) {
      const chatResult = dbInstance
        .prepare('DELETE FROM chat_messages WHERE created_at < ?')
        .run(cutoffDateStr);
      console.log(`已删除 ${chatResult.changes} 条过期聊天记录`);
    }
  } catch (error) {
    console.error('清理过期日志失败:', error);
  }

  startDatabaseBackupScheduler(dbInstance);
}

// 清理离职超过一周的员工数据
function cleanResignedEmployees(dbInstance: Database.Database) {
  try {
    const cutoffDate = formatChinaDateTime(Date.now() - 7 * 24 * 60 * 60 * 1000).slice(0, 10);

    // Keep resigned employee, salary, and work-hour history for upgrade safety.
    const row = dbInstance.prepare(`
      SELECT COUNT(*) as count FROM employees
      WHERE status = CAST(X'E7A6BBE8818C' AS TEXT)
        AND resign_date IS NOT NULL
        AND resign_date <= ?
    `).get(cutoffDate) as { count: number } | undefined;

    if ((row?.count || 0) > 0) {
      console.log(`Retained ${row?.count || 0} resigned employees older than 7 days; no salary/work-hour data was deleted.`);
    }
  } catch (e) {
    console.error('清理离职员工数据失败:', e);
  }
}

const validMonthlyRecordWhere = 'w.year BETWEEN 2000 AND 2100 AND w.month_num BETWEEN 1 AND 12';
const monthlyRecordSelect = `
  SELECT
    w.*,
    COALESCE(
      e.id,
      (SELECT e2.id FROM employees e2 WHERE e2.name = w.employee_name ORDER BY e2.id DESC LIMIT 1),
      w.employee_id
    ) as employee_id,
    COALESCE(e.name, w.employee_name, '') as employee_name,
    COALESCE(
      e.department,
      (SELECT e2.department FROM employees e2 WHERE e2.name = w.employee_name ORDER BY e2.id DESC LIMIT 1),
      ''
    ) as department
  FROM work_hours_monthly w
  LEFT JOIN employees e ON w.employee_id = e.id
`;

// 查询助手
export const query = {
  // 用户相关
  findUserByUsername: db.prepare(`
      SELECT u.*, COALESCE(d.name, d_text.name, u.department) as department, COALESCE(u.department_id, d_text.id) as department_id
      FROM users u 
      LEFT JOIN departments d ON u.department_id = d.id 
      LEFT JOIN departments d_text ON CAST(d_text.id AS TEXT) = u.department
      WHERE u.username = ?
    `),
  findUserById: db.prepare(`
      SELECT u.*, COALESCE(d.name, d_text.name, u.department) as department, COALESCE(u.department_id, d_text.id) as department_id
      FROM users u 
      LEFT JOIN departments d ON u.department_id = d.id 
      LEFT JOIN departments d_text ON CAST(d_text.id AS TEXT) = u.department
      WHERE u.id = ?
    `),
  getUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  createUser: db.prepare('INSERT INTO users (username, password, name, role, department, email) VALUES (?, ?, ?, ?, ?, ?)'),
  updateUser: db.prepare('UPDATE users SET name = ?, role = ?, department = ?, email = ? WHERE id = ?'),
  getAllUsers: db.prepare(`
    SELECT u.id, u.username, u.name, u.role, COALESCE(d.name, d_text.name, u.department) as department, COALESCE(u.department_id, d_text.id) as department_id, u.email, u.created_at
    FROM users u
    LEFT JOIN departments d ON u.department_id = d.id
    LEFT JOIN departments d_text ON CAST(d_text.id AS TEXT) = u.department
    ORDER BY u.created_at DESC
  `),
  updateUserPassword: db.prepare('UPDATE users SET password = ? WHERE id = ?'),
  deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),
  
  // 部门相关
  getAllDepartments: db.prepare('SELECT * FROM departments ORDER BY created_at DESC'),
  createDepartment: db.prepare('INSERT INTO departments (name, parent_id, manager, status) VALUES (?, ?, ?, ?)'),
  updateDepartment: db.prepare('UPDATE departments SET name = ?, manager = ?, status = ? WHERE id = ?'),
  deleteDepartment: db.prepare('DELETE FROM departments WHERE id = ?'),
  
  // 资产相关
  getAllAssets: db.prepare('SELECT * FROM assets ORDER BY created_at DESC'),
  getAssetById: db.prepare('SELECT * FROM assets WHERE id = ?'),
  getAssetsByType: db.prepare('SELECT * FROM assets WHERE type = ? ORDER BY created_at DESC'),
  createAsset: db.prepare('INSERT INTO assets (type, name, department, user, value, purchase_date, status, config, claim_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  updateAsset: db.prepare('UPDATE assets SET type = ?, name = ?, department = ?, user = ?, value = ?, purchase_date = ?, status = ?, config = ?, claim_time = ? WHERE id = ?'),
  deleteAsset: db.prepare('DELETE FROM assets WHERE id = ?'),
  
  // 线索相关
  getAllLeads: db.prepare('SELECT * FROM leads ORDER BY created_at DESC'),
  createLead: db.prepare('INSERT INTO leads (name, industry, level, source, phone, address, remark, creator, department, owner) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  updateLead: db.prepare('UPDATE leads SET name = ?, industry = ?, level = ?, source = ?, phone = ?, address = ?, remark = ?, owner = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  deleteLead: db.prepare('DELETE FROM leads WHERE id = ?'),
  
  // 客户相关
  getAllCustomers: db.prepare('SELECT * FROM customers ORDER BY created_at DESC'),
  createCustomer: db.prepare('INSERT INTO customers (name, level, source, phone, address, status, qualifications, creator, department, owner) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  updateCustomer: db.prepare('UPDATE customers SET name = ?, level = ?, source = ?, phone = ?, address = ?, status = ?, qualifications = ?, owner = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  deleteCustomer: db.prepare('DELETE FROM customers WHERE id = ?'),
  
  // 任务相关
  getAllTasks: db.prepare('SELECT * FROM tasks ORDER BY created_at DESC'),
  createTask: db.prepare('INSERT INTO tasks (name, type, priority, status, end_date, owner, department, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  updateTask: db.prepare('UPDATE tasks SET name = ?, type = ?, priority = ?, status = ?, end_date = ?, owner = ?, remark = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  deleteTask: db.prepare('DELETE FROM tasks WHERE id = ?'),
  
  // 分销商相关
  getAllDistributors: db.prepare('SELECT * FROM distributors ORDER BY created_at DESC'),
  createDistributor: db.prepare('INSERT INTO distributors (name, phone, level, sales, commission, status) VALUES (?, ?, ?, ?, ?, ?)'),
  updateDistributor: db.prepare('UPDATE distributors SET name = ?, phone = ?, level = ?, sales = ?, commission = ?, status = ? WHERE id = ?'),
  deleteDistributor: db.prepare('DELETE FROM distributors WHERE id = ?'),
  
  // 账户相关
  getAllAccounts: db.prepare('SELECT * FROM accounts ORDER BY created_at DESC'),
  createAccount: db.prepare('INSERT INTO accounts (name, type, balance, status, remark) VALUES (?, ?, ?, ?, ?)'),
  updateAccount: db.prepare('UPDATE accounts SET name = ?, type = ?, balance = ?, status = ?, remark = ? WHERE id = ?'),
  deleteAccount: db.prepare('DELETE FROM accounts WHERE id = ?'),
  
  // 待办事项相关
  getAllTodos: db.prepare('SELECT * FROM todos ORDER BY created_at DESC'),
  getTodosByCategory: db.prepare('SELECT * FROM todos WHERE category = ? ORDER BY created_at DESC'),
  createTodo: db.prepare('INSERT INTO todos (category, name, industry, level, source, phone, address, remark, creator, department, owner) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  updateTodo: db.prepare('UPDATE todos SET processed = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  deleteTodo: db.prepare('DELETE FROM todos WHERE id = ?'),
  
  // 用户管理相关
  getAllUsersDetail: db.prepare(`
      SELECT
        u.id,
        u.username,
        u.name,
        u.role,
        COALESCE(d.name, d_text.name, u.department) as department,
        COALESCE(u.department_id, d_text.id) as department_id,
        u.position_id,
        u.manager_id,
        manager.name as manager_name,
        u.email,
        u.created_at
      FROM users u 
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN departments d_text ON CAST(d_text.id AS TEXT) = u.department
      LEFT JOIN users manager ON manager.id = u.manager_id
    `),
  
  // 权限相关
  getAllPermissions: db.prepare('SELECT * FROM permissions ORDER BY id'),
  getUserPermissions: db.prepare(`
    SELECT p.code, p.name, up.granted 
    FROM permissions p 
    LEFT JOIN user_permissions up ON p.id = up.permission_id AND up.user_id = ?
  `),
  grantPermission: db.prepare(`
    INSERT OR REPLACE INTO user_permissions (user_id, permission_id, granted) 
    VALUES (?, ?, 1)
  `),
  revokePermission: db.prepare(`
    INSERT OR REPLACE INTO user_permissions (user_id, permission_id, granted) 
    VALUES (?, ?, 0)
  `),
  checkPermission: db.prepare(`
    SELECT granted FROM user_permissions WHERE user_id = ? AND permission_id = ?
  `),
  
  // 邮箱配置相关
  getEmailConfig: db.prepare('SELECT * FROM email_config ORDER BY id DESC LIMIT 1'),
  createEmailConfig: db.prepare('INSERT INTO email_config (host, port, secure, user, password, from_name, from_email) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  updateEmailConfig: db.prepare('UPDATE email_config SET host = ?, port = ?, secure = ?, user = ?, password = ?, from_name = ?, from_email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  
  // 企业微信机器人配置
  getWxWorkBotConfig: db.prepare('SELECT * FROM wxwork_bot_config WHERE id = 1'),
  saveWxWorkBotConfig: db.prepare(`
    UPDATE wxwork_bot_config 
    SET bot_id = ?, bot_secret = ?, api_url = ?, auth_token = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE id = 1
  `),
  
  // 验证码相关
  createVerificationCode: db.prepare('INSERT INTO verification_codes (email, code, type, expires_at) VALUES (?, ?, ?, ?)'),
  getVerificationCode: db.prepare("SELECT * FROM verification_codes WHERE email = ? AND code = ? AND type = ? AND used = 0 AND expires_at > datetime('now', '+8 hours') ORDER BY created_at DESC LIMIT 1"),
  markCodeUsed: db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?'),
  cleanupExpiredCodes: db.prepare("DELETE FROM verification_codes WHERE expires_at < datetime('now', '+8 hours')"),
  
  // 注册码相关
  createRegistrationCode: db.prepare('INSERT INTO registration_codes (code, created_by, expires_at, permissions, department_id, position_id) VALUES (?, ?, ?, ?, ?, ?)'),
  getRegistrationCode: db.prepare("SELECT * FROM registration_codes WHERE code = ? AND used = 0 AND (expires_at IS NULL OR expires_at > datetime('now', '+8 hours'))"),
  markRegistrationCodeUsed: db.prepare('UPDATE registration_codes SET used = 1, used_by = ?, used_at = CURRENT_TIMESTAMP WHERE id = ?'),
  getAllRegistrationCodes: db.prepare('SELECT r.*, u1.name as creator_name, u2.name as user_name FROM registration_codes r LEFT JOIN users u1 ON r.created_by = u1.id LEFT JOIN users u2 ON r.used_by = u2.id ORDER BY r.created_at DESC'),
  deleteRegistrationCode: db.prepare('DELETE FROM registration_codes WHERE id = ?'),
  
  // 员工相关
  getAllEmployees: db.prepare('SELECT * FROM employees ORDER BY created_at DESC'),
  getEmployeeById: db.prepare('SELECT * FROM employees WHERE id = ?'),
  getEmployeeByPhone: db.prepare('SELECT * FROM employees WHERE phone = ?'),
  getEmployeeByNameAndPhone: db.prepare('SELECT * FROM employees WHERE name = ? AND phone = ?'),
  getEmployeeByIdCard: db.prepare('SELECT * FROM employees WHERE id_card = ?'),
  getEmployeeByNameAndIdCard: db.prepare('SELECT * FROM employees WHERE name = ? AND id_card = ?'),
  getEmployeeByName: db.prepare('SELECT * FROM employees WHERE name = ? LIMIT 1'),
  createEmployee: db.prepare('INSERT INTO employees (name, id_card, phone, department, position, base_salary, status, employee_id, location, hire_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  updateEmployee: db.prepare('UPDATE employees SET name = ?, id_card = ?, phone = ?, department = ?, position = ?, base_salary = ?, status = ?, location = ? WHERE id = ?'),
  deleteEmployee: db.prepare('DELETE FROM employees WHERE id = ?'),
  
  // 员工工时记录
  getWorkRecordsByEmployee: db.prepare('SELECT * FROM employee_work_records WHERE employee_id = ? ORDER BY date DESC'),
  createWorkRecord: db.prepare('INSERT INTO employee_work_records (employee_id, date, shift, check_in_time, check_out_time, work_hours, overtime_hours, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  
  // 员工工资记录
  getSalaryRecordsByEmployee: db.prepare('SELECT * FROM employee_salary_records WHERE employee_id = ? ORDER BY month DESC'),
  createSalaryRecord: db.prepare('INSERT INTO employee_salary_records (employee_id, month, base_salary, overtime_hours, overtime_pay, bonus, deduction, actual_salary, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  updateSalaryRecordSignature: db.prepare('UPDATE employee_salary_records SET signature = ?, signature_time = CURRENT_TIMESTAMP WHERE id = ?'),
  
  // 工时月份汇总
  getWorkHoursMonthly: db.prepare(`${monthlyRecordSelect} WHERE ${validMonthlyRecordWhere} ORDER BY w.year DESC, w.month_num DESC, w.employee_id`),
  getWorkHoursMonthlyByEmployee: db.prepare('SELECT * FROM work_hours_monthly WHERE employee_id = ? AND year BETWEEN 2000 AND 2100 AND month_num BETWEEN 1 AND 12 ORDER BY year DESC, month_num DESC'),
  getWorkHoursMonthlyByMonth: db.prepare(`${monthlyRecordSelect} WHERE ${validMonthlyRecordWhere} AND w.month = ? ORDER BY w.employee_id`),
  getWorkHoursMonthlyByYearMonth: db.prepare(`${monthlyRecordSelect} WHERE ${validMonthlyRecordWhere} AND w.year = ? AND w.month_num = ? ORDER BY w.employee_id`),
  createWorkHoursMonthly: db.prepare('INSERT INTO work_hours_monthly (employee_id, month, total_days, work_hours, overtime_hours, weekend_overtime, details, employee_name, year, month_num, normal_hours, weekday_overtime, base_salary, normal_pay, weekday_overtime_pay, weekend_overtime_pay, total_payable, deduction, actual_amount, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  createWorkHoursMonthlySimple: db.prepare('INSERT INTO work_hours_monthly (employee_id, month, total_days, work_hours, overtime_hours, weekend_overtime, details) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  updateWorkHoursMonthly: db.prepare('UPDATE work_hours_monthly SET total_days = ?, work_hours = ?, overtime_hours = ?, weekend_overtime = ?, details = ? WHERE id = ?'),
  updateWorkHoursMonthlySignature: db.prepare('UPDATE work_hours_monthly SET signature = ?, signature_time = CURRENT_TIMESTAMP WHERE id = ?'),
  deleteWorkHoursMonthly: db.prepare('DELETE FROM work_hours_monthly WHERE id = ?'),
  deleteWorkHoursMonthlyByMonth: db.prepare('DELETE FROM work_hours_monthly WHERE month = ?'),
  deleteWorkHoursMonthlyByYearMonth: db.prepare('DELETE FROM work_hours_monthly WHERE year = ? AND month_num = ?'),
  
  // 联系人相关
  getAllContacts: db.prepare('SELECT * FROM contacts ORDER BY created_at DESC'),
  getContactsByCustomer: db.prepare('SELECT * FROM contacts WHERE customer_id = ? ORDER BY created_at DESC'),
  createContact: db.prepare('INSERT INTO contacts (name, customer_id, phone, email, position, department, remark, owner) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  updateContact: db.prepare('UPDATE contacts SET name = ?, phone = ?, email = ?, position = ?, department = ?, remark = ?, owner = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  deleteContact: db.prepare('DELETE FROM contacts WHERE id = ?'),
  
  // 合同相关
  getAllContracts: db.prepare('SELECT * FROM contracts ORDER BY created_at DESC'),
  getContractsByCustomer: db.prepare('SELECT * FROM contracts WHERE customer_id = ? ORDER BY created_at DESC'),
  getContractById: db.prepare('SELECT * FROM contracts WHERE id = ?'),
  createContract: db.prepare('INSERT INTO contracts (name, customer_id, customer_name, amount, start_date, end_date, status, type, sign_date, remark, owner) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  updateContract: db.prepare('UPDATE contracts SET name = ?, customer_name = ?, amount = ?, start_date = ?, end_date = ?, status = ?, type = ?, sign_date = ?, remark = ?, owner = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  deleteContract: db.prepare('DELETE FROM contracts WHERE id = ?'),
  
  // 发票相关
  getAllInvoices: db.prepare('SELECT * FROM invoices ORDER BY created_at DESC'),
  getInvoicesByContract: db.prepare('SELECT * FROM invoices WHERE contract_id = ? ORDER BY created_at DESC'),
  getInvoiceById: db.prepare('SELECT * FROM invoices WHERE id = ?'),
  createInvoice: db.prepare('INSERT INTO invoices (invoice_no, contract_id, customer_name, amount, tax, total, status, type, issue_date, remark, owner) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  updateInvoice: db.prepare('UPDATE invoices SET invoice_no = ?, customer_name = ?, amount = ?, tax = ?, total = ?, status = ?, type = ?, issue_date = ?, remark = ?, owner = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  deleteInvoice: db.prepare('DELETE FROM invoices WHERE id = ?'),
  
  // 回访相关
  getAllVisits: db.prepare('SELECT * FROM visits ORDER BY created_at DESC'),
  getVisitsByCustomer: db.prepare('SELECT * FROM visits WHERE customer_id = ? ORDER BY created_at DESC'),
  createVisit: db.prepare('INSERT INTO visits (customer_id, customer_name, contact_name, visit_date, visit_type, content, next_plan, satisfaction, owner) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  updateVisit: db.prepare('UPDATE visits SET customer_name = ?, contact_name = ?, visit_date = ?, visit_type = ?, content = ?, next_plan = ?, satisfaction = ?, owner = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  deleteVisit: db.prepare('DELETE FROM visits WHERE id = ?'),
  
  // 产品相关
  getAllProducts: db.prepare('SELECT * FROM products ORDER BY created_at DESC'),
  getProductById: db.prepare('SELECT * FROM products WHERE id = ?'),
  createProduct: db.prepare('INSERT INTO products (name, category, price, unit, stock, status, remark) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  updateProduct: db.prepare('UPDATE products SET name = ?, category = ?, price = ?, unit = ?, stock = ?, status = ?, remark = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  deleteProduct: db.prepare('DELETE FROM products WHERE id = ?'),
  
  // 财务明细相关
  getAllFinances: db.prepare('SELECT * FROM finances ORDER BY date DESC, created_at DESC'),
  getFinancesByType: db.prepare('SELECT * FROM finances WHERE type = ? ORDER BY date DESC'),
  getFinancesByDepartment: db.prepare('SELECT * FROM finances WHERE department = ? ORDER BY date DESC'),
  getFinancesByDateRange: db.prepare('SELECT * FROM finances WHERE date >= ? AND date <= ? ORDER BY date DESC'),
  createFinance: db.prepare('INSERT INTO finances (type, category, amount, date, related_id, related_type, remark, owner, department) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  updateFinance: db.prepare('UPDATE finances SET type = ?, category = ?, amount = ?, date = ?, remark = ?, owner = ?, department = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  deleteFinance: db.prepare('DELETE FROM finances WHERE id = ?'),
  
  // 嵌套结构查询方法（用于API）
  contacts: {
    getAll: db.prepare('SELECT * FROM contacts ORDER BY created_at DESC'),
    getByCustomer: db.prepare('SELECT * FROM contacts WHERE customer_id = ? ORDER BY is_primary DESC, created_at DESC'),
    getById: db.prepare('SELECT * FROM contacts WHERE id = ?'),
    create: db.prepare('INSERT INTO contacts (name, customer_id, phone, email, position, is_primary, remark) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    update: db.prepare('UPDATE contacts SET name = ?, customer_id = ?, phone = ?, email = ?, position = ?, is_primary = ?, remark = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
    delete: db.prepare('DELETE FROM contacts WHERE id = ?'),
  },
  contracts: {
    getAll: db.prepare('SELECT * FROM contracts ORDER BY created_at DESC'),
    getByCustomer: db.prepare('SELECT * FROM contracts WHERE customer_id = ? ORDER BY created_at DESC'),
    getById: db.prepare('SELECT * FROM contracts WHERE id = ?'),
    create: db.prepare('INSERT INTO contracts (contract_no, customer_id, customer_name, name, amount, start_date, end_date, status, signatory, content, remark, owner, proof_file, proof_file_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    update: db.prepare('UPDATE contracts SET contract_no = ?, customer_id = ?, customer_name = ?, name = ?, amount = ?, start_date = ?, end_date = ?, status = ?, signatory = ?, content = ?, remark = ?, owner = ?, proof_file = ?, proof_file_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
    delete: db.prepare('DELETE FROM contracts WHERE id = ?'),
  },
  invoices: {
    getAll: db.prepare('SELECT * FROM invoices ORDER BY created_at DESC'),
    getByContract: db.prepare('SELECT * FROM invoices WHERE contract_id = ? ORDER BY created_at DESC'),
    getById: db.prepare('SELECT * FROM invoices WHERE id = ?'),
    create: db.prepare('INSERT INTO invoices (invoice_no, contract_id, customer_name, type, amount, tax_rate, tax_amount, issue_date, status, remark, owner, proof_file, proof_file_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    update: db.prepare('UPDATE invoices SET invoice_no = ?, contract_id = ?, customer_name = ?, type = ?, amount = ?, tax_rate = ?, tax_amount = ?, issue_date = ?, status = ?, remark = ?, owner = ?, proof_file = ?, proof_file_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
    delete: db.prepare('DELETE FROM invoices WHERE id = ?'),
  },
  visits: {
    getAll: db.prepare('SELECT * FROM visits ORDER BY created_at DESC'),
    getByCustomer: db.prepare('SELECT * FROM visits WHERE customer_id = ? ORDER BY created_at DESC'),
    getById: db.prepare('SELECT * FROM visits WHERE id = ?'),
    create: db.prepare('INSERT INTO visits (customer_id, customer_name, contact_name, visit_date, visit_type, content, next_plan, satisfaction, owner) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    update: db.prepare('UPDATE visits SET customer_id = ?, customer_name = ?, contact_name = ?, visit_date = ?, visit_type = ?, content = ?, next_plan = ?, satisfaction = ?, owner = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
    delete: db.prepare('DELETE FROM visits WHERE id = ?'),
  },
  products: {
    getAll: db.prepare('SELECT * FROM products ORDER BY created_at DESC'),
    getById: db.prepare('SELECT * FROM products WHERE id = ?'),
    create: db.prepare('INSERT INTO products (name, category, price, unit, stock, status, remark) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    update: db.prepare('UPDATE products SET name = ?, category = ?, price = ?, unit = ?, stock = ?, status = ?, remark = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
    delete: db.prepare('DELETE FROM products WHERE id = ?'),
  },
  finances: {
    getAll: db.prepare('SELECT * FROM finances ORDER BY date DESC, created_at DESC'),
    getByType: db.prepare('SELECT * FROM finances WHERE type = ? ORDER BY date DESC'),
    getByDepartment: db.prepare('SELECT * FROM finances WHERE department = ? ORDER BY date DESC'),
    getByDateRange: db.prepare('SELECT * FROM finances WHERE date >= ? AND date <= ? ORDER BY date DESC'),
    create: db.prepare('INSERT INTO finances (type, category, amount, date, related_id, related_type, remark, owner, department, proof_file, proof_file_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    update: db.prepare('UPDATE finances SET type = ?, category = ?, amount = ?, date = ?, related_id = ?, related_type = ?, remark = ?, owner = ?, department = ?, proof_file = ?, proof_file_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
    delete: db.prepare('DELETE FROM finances WHERE id = ?'),
  },
  notifications: {
    getAll: db.prepare('SELECT * FROM notifications ORDER BY created_at DESC LIMIT ? OFFSET ?'),
    getAllCount: db.prepare('SELECT COUNT(*) as count FROM notifications'),
    getByReceiver: db.prepare('SELECT * FROM notifications WHERE receiver_id = ? ORDER BY created_at DESC'),
    getBySender: db.prepare('SELECT * FROM notifications WHERE sender_id = ? ORDER BY created_at DESC'),
    getUnreadByReceiver: db.prepare('SELECT * FROM notifications WHERE receiver_id = ? AND is_read = 0 ORDER BY created_at DESC'),
    getUnreadCount: db.prepare('SELECT COUNT(*) as count FROM notifications WHERE receiver_id = ? AND is_read = 0'),
    getById: db.prepare('SELECT * FROM notifications WHERE id = ?'),
    create: db.prepare('INSERT INTO notifications (title, content, sender_id, sender_name, receiver_id, receiver_name, type, email_sent, email_error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    markAsRead: db.prepare('UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE id = ?'),
    markAllAsRead: db.prepare('UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE receiver_id = ? AND is_read = 0'),
    updateEmailSent: db.prepare('UPDATE notifications SET email_sent = 1 WHERE id = ?'),
    updateEmailError: db.prepare('UPDATE notifications SET email_error = ? WHERE id = ?'),
    delete: db.prepare('DELETE FROM notifications WHERE id = ?'),
    deleteByReceiver: db.prepare('DELETE FROM notifications WHERE receiver_id = ?'),
  },
  operationLogs: {
    getAll: db.prepare('SELECT ol.*, u.name as user_name FROM operation_logs ol LEFT JOIN users u ON ol.user_id = u.id ORDER BY ol.created_at DESC LIMIT ? OFFSET ?'),
    getAllCount: db.prepare('SELECT COUNT(*) as count FROM operation_logs'),
    getByUserId: db.prepare('SELECT * FROM operation_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'),
    getByModule: db.prepare('SELECT ol.*, u.name as user_name FROM operation_logs ol LEFT JOIN users u ON ol.user_id = u.id WHERE ol.module = ? ORDER BY ol.created_at DESC'),
    create: db.prepare('INSERT INTO operation_logs (user_id, username, module, action, description, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
    deleteOld: db.prepare("DELETE FROM operation_logs WHERE created_at < datetime('now', '+8 hours', '-90 days')"),
  },
  
  // 职位层级相关
  positions: {
    getAll: db.prepare(`SELECT p.*, d.name as department_name FROM positions p LEFT JOIN departments d ON p.department_id = d.id ORDER BY p.level DESC, p.created_at DESC`),
    getById: db.prepare('SELECT * FROM positions WHERE id = ?'),
    getByDepartment: db.prepare('SELECT * FROM positions WHERE department_id = ? ORDER BY level DESC'),
    getByName: db.prepare('SELECT * FROM positions WHERE name = ?'),
    create: db.prepare('INSERT INTO positions (name, level, department_id, can_approve_purchase, can_approve_expense, approval_limit, remark) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    update: db.prepare('UPDATE positions SET name = ?, level = ?, department_id = ?, can_approve_purchase = ?, can_approve_expense = ?, approval_limit = ?, remark = ? WHERE id = ?'),
    delete: db.prepare('DELETE FROM positions WHERE id = ?'),
  },
  
  // 请购单相关
  purchaseRequests: {
    getAll: db.prepare('SELECT * FROM purchase_requests ORDER BY created_at DESC'),
    getById: db.prepare('SELECT * FROM purchase_requests WHERE id = ?'),
    getByNo: db.prepare('SELECT * FROM purchase_requests WHERE request_no = ?'),
    getByApplicant: db.prepare('SELECT * FROM purchase_requests WHERE applicant_id = ? ORDER BY created_at DESC'),
    getByStatus: db.prepare('SELECT * FROM purchase_requests WHERE status = ? ORDER BY created_at DESC'),
    getByCurrentApprover: db.prepare('SELECT * FROM purchase_requests WHERE current_approver_id = ? AND status = ? ORDER BY created_at DESC'),
    getPendingByApprover: db.prepare("SELECT * FROM purchase_requests WHERE current_approver_id = ? AND status = '待审批' ORDER BY created_at DESC"),
    create: db.prepare('INSERT INTO purchase_requests (request_no, title, applicant_id, applicant_name, department, items, total_amount, reason, urgency, proof_file, proof_file_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    update: db.prepare('UPDATE purchase_requests SET title = ?, department = ?, items = ?, total_amount = ?, reason = ?, urgency = ?, proof_file = ?, proof_file_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
    updateStatus: db.prepare('UPDATE purchase_requests SET status = ?, current_approver_id = ?, current_approver_name = ?, updated_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP WHERE id = ?'),
    delete: db.prepare('DELETE FROM purchase_requests WHERE id = ?'),
  },
  
  // 费用报销相关
  expenseClaims: {
    getAll: db.prepare('SELECT * FROM expense_claims ORDER BY created_at DESC'),
    getById: db.prepare('SELECT * FROM expense_claims WHERE id = ?'),
    getByNo: db.prepare('SELECT * FROM expense_claims WHERE claim_no = ?'),
    getByApplicant: db.prepare('SELECT * FROM expense_claims WHERE applicant_id = ? ORDER BY created_at DESC'),
    getByStatus: db.prepare('SELECT * FROM expense_claims WHERE status = ? ORDER BY created_at DESC'),
    getByCurrentApprover: db.prepare('SELECT * FROM expense_claims WHERE current_approver_id = ? AND status = ? ORDER BY created_at DESC'),
    getPendingByApprover: db.prepare("SELECT * FROM expense_claims WHERE current_approver_id = ? AND status = '待审批' ORDER BY created_at DESC"),
    create: db.prepare('INSERT INTO expense_claims (claim_no, title, applicant_id, applicant_name, department, expense_type, expense_date, items, total_amount, description, proof_file, proof_file_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
    update: db.prepare('UPDATE expense_claims SET title = ?, department = ?, expense_type = ?, expense_date = ?, items = ?, total_amount = ?, description = ?, proof_file = ?, proof_file_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
    updateStatus: db.prepare('UPDATE expense_claims SET status = ?, current_approver_id = ?, current_approver_name = ?, updated_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP WHERE id = ?'),
    delete: db.prepare('DELETE FROM expense_claims WHERE id = ?'),
  },
  
  // 审批记录相关
  approvalRecords: {
    getAll: db.prepare('SELECT * FROM approval_records ORDER BY created_at DESC'),
    getByDoc: db.prepare('SELECT * FROM approval_records WHERE doc_type = ? AND doc_id = ? ORDER BY approval_order ASC, created_at ASC'),
    getByApprover: db.prepare('SELECT * FROM approval_records WHERE approver_id = ? ORDER BY created_at DESC'),
    create: db.prepare('INSERT INTO approval_records (doc_type, doc_id, doc_no, approver_id, approver_name, action, comment, approval_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
    getNextOrder: db.prepare('SELECT COALESCE(MAX(approval_order), 0) + 1 as next_order FROM approval_records WHERE doc_type = ? AND doc_id = ?'),
  },
  
  // 部门相关
  departments: {
    getAll: db.prepare(`
      SELECT d.*, 
             pd.name AS parent_name,
             u.name AS manager_name_full
      FROM departments d
      LEFT JOIN departments pd ON d.parent_id = pd.id
      LEFT JOIN users u ON d.manager_id = u.id
      ORDER BY d.created_at DESC
    `),
    getById: db.prepare(`
      SELECT d.*, 
             pd.name AS parent_name,
             u.name AS manager_name_full
      FROM departments d
      LEFT JOIN departments pd ON d.parent_id = pd.id
      LEFT JOIN users u ON d.manager_id = u.id
      WHERE d.id = ?
    `),
    getByName: db.prepare('SELECT * FROM departments WHERE name = ?'),
    getByParent: db.prepare(`
      SELECT d.*, 
             pd.name AS parent_name,
             u.name AS manager_name_full
      FROM departments d
      LEFT JOIN departments pd ON d.parent_id = pd.id
      LEFT JOIN users u ON d.manager_id = u.id
      WHERE d.parent_id = ?
      ORDER BY d.created_at DESC
    `),
    getRoot: db.prepare(`
      SELECT d.*, 
             pd.name AS parent_name,
             u.name AS manager_name_full
      FROM departments d
      LEFT JOIN departments pd ON d.parent_id = pd.id
      LEFT JOIN users u ON d.manager_id = u.id
      WHERE d.parent_id IS NULL
      ORDER BY d.created_at DESC
    `),
    create: db.prepare('INSERT INTO departments (name, parent_id, manager_id, manager_name, description) VALUES (?, ?, ?, ?, ?)'),
    update: db.prepare('UPDATE departments SET name = ?, parent_id = ?, manager_id = ?, manager_name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
    delete: db.prepare('DELETE FROM departments WHERE id = ?'),
  },
  
  // 消息相关
  messages: {
    getAll: db.prepare('SELECT * FROM messages ORDER BY created_at DESC'),
    getById: db.prepare('SELECT * FROM messages WHERE id = ?'),
    getByUser: db.prepare('SELECT * FROM messages WHERE user_id = ? ORDER BY created_at DESC'),
    getUnreadByUser: db.prepare('SELECT * FROM messages WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC'),
    getUnreadCount: db.prepare('SELECT COUNT(*) as count FROM messages WHERE user_id = ? AND is_read = 0'),
    create: db.prepare('INSERT INTO messages (user_id, title, content, type, related_doc_type, related_doc_id) VALUES (?, ?, ?, ?, ?, ?)'),
    markRead: db.prepare('UPDATE messages SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE id = ?'),
    markAllRead: db.prepare('UPDATE messages SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND is_read = 0'),
    delete: db.prepare('DELETE FROM messages WHERE id = ?'),
  },
};

// 服务端日志记录函数
export function logOperationServer(params: {
  userId?: number | null;
  userName: string;
  module: string;
  action: string;
  details?: string | object;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  try {
    const description = typeof params.details === 'object' 
      ? JSON.stringify(params.details) 
      : (params.details || '');
    
    query.operationLogs.create.run(
      params.userId || null,
      params.userName,
      params.module,
      params.action,
      description,
      params.ipAddress || null,
      params.userAgent || null,
      chinaNowSql()
    );
    console.log('操作日志记录成功:', params.module, params.action, params.userName);
  } catch (error) {
    console.error('记录操作日志失败:', error);
  }
}

// ========== 审批流程辅助函数 ==========

// 获取用户的上级审批链（按层级从低到高排列）
// 新逻辑：基于角色和部门确定审批链
// 1. 普通用户 -> 部门经理 -> 管理员
// 2. 部门经理 -> 管理员
// 3. 管理员 -> 无需审批
export function getApproverChain(userId: number): Array<{ id: number; name: string; level: number; approvalLimit: number }> {
  const approvers: Array<{ id: number; name: string; level: number; approvalLimit: number }> = [];
  const visitedIds = new Set<number>([userId]); // 防止循环
  
  try {
    // 获取当前用户信息
    const user = query.findUserById.get(userId) as { id: number; name: string; role?: string; department?: string; manager_id?: number; position_id?: number } | undefined;
    if (!user) return approvers;
    
    const userRole = user.role || 'user';
    
    // 如果是管理员或财务，不需要审批
    if (userRole === 'admin' || userRole === 'super_admin' || userRole === 'finance') {
      return approvers;
    }
    
    // 获取用户职位信息
    let positionApprovalLimit = 0;
    if (user.position_id) {
      const position = query.positions.getById.get(user.position_id) as { approval_limit: number } | undefined;
      positionApprovalLimit = position?.approval_limit || 0;
    }
    
    // 审批链流程：
    // 1. 直属上级（如果设置）
    // 2. 部门经理
    // 3. 财务（最终审批）
    
    // 第一步：查找直属上级（如果设置了）
    if (user.manager_id) {
      const manager = query.findUserById.get(user.manager_id) as { id: number; name: string; role?: string; position_id?: number } | undefined;
      if (manager && !visitedIds.has(manager.id)) {
        visitedIds.add(manager.id);
        
        // 获取上级职位的审批限额
        let managerLimit = 10000; // 默认限额
        if (manager.position_id) {
          const mgrPosition = query.positions.getById.get(manager.position_id) as { approval_limit: number } | undefined;
          managerLimit = mgrPosition?.approval_limit || 10000;
        }
        
        approvers.push({
          id: manager.id,
          name: manager.name,
          level: 1,
          approvalLimit: managerLimit
        });
      }
    }
    
    // 第二步：查找部门经理（如果直属上级不是部门经理）
    const userDept = user.department || '';
    if (userDept) {
      const deptManager = db.prepare('SELECT id, name FROM users WHERE department = ? AND role = ?').get(userDept, 'manager') as { id: number; name: string; position_id?: number } | undefined;
      if (deptManager && !visitedIds.has(deptManager.id)) {
        visitedIds.add(deptManager.id);
        
        // 获取部门经理职位的审批限额
        let deptManagerLimit = 50000;
        if (deptManager.position_id) {
          const dmPosition = query.positions.getById.get(deptManager.position_id) as { approval_limit: number } | undefined;
          deptManagerLimit = dmPosition?.approval_limit || 50000;
        }
        
        approvers.push({
          id: deptManager.id,
          name: deptManager.name,
          level: 2,
          approvalLimit: deptManagerLimit
        });
      }
    }
    
    // 第三步：查找财务作为最终审批人
    const financeUsers = db.prepare('SELECT id, name FROM users WHERE role = ?').all('finance') as Array<{ id: number; name: string }>;
    for (const finance of financeUsers) {
      if (!visitedIds.has(finance.id)) {
        approvers.push({
          id: finance.id,
          name: finance.name,
          level: 99,
          approvalLimit: 999999999
        });
      }
    }
    
    // 如果没有财务用户，添加管理员作为备选
    if (financeUsers.length === 0) {
      const admins = db.prepare('SELECT id, name FROM users WHERE role = ? OR role = ?').all('admin', 'super_admin') as Array<{ id: number; name: string }>;
      for (const admin of admins) {
        if (!visitedIds.has(admin.id)) {
          approvers.push({
            id: admin.id,
            name: admin.name,
            level: 99,
            approvalLimit: 999999999
          });
        }
      }
    }
    
  } catch (error) {
    console.error('获取审批链失败:', error);
  }
  
  return approvers;
}

// 获取用户可查看的下属用户ID列表（包括自己）
// 新逻辑：基于角色和部门确定权限范围
// 1. 管理员：可查看所有用户
// 2. 部门经理：可查看本部门所有用户
// 3. 普通用户：只能查看自己
export function getSubordinateUserIds(userId: number): number[] {
  const userIds: number[] = [userId];
  
  try {
    // 获取当前用户信息
    const user = query.findUserById.get(userId) as { id: number; name: string; role?: string; department?: string; manager_id?: number } | undefined;
    if (!user) return userIds;
    
    const userRole = user.role || 'user';
    const userDept = user.department || '';
    
    // 如果是管理员，可以查看所有
    if (userRole === 'admin' || userRole === 'super_admin') {
      const allUsers = query.getAllUsers.all() as Array<{ id: number }>;
      return allUsers.map(u => u.id);
    }
    
    // 如果是部门经理，可以查看本部门所有用户
    if (userRole === 'manager' && userDept) {
      const deptUsers = db.prepare('SELECT id FROM users WHERE department = ?').all(userDept) as Array<{ id: number }>;
      for (const du of deptUsers) {
        if (!userIds.includes(du.id)) {
          userIds.push(du.id);
        }
      }
    }
    
    // 查找直属下属（manager_id 指向当前用户的用户）
    const directSubordinates = db.prepare('SELECT id FROM users WHERE manager_id = ?').all(userId) as Array<{ id: number }>;
    for (const sub of directSubordinates) {
      if (!userIds.includes(sub.id)) {
        userIds.push(sub.id);
      }
    }
    
  } catch (error) {
    console.error('获取下属用户ID失败:', error);
  }
  
  return userIds;
}

// 生成单据编号
export function generateDocNo(prefix: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `${prefix}${year}${month}${day}${random}`;
}
