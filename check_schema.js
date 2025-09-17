const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database', 'supply_management.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 모든 테이블 조회
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
        if (err) {
            console.error('Error fetching tables:', err);
            return;
        }

        console.log('=== 현재 데이터베이스 테이블 ===');
        tables.forEach(table => {
            console.log(`- ${table.name}`);
        });

        // 각 테이블의 스키마 조회
        console.log('\n=== 테이블 스키마 ===');
        let completed = 0;

        tables.forEach(table => {
            db.all(`PRAGMA table_info(${table.name})`, (err, columns) => {
                if (err) {
                    console.error(`Error fetching schema for ${table.name}:`, err);
                } else {
                    console.log(`\n${table.name}:`);
                    columns.forEach(col => {
                        console.log(`  ${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
                    });
                }

                completed++;
                if (completed === tables.length) {
                    db.close();
                }
            });
        });
    });
});