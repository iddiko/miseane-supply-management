const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'supply_management.db');

// 데이터베이스 연결
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('데이터베이스 연결 오류:', err.message);
    } else {
        console.log('SQLite 데이터베이스에 연결되었습니다.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    // 외래 키 제약 조건 활성화
    db.run("PRAGMA foreign_keys = ON");

    // 사용자 테이블
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            full_name VARCHAR(100) NOT NULL,
            role TEXT CHECK(role IN ('admin', 'purchaser', 'warehouse', 'quality')) NOT NULL DEFAULT 'warehouse',
            department VARCHAR(50),
            phone VARCHAR(20),
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 공급업체 테이블
    db.run(`
        CREATE TABLE IF NOT EXISTS suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            supplier_code VARCHAR(20) UNIQUE NOT NULL,
            name VARCHAR(100) NOT NULL,
            contact_person VARCHAR(50),
            email VARCHAR(100),
            phone VARCHAR(20),
            address TEXT,
            country VARCHAR(50),
            tax_number VARCHAR(30),
            payment_terms INTEGER DEFAULT 30,
            rating INTEGER CHECK(rating >= 1 AND rating <= 5),
            status TEXT CHECK(status IN ('active', 'inactive', 'suspended')) DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 제품 카테고리 테이블
    db.run(`
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(50) NOT NULL,
            description TEXT,
            parent_id INTEGER REFERENCES categories(id),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 제품 테이블
    db.run(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_code VARCHAR(30) UNIQUE NOT NULL,
            name VARCHAR(100) NOT NULL,
            description TEXT,
            category_id INTEGER NOT NULL REFERENCES categories(id),
            unit VARCHAR(20) NOT NULL DEFAULT 'ea',
            unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
            supplier_id INTEGER REFERENCES suppliers(id),
            min_stock_level INTEGER DEFAULT 0,
            max_stock_level INTEGER DEFAULT 1000,
            shelf_life_days INTEGER DEFAULT 365,
            storage_conditions TEXT,
            specifications TEXT,
            image_url VARCHAR(255),
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 재고 테이블
    db.run(`
        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL REFERENCES products(id),
            location VARCHAR(50) NOT NULL DEFAULT 'MAIN_WAREHOUSE',
            batch_number VARCHAR(50),
            quantity INTEGER NOT NULL DEFAULT 0,
            reserved_quantity INTEGER DEFAULT 0,
            unit_cost DECIMAL(10,2) DEFAULT 0,
            expiry_date DATE,
            received_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 구매 주문 테이블
    db.run(`
        CREATE TABLE IF NOT EXISTS purchase_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            po_number VARCHAR(30) UNIQUE NOT NULL,
            supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
            requested_by INTEGER NOT NULL REFERENCES users(id),
            approved_by INTEGER REFERENCES users(id),
            status TEXT CHECK(status IN ('draft', 'pending', 'approved', 'sent', 'partial', 'completed', 'cancelled')) DEFAULT 'draft',
            order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            expected_delivery DATE,
            total_amount DECIMAL(15,2) DEFAULT 0,
            notes TEXT,
            approved_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 구매 주문 상세 테이블
    db.run(`
        CREATE TABLE IF NOT EXISTS purchase_order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            po_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(id),
            quantity INTEGER NOT NULL,
            unit_price DECIMAL(10,2) NOT NULL,
            total_price DECIMAL(10,2) NOT NULL,
            received_quantity INTEGER DEFAULT 0,
            notes TEXT
        )
    `);

    // 입고 테이블
    db.run(`
        CREATE TABLE IF NOT EXISTS shipments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shipment_number VARCHAR(30) UNIQUE NOT NULL,
            po_id INTEGER REFERENCES purchase_orders(id),
            supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
            received_by INTEGER REFERENCES users(id),
            status TEXT CHECK(status IN ('pending', 'partial', 'completed', 'damaged', 'rejected')) DEFAULT 'pending',
            tracking_number VARCHAR(50),
            shipped_date DATETIME,
            received_date DATETIME,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 입고 상세 테이블
    db.run(`
        CREATE TABLE IF NOT EXISTS shipment_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(id),
            po_item_id INTEGER REFERENCES purchase_order_items(id),
            expected_quantity INTEGER NOT NULL,
            received_quantity INTEGER DEFAULT 0,
            damaged_quantity INTEGER DEFAULT 0,
            batch_number VARCHAR(50),
            expiry_date DATE,
            unit_cost DECIMAL(10,2),
            notes TEXT
        )
    `);

    // 품질 검사 테이블
    db.run(`
        CREATE TABLE IF NOT EXISTS quality_checks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shipment_item_id INTEGER NOT NULL REFERENCES shipment_items(id),
            inspector_id INTEGER NOT NULL REFERENCES users(id),
            check_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT CHECK(status IN ('pending', 'pass', 'fail', 'conditional')) DEFAULT 'pending',
            visual_inspection BOOLEAN DEFAULT 0,
            documentation_check BOOLEAN DEFAULT 0,
            sample_test BOOLEAN DEFAULT 0,
            approved_quantity INTEGER DEFAULT 0,
            rejected_quantity INTEGER DEFAULT 0,
            comments TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 알림 테이블
    db.run(`
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER REFERENCES users(id),
            type TEXT CHECK(type IN ('low_stock', 'expired', 'quality_issue', 'order_approval', 'shipment')) NOT NULL,
            title VARCHAR(200) NOT NULL,
            message TEXT NOT NULL,
            is_read BOOLEAN DEFAULT 0,
            priority TEXT CHECK(priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
            related_id INTEGER,
            related_table VARCHAR(50),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `, (err) => {
        if (err) {
            console.error('테이블 생성 오류:', err.message);
        } else {
            console.log('모든 테이블이 성공적으로 생성되었습니다.');
            insertSampleData();
        }
    });
}

function insertSampleData() {
    // 기본 관리자 계정 생성
    const adminPassword = 'admin123!@#';

    bcrypt.hash(adminPassword, 12, (err, hashedPassword) => {
        if (err) {
            console.error('비밀번호 해시 오류:', err);
            return;
        }

        db.run(`
            INSERT OR IGNORE INTO users (username, email, password, full_name, role, department)
            VALUES (?, ?, ?, ?, ?, ?)
        `, ['admin', 'admin@miseane.com', hashedPassword, '시스템 관리자', 'admin', 'IT'], function(err) {
            if (err) {
                console.error('관리자 계정 생성 오류:', err);
            } else if (this.changes > 0) {
                console.log('✅ 기본 관리자 계정이 생성되었습니다.');
                console.log('   - 아이디: admin');
                console.log('   - 이메일: admin@miseane.com');
                console.log('   - 비밀번호: admin123!@#');
            } else {
                console.log('ℹ️ 관리자 계정이 이미 존재합니다.');
            }
        });
    });

    // 기본 카테고리 생성
    const categories = [
        ['스킨케어', '기초 화장품'],
        ['메이크업', '색조 화장품'],
        ['헤어케어', '모발 관리용품'],
        ['원료', '화장품 원료'],
        ['포장재', '용기 및 포장재']
    ];

    categories.forEach(([name, description]) => {
        db.run(`
            INSERT OR IGNORE INTO categories (name, description) VALUES (?, ?)
        `, [name, description], function(err) {
            if (err) {
                console.error('카테고리 생성 오류:', err);
            } else if (this.changes > 0) {
                console.log(`✅ 카테고리 '${name}' 생성 완료`);
            }
        });
    });

    // 샘플 공급업체 생성
    const suppliers = [
        ['SUP001', '코스메틱 글로벌', '김미세', 'contact@cosmetic-global.com', '02-1234-5678', '서울특별시 강남구'],
        ['SUP002', '뷰티 케어 컴퍼니', '이안전', 'info@beautycare.co.kr', '031-987-6543', '경기도 성남시'],
        ['SUP003', '프리미엄 패키징', '박용기', 'sales@premium-pack.com', '032-555-7777', '인천광역시 남동구']
    ];

    suppliers.forEach(([code, name, contact, email, phone, address]) => {
        db.run(`
            INSERT OR IGNORE INTO suppliers (supplier_code, name, contact_person, email, phone, address, rating, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [code, name, contact, email, phone, address, 4, 'active'], function(err) {
            if (err) {
                console.error('공급업체 생성 오류:', err);
            } else if (this.changes > 0) {
                console.log(`✅ 공급업체 '${name}' 생성 완료`);
            }
        });
    });

    // 샘플 제품 데이터 추가
    const sampleProducts = [
        ['PRD001', '닥터티슈', '부드러운 프리미엄 티슈', 1, 1, 100, '개', 2500, 50, 500],
        ['PRD002', '바디워시', '순한 바디 워시 500ml', 1, 1, 200, '개', 8500, 20, 200],
        ['PRD003', '핸드크림', '보습 핸드크림 50ml', 1, 2, 150, '개', 12000, 30, 300],
        ['PRD004', '샴푸', '탈모 방지 샴푸 300ml', 3, 2, 180, '개', 15000, 25, 250],
        ['PRD005', '로션', '보습 로션 200ml', 1, 3, 120, '개', 18000, 15, 150]
    ];

    sampleProducts.forEach(([code, name, desc, categoryId, supplierId, price, unit, cost, minStock, maxStock]) => {
        db.run(`
            INSERT OR IGNORE INTO products (product_code, name, description, category_id, supplier_id, unit_price, unit, min_stock_level, max_stock_level, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [code, name, desc, categoryId, supplierId, price, unit, minStock, maxStock], function(err) {
            if (err) {
                console.error(`제품 '${name}' 생성 오류:`, err);
            } else if (this.changes > 0) {
                console.log(`✅ 제품 '${name}' 생성 완료`);
            }
        });
    });

    // 샘플 재고 데이터 추가
    setTimeout(() => {
        const sampleInventory = [
            [1, 'BATCH001', 150, 10, '2024-12-31', 'A-01-001'],
            [2, 'BATCH002', 80, 5, '2025-06-30', 'A-01-002'],
            [3, 'BATCH003', 200, 20, '2025-03-31', 'A-02-001'],
            [4, 'BATCH004', 100, 8, '2025-09-30', 'A-02-002'],
            [5, 'BATCH005', 75, 12, '2025-12-31', 'A-03-001']
        ];

        sampleInventory.forEach(([productId, batch, qty, reserved, expiry, location]) => {
            db.run(`
                INSERT OR IGNORE INTO inventory (product_id, batch_number, quantity, reserved_quantity, unit_cost, expiry_date, location)
                VALUES (?, ?, ?, ?, (SELECT unit_price * 0.7 FROM products WHERE id = ?), ?, ?)
            `, [productId, batch, qty, reserved, productId, expiry, location], function(err) {
                if (err) {
                    console.error(`재고 Batch ${batch} 생성 오류:`, err);
                } else if (this.changes > 0) {
                    console.log(`✅ 재고 Batch ${batch} 생성 완료`);
                }
            });
        });
    }, 1000);

    console.log('\n🎉 데이터베이스 초기화가 완료되었습니다!');
    console.log('📊 시스템 접속 정보:');
    console.log('   - URL: http://localhost:3000');
    console.log('   - 관리자: admin@miseane.com');
    console.log('   - 비밀번호: admin123!@#\n');
}

module.exports = { db };