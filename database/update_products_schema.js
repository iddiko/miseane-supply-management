const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'supply_management.db');
const db = new sqlite3.Database(dbPath);

console.log('🔄 제품 테이블 스키마 업데이트 시작...');

const updateQueries = [
    // 기존 unit_price 컬럼을 임시로 백업
    `ALTER TABLE products RENAME COLUMN unit_price TO unit_price_old`,

    // 새로운 가격 관련 컬럼들 추가
    `ALTER TABLE products ADD COLUMN cost_price DECIMAL(10,2) DEFAULT 0.0`,
    `ALTER TABLE products ADD COLUMN sale_price DECIMAL(10,2) DEFAULT 0.0`,
    `ALTER TABLE products ADD COLUMN factory_profit DECIMAL(10,2) DEFAULT 0.0`,
    `ALTER TABLE products ADD COLUMN calculated_profit DECIMAL(10,2) DEFAULT 0.0`
];

db.serialize(() => {
    console.log('📊 테이블 구조 업데이트 중...');

    updateQueries.forEach((query, index) => {
        db.run(query, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error(`Query ${index + 1} failed:`, err.message);
            } else {
                console.log(`✅ Query ${index + 1} executed successfully`);
            }
        });
    });

    // 기존 데이터 마이그레이션
    console.log('🔄 기존 데이터 마이그레이션 중...');
    db.run(`
        UPDATE products
        SET sale_price = COALESCE(unit_price_old, 0),
            cost_price = COALESCE(unit_price_old * 0.7, 0),
            factory_profit = 0,
            calculated_profit = COALESCE(unit_price_old * 0.3, 0)
        WHERE cost_price = 0 AND sale_price = 0
    `, (err) => {
        if (err) {
            console.error('Data migration failed:', err.message);
        } else {
            console.log('✅ 기존 데이터 마이그레이션 완료');
        }
    });

    // 기존 unit_price_old 컬럼 삭제는 SQLite 제약으로 인해 생략
    // (SQLite는 컬럼 삭제를 직접 지원하지 않음)

    console.log('\n🎉 제품 테이블 스키마 업데이트 완료!');
    console.log('✨ 새로운 가격 구조가 적용되었습니다:');
    console.log('   - cost_price: 원가');
    console.log('   - sale_price: 판매가');
    console.log('   - factory_profit: 공장수익');
    console.log('   - calculated_profit: 계산된 수익 (판매가 - 원가 - 공장수익)');

    db.close();
});