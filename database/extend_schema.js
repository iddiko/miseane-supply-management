const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'supply_management.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 데이터베이스 스키마 확장 시작...');

const extensionQueries = [
    // 제품 테이블에 수익 계산 필드 추가
    `ALTER TABLE products ADD COLUMN cost_qty DECIMAL(10,2) DEFAULT 1.0`,
    `ALTER TABLE products ADD COLUMN cost_unit_price DECIMAL(10,2) DEFAULT 0.0`,
    `ALTER TABLE products ADD COLUMN cost_total DECIMAL(10,2) DEFAULT 0.0`,
    `ALTER TABLE products ADD COLUMN supply_price DECIMAL(10,2) DEFAULT 0.0`,
    `ALTER TABLE products ADD COLUMN sale_price DECIMAL(10,2) DEFAULT 0.0`,
    `ALTER TABLE products ADD COLUMN deposit DECIMAL(10,2) DEFAULT 0.0`,
    `ALTER TABLE products ADD COLUMN one_time_fee BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE products ADD COLUMN profit_rule_id INTEGER`,

    // 제품 가격 변동 이력 테이블
    `CREATE TABLE IF NOT EXISTS product_price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        field_name VARCHAR(50) NOT NULL,
        old_value DECIMAL(10,2),
        new_value DECIMAL(10,2),
        changed_by INTEGER,
        change_reason TEXT,
        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (changed_by) REFERENCES users(id)
    )`,

    // 역할 및 권한 테이블
    `CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(50) NOT NULL UNIQUE,
        display_name VARCHAR(100) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name VARCHAR(100) NOT NULL UNIQUE,
        display_name VARCHAR(150) NOT NULL,
        description TEXT,
        resource VARCHAR(50) NOT NULL,
        action VARCHAR(20) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS role_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_id INTEGER NOT NULL,
        permission_id INTEGER NOT NULL,
        granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles(id),
        FOREIGN KEY (permission_id) REFERENCES permissions(id),
        UNIQUE(role_id, permission_id)
    )`,

    // 사용자 테이블에 역할 참조 추가를 위한 새 컬럼
    `ALTER TABLE users ADD COLUMN role_id INTEGER`,

    // 사이트(거래처) 관리 테이블
    `CREATE TABLE IF NOT EXISTS sites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_code VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(30) NOT NULL, -- 요양원, 경로당, 병원, 기타
        address TEXT,
        contact_person VARCHAR(50),
        contact_phone VARCHAR(20),
        contact_email VARCHAR(100),
        population INTEGER, -- 인원수
        rooms INTEGER, -- 방 수
        beds INTEGER, -- 병상 수
        contract_start_date DATE,
        contract_end_date DATE,
        status VARCHAR(20) DEFAULT 'active', -- active, inactive, suspended
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // 사이트별 제품 할당 테이블
    `CREATE TABLE IF NOT EXISTS site_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity_default INTEGER NOT NULL DEFAULT 0,
        sale_price_override DECIMAL(10,2), -- 사이트별 가격 조정
        supply_price_override DECIMAL(10,2),
        is_active BOOLEAN DEFAULT TRUE,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (site_id) REFERENCES sites(id),
        FOREIGN KEY (product_id) REFERENCES products(id),
        UNIQUE(site_id, product_id)
    )`,

    // 배분 규칙 테이블
    `CREATE TABLE IF NOT EXISTS distribution_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_name VARCHAR(100) NOT NULL,
        product_id INTEGER, -- NULL이면 전사 공통 룰
        site_type VARCHAR(30), -- NULL이면 모든 사이트 타입
        region_type VARCHAR(20) DEFAULT 'nationwide', -- nationwide, region, district, branch
        distribution_json TEXT NOT NULL, -- JSON 형태의 배분 비율
        applies_from DATE NOT NULL,
        applies_to DATE,
        is_active BOOLEAN DEFAULT TRUE,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
    )`,

    // 수익 계산 트랜잭션 테이블
    `CREATE TABLE IF NOT EXISTS revenue_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_type VARCHAR(20) NOT NULL, -- sale, simulation, adjustment
        site_id INTEGER,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        unit_sale_price DECIMAL(10,2) NOT NULL,
        unit_supply_price DECIMAL(10,2) NOT NULL,
        unit_cost DECIMAL(10,2) NOT NULL,
        total_revenue DECIMAL(15,2) NOT NULL,
        total_cost DECIMAL(15,2) NOT NULL,
        gross_profit DECIMAL(15,2) NOT NULL,
        distribution_rule_id INTEGER,
        distribution_details TEXT, -- JSON 형태의 배분 세부사항
        transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_by INTEGER,
        notes TEXT,
        FOREIGN KEY (site_id) REFERENCES sites(id),
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (distribution_rule_id) REFERENCES distribution_rules(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
    )`,

    // 감사 로그 테이블
    `CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action_type VARCHAR(50) NOT NULL,
        table_name VARCHAR(50) NOT NULL,
        record_id INTEGER,
        before_data TEXT, -- JSON
        after_data TEXT, -- JSON
        ip_address VARCHAR(45),
        user_agent TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`
];

// 기본 역할 데이터
const defaultRoles = [
    { name: 'superadmin', display_name: '시스템 관리자', description: '시스템 최상위 권한' },
    { name: 'hq_admin', display_name: '본사 관리자', description: '제품/정책/정산의 최종 결정권자' },
    { name: 'regional_admin', display_name: '지사 관리자', description: '지역 단위 운영' },
    { name: 'branch_admin', display_name: '지점 관리자', description: '현장 운영' },
    { name: 'partner', display_name: '협력사', description: '납품/유통 파트너' },
    { name: 'hospital_user', display_name: '병원/요양원 담당자', description: '고객사 담당자' },
    { name: 'data_entry', display_name: '데이터 입력 담당', description: '데이터 입력 담당' },
    { name: 'auditor', display_name: '회계/감사 담당', description: '회계/감사 담당' }
];

// 기본 권한 데이터
const defaultPermissions = [
    // 제품 관리
    { name: 'product_create', display_name: '제품 생성', description: '새 제품 등록', resource: 'products', action: 'create' },
    { name: 'product_read', display_name: '제품 조회', description: '제품 정보 조회', resource: 'products', action: 'read' },
    { name: 'product_update', display_name: '제품 수정', description: '제품 정보 수정', resource: 'products', action: 'update' },
    { name: 'product_delete', display_name: '제품 삭제', description: '제품 삭제', resource: 'products', action: 'delete' },
    { name: 'price_update', display_name: '가격 수정', description: '제품 가격 수정', resource: 'products', action: 'price_update' },

    // 사이트 관리
    { name: 'site_create', display_name: '사이트 생성', description: '새 사이트 등록', resource: 'sites', action: 'create' },
    { name: 'site_read', display_name: '사이트 조회', description: '사이트 정보 조회', resource: 'sites', action: 'read' },
    { name: 'site_update', display_name: '사이트 수정', description: '사이트 정보 수정', resource: 'sites', action: 'update' },
    { name: 'site_delete', display_name: '사이트 삭제', description: '사이트 삭제', resource: 'sites', action: 'delete' },

    // 보고서
    { name: 'report_sales', display_name: '매출 보고서', description: '매출 보고서 조회', resource: 'reports', action: 'sales' },
    { name: 'report_profit', display_name: '수익 보고서', description: '수익 보고서 조회', resource: 'reports', action: 'profit' },
    { name: 'report_distribution', display_name: '배분 보고서', description: '배분 보고서 조회', resource: 'reports', action: 'distribution' },

    // 사용자 관리
    { name: 'user_create', display_name: '사용자 생성', description: '새 사용자 등록', resource: 'users', action: 'create' },
    { name: 'user_read', display_name: '사용자 조회', description: '사용자 정보 조회', resource: 'users', action: 'read' },
    { name: 'user_update', display_name: '사용자 수정', description: '사용자 정보 수정', resource: 'users', action: 'update' },

    // 설정 관리
    { name: 'settings_distribution', display_name: '배분 규칙 설정', description: '배분 규칙 설정', resource: 'settings', action: 'distribution' },
    { name: 'settings_system', display_name: '시스템 설정', description: '시스템 설정', resource: 'settings', action: 'system' }
];

// 기본 배분 규칙
const defaultDistributionRule = {
    rule_name: '기본 배분 규칙',
    product_id: null,
    site_type: null,
    region_type: 'nationwide',
    distribution_json: JSON.stringify({
        factory: 0.32,
        hq: 0.03,
        regional: 0.25,
        branch: 0.02,
        nationwide: 0.02,
        local: 0.03,
        area: 0.05,
        hospital: 0.30
    }),
    applies_from: new Date().toISOString().split('T')[0],
    is_active: true
};

db.serialize(() => {
    // 스키마 확장
    console.log('📊 테이블 구조 확장 중...');
    extensionQueries.forEach((query, index) => {
        db.run(query, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error(`Query ${index + 1} failed:`, err.message);
            } else {
                console.log(`✅ Query ${index + 1} executed successfully`);
            }
        });
    });

    // 기본 역할 데이터 삽입
    console.log('\n👥 기본 역할 데이터 삽입 중...');
    const insertRole = db.prepare('INSERT OR IGNORE INTO roles (name, display_name, description) VALUES (?, ?, ?)');
    defaultRoles.forEach(role => {
        insertRole.run(role.name, role.display_name, role.description);
    });
    insertRole.finalize();

    // 기본 권한 데이터 삽입
    console.log('🔑 기본 권한 데이터 삽입 중...');
    const insertPermission = db.prepare('INSERT OR IGNORE INTO permissions (name, display_name, description, resource, action) VALUES (?, ?, ?, ?, ?)');
    defaultPermissions.forEach(perm => {
        insertPermission.run(perm.name, perm.display_name, perm.description, perm.resource, perm.action);
    });
    insertPermission.finalize();

    // 기본 배분 규칙 삽입
    console.log('📈 기본 배분 규칙 삽입 중...');
    const insertDistRule = db.prepare('INSERT OR IGNORE INTO distribution_rules (rule_name, product_id, site_type, region_type, distribution_json, applies_from, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)');
    insertDistRule.run(
        defaultDistributionRule.rule_name,
        defaultDistributionRule.product_id,
        defaultDistributionRule.site_type,
        defaultDistributionRule.region_type,
        defaultDistributionRule.distribution_json,
        defaultDistributionRule.applies_from,
        defaultDistributionRule.is_active
    );
    insertDistRule.finalize();

    // 관리자 계정에 역할 할당
    console.log('👑 관리자 계정 역할 할당 중...');
    db.run(`UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'superadmin') WHERE email = 'admin@miseane.com'`, (err) => {
        if (err) {
            console.error('Admin role assignment failed:', err);
        } else {
            console.log('✅ Admin account role assigned');
        }
    });

    console.log('\n🎉 데이터베이스 스키마 확장 완료!');
    console.log('✨ B2B 제품 공급 시스템을 위한 확장된 기능들이 추가되었습니다.');

    db.close();
});