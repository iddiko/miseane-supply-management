const express = require('express');
const { db } = require('../database/init');
const { authenticateToken, requireWarehouse, requirePurchaser } = require('../middleware/auth');

const router = express.Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

// 재고 목록 조회 (검색, 필터링, 페이지네이션)
router.get('/', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const location = req.query.location || '';
    const low_stock = req.query.low_stock === 'true';

    let query = `
        SELECT
            i.id, i.product_id, i.location, i.batch_number,
            i.quantity, i.reserved_quantity, i.unit_cost,
            i.expiry_date, i.received_date, i.last_updated,
            p.product_code, p.name as product_name, p.unit,
            p.min_stock_level, p.max_stock_level,
            c.name as category_name,
            s.name as supplier_name,
            (i.quantity - i.reserved_quantity) as available_quantity,
            CASE
                WHEN i.expiry_date <= date('now', '+30 days') AND i.expiry_date > date('now') THEN 'expiring_soon'
                WHEN i.expiry_date <= date('now') THEN 'expired'
                ELSE 'good'
            END as expiry_status
        FROM inventory i
        INNER JOIN products p ON i.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE i.quantity > 0
    `;
    const params = [];

    if (search) {
        query += ' AND (p.name LIKE ? OR p.product_code LIKE ? OR i.batch_number LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (location) {
        query += ' AND i.location = ?';
        params.push(location);
    }

    if (low_stock) {
        query += ' AND (i.quantity - i.reserved_quantity) <= p.min_stock_level';
    }

    query += ' ORDER BY i.last_updated DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    db.all(query, params, (err, inventory) => {
        if (err) {
            console.error('재고 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '재고 목록 조회 중 오류가 발생했습니다.'
            });
        }

        // 총 개수 조회
        let countQuery = `
            SELECT COUNT(*) as total
            FROM inventory i
            INNER JOIN products p ON i.product_id = p.id
            WHERE i.quantity > 0
        `;
        const countParams = [];

        if (search) {
            countQuery += ' AND (p.name LIKE ? OR p.product_code LIKE ? OR i.batch_number LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (location) {
            countQuery += ' AND i.location = ?';
            countParams.push(location);
        }

        if (low_stock) {
            countQuery += ' AND (i.quantity - i.reserved_quantity) <= p.min_stock_level';
        }

        db.get(countQuery, countParams, (err, countResult) => {
            if (err) {
                console.error('재고 개수 조회 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '재고 개수 조회 중 오류가 발생했습니다.'
                });
            }

            res.json({
                success: true,
                data: {
                    inventory,
                    pagination: {
                        current_page: page,
                        total_pages: Math.ceil(countResult.total / limit),
                        total_items: countResult.total,
                        limit
                    }
                }
            });
        });
    });
});

// 특정 제품의 재고 상세 조회
router.get('/product/:productId', (req, res) => {
    const { productId } = req.params;

    const query = `
        SELECT
            i.id, i.location, i.batch_number, i.quantity,
            i.reserved_quantity, i.unit_cost, i.expiry_date,
            i.received_date, i.last_updated,
            (i.quantity - i.reserved_quantity) as available_quantity,
            CASE
                WHEN i.expiry_date <= date('now', '+30 days') AND i.expiry_date > date('now') THEN 'expiring_soon'
                WHEN i.expiry_date <= date('now') THEN 'expired'
                ELSE 'good'
            END as expiry_status,
            p.product_code, p.name as product_name, p.unit,
            p.min_stock_level, p.max_stock_level
        FROM inventory i
        INNER JOIN products p ON i.product_id = p.id
        WHERE i.product_id = ? AND i.quantity > 0
        ORDER BY i.expiry_date ASC, i.received_date ASC
    `;

    db.all(query, [productId], (err, inventory) => {
        if (err) {
            console.error('제품 재고 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '제품 재고 조회 중 오류가 발생했습니다.'
            });
        }

        // 재고 요약 정보
        const summary = inventory.reduce((acc, item) => {
            acc.total_quantity += item.quantity;
            acc.total_available += item.available_quantity;
            acc.total_reserved += item.reserved_quantity;
            acc.total_value += item.quantity * item.unit_cost;

            if (item.expiry_status === 'expired') acc.expired_quantity += item.quantity;
            else if (item.expiry_status === 'expiring_soon') acc.expiring_quantity += item.quantity;

            return acc;
        }, {
            total_quantity: 0,
            total_available: 0,
            total_reserved: 0,
            total_value: 0,
            expired_quantity: 0,
            expiring_quantity: 0
        });

        res.json({
            success: true,
            data: {
                inventory,
                summary
            }
        });
    });
});

// 재고 수정 (창고담당자 이상)
router.put('/:id', requireWarehouse, (req, res) => {
    const { id } = req.params;
    const { quantity, reserved_quantity, location, batch_number, expiry_date, unit_cost } = req.body;

    // 재고 존재 확인
    db.get('SELECT * FROM inventory WHERE id = ?', [id], (err, inventory) => {
        if (err) {
            console.error('재고 확인 오류:', err);
            return res.status(500).json({
                success: false,
                message: '재고 수정 중 오류가 발생했습니다.'
            });
        }

        if (!inventory) {
            return res.status(404).json({
                success: false,
                message: '재고를 찾을 수 없습니다.'
            });
        }

        // 재고 정보 수정
        db.run(`
            UPDATE inventory SET
                quantity = COALESCE(?, quantity),
                reserved_quantity = COALESCE(?, reserved_quantity),
                location = COALESCE(?, location),
                batch_number = COALESCE(?, batch_number),
                expiry_date = COALESCE(?, expiry_date),
                unit_cost = COALESCE(?, unit_cost),
                last_updated = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [quantity, reserved_quantity, location, batch_number, expiry_date, unit_cost, id], function(err) {
            if (err) {
                console.error('재고 수정 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '재고 수정 중 오류가 발생했습니다.'
                });
            }

            res.json({
                success: true,
                message: '재고 정보가 성공적으로 수정되었습니다.'
            });
        });
    });
});

// 재고 조정 (창고담당자 이상)
router.post('/:id/adjust', requireWarehouse, (req, res) => {
    const { id } = req.params;
    const { adjustment_quantity, reason } = req.body;

    if (!adjustment_quantity || !reason) {
        return res.status(400).json({
            success: false,
            message: '조정 수량과 사유는 필수 입력 사항입니다.'
        });
    }

    // 재고 존재 확인
    db.get('SELECT * FROM inventory WHERE id = ?', [id], (err, inventory) => {
        if (err) {
            console.error('재고 확인 오류:', err);
            return res.status(500).json({
                success: false,
                message: '재고 조정 중 오류가 발생했습니다.'
            });
        }

        if (!inventory) {
            return res.status(404).json({
                success: false,
                message: '재고를 찾을 수 없습니다.'
            });
        }

        const new_quantity = inventory.quantity + parseInt(adjustment_quantity);

        if (new_quantity < 0) {
            return res.status(400).json({
                success: false,
                message: '조정 후 재고 수량이 음수가 될 수 없습니다.'
            });
        }

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // 재고 수량 업데이트
            db.run(`
                UPDATE inventory SET
                    quantity = ?,
                    last_updated = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [new_quantity, id], function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    console.error('재고 조정 오류:', err);
                    return res.status(500).json({
                        success: false,
                        message: '재고 조정 중 오류가 발생했습니다.'
                    });
                }

                // 재고 이동 기록 생성 (임시로 notifications 테이블 사용)
                db.run(`
                    INSERT INTO notifications (
                        type, title, message, priority, related_id, related_table, created_at
                    ) VALUES ('inventory_adjustment', ?, ?, 'medium', ?, 'inventory', CURRENT_TIMESTAMP)
                `, [
                    '재고 조정',
                    `재고 조정: ${adjustment_quantity > 0 ? '+' : ''}${adjustment_quantity} (사유: ${reason})`,
                    id,
                    'inventory'
                ], function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        console.error('재고 기록 생성 오류:', err);
                        return res.status(500).json({
                            success: false,
                            message: '재고 조정 기록 생성 중 오류가 발생했습니다.'
                        });
                    }

                    db.run('COMMIT');
                    res.json({
                        success: true,
                        message: '재고 조정이 성공적으로 완료되었습니다.',
                        data: {
                            old_quantity: inventory.quantity,
                            new_quantity: new_quantity,
                            adjustment: adjustment_quantity
                        }
                    });
                });
            });
        });
    });
});

// 재고 예약 (창고담당자 이상)
router.post('/:id/reserve', requireWarehouse, (req, res) => {
    const { id } = req.params;
    const { reserve_quantity, reason } = req.body;

    if (!reserve_quantity) {
        return res.status(400).json({
            success: false,
            message: '예약 수량은 필수 입력 사항입니다.'
        });
    }

    // 재고 존재 확인
    db.get('SELECT * FROM inventory WHERE id = ?', [id], (err, inventory) => {
        if (err) {
            console.error('재고 확인 오류:', err);
            return res.status(500).json({
                success: false,
                message: '재고 예약 중 오류가 발생했습니다.'
            });
        }

        if (!inventory) {
            return res.status(404).json({
                success: false,
                message: '재고를 찾을 수 없습니다.'
            });
        }

        const available_quantity = inventory.quantity - inventory.reserved_quantity;

        if (parseInt(reserve_quantity) > available_quantity) {
            return res.status(400).json({
                success: false,
                message: '예약 가능한 수량을 초과했습니다.'
            });
        }

        const new_reserved_quantity = inventory.reserved_quantity + parseInt(reserve_quantity);

        db.run(`
            UPDATE inventory SET
                reserved_quantity = ?,
                last_updated = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [new_reserved_quantity, id], function(err) {
            if (err) {
                console.error('재고 예약 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '재고 예약 중 오류가 발생했습니다.'
                });
            }

            res.json({
                success: true,
                message: '재고 예약이 성공적으로 완료되었습니다.',
                data: {
                    reserved_quantity: reserve_quantity,
                    new_reserved_total: new_reserved_quantity,
                    remaining_available: available_quantity - parseInt(reserve_quantity)
                }
            });
        });
    });
});

// 재고 예약 해제 (창고담당자 이상)
router.delete('/:id/reserve', requireWarehouse, (req, res) => {
    const { id } = req.params;
    const { unreserve_quantity } = req.body;

    if (!unreserve_quantity) {
        return res.status(400).json({
            success: false,
            message: '예약 해제 수량은 필수 입력 사항입니다.'
        });
    }

    // 재고 존재 확인
    db.get('SELECT * FROM inventory WHERE id = ?', [id], (err, inventory) => {
        if (err) {
            console.error('재고 확인 오류:', err);
            return res.status(500).json({
                success: false,
                message: '재고 예약 해제 중 오류가 발생했습니다.'
            });
        }

        if (!inventory) {
            return res.status(404).json({
                success: false,
                message: '재고를 찾을 수 없습니다.'
            });
        }

        if (parseInt(unreserve_quantity) > inventory.reserved_quantity) {
            return res.status(400).json({
                success: false,
                message: '예약 해제 수량이 예약된 수량을 초과했습니다.'
            });
        }

        const new_reserved_quantity = inventory.reserved_quantity - parseInt(unreserve_quantity);

        db.run(`
            UPDATE inventory SET
                reserved_quantity = ?,
                last_updated = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [new_reserved_quantity, id], function(err) {
            if (err) {
                console.error('재고 예약 해제 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '재고 예약 해제 중 오류가 발생했습니다.'
                });
            }

            res.json({
                success: true,
                message: '재고 예약 해제가 성공적으로 완료되었습니다.',
                data: {
                    unreserved_quantity: unreserve_quantity,
                    new_reserved_total: new_reserved_quantity
                }
            });
        });
    });
});

// 재고 위치 목록 조회
router.get('/locations/list', (req, res) => {
    const query = `
        SELECT
            location,
            COUNT(DISTINCT product_id) as product_count,
            SUM(quantity) as total_quantity,
            SUM(quantity * unit_cost) as total_value
        FROM inventory
        WHERE quantity > 0
        GROUP BY location
        ORDER BY location
    `;

    db.all(query, (err, locations) => {
        if (err) {
            console.error('위치 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '위치 목록 조회 중 오류가 발생했습니다.'
            });
        }

        res.json({
            success: true,
            data: { locations }
        });
    });
});

// 만료 예정 재고 조회
router.get('/expiring/list', (req, res) => {
    const days = parseInt(req.query.days) || 30;

    const query = `
        SELECT
            i.id, i.batch_number, i.quantity, i.expiry_date,
            p.product_code, p.name as product_name, p.unit,
            c.name as category_name,
            s.name as supplier_name,
            (julianday(i.expiry_date) - julianday('now')) as days_to_expiry
        FROM inventory i
        INNER JOIN products p ON i.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE i.quantity > 0
        AND i.expiry_date <= date('now', '+' || ? || ' days')
        AND i.expiry_date > date('now')
        ORDER BY i.expiry_date ASC
    `;

    db.all(query, [days], (err, inventory) => {
        if (err) {
            console.error('만료 예정 재고 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '만료 예정 재고 조회 중 오류가 발생했습니다.'
            });
        }

        res.json({
            success: true,
            data: { inventory }
        });
    });
});

// 재고 요약 대시보드
router.get('/dashboard/summary', (req, res) => {
    const queries = {
        totalValue: `
            SELECT SUM(quantity * unit_cost) as total_value
            FROM inventory
            WHERE quantity > 0
        `,
        lowStockCount: `
            SELECT COUNT(*) as count
            FROM (
                SELECT p.id
                FROM products p
                LEFT JOIN inventory i ON p.id = i.product_id
                WHERE p.is_active = 1
                GROUP BY p.id
                HAVING COALESCE(SUM(i.quantity - i.reserved_quantity), 0) <= p.min_stock_level
            )
        `,
        expiringCount: `
            SELECT COUNT(*) as count
            FROM inventory
            WHERE quantity > 0
            AND expiry_date <= date('now', '+30 days')
            AND expiry_date > date('now')
        `,
        expiredCount: `
            SELECT COUNT(*) as count
            FROM inventory
            WHERE quantity > 0
            AND expiry_date <= date('now')
        `
    };

    const results = {};
    let completedQueries = 0;

    Object.keys(queries).forEach(key => {
        db.get(queries[key], (err, result) => {
            if (err) {
                console.error(`재고 요약 조회 오류 (${key}):`, err);
                results[key] = { error: true };
            } else {
                results[key] = result;
            }

            completedQueries++;
            if (completedQueries === Object.keys(queries).length) {
                res.json({
                    success: true,
                    data: {
                        total_value: results.totalValue.total_value || 0,
                        low_stock_count: results.lowStockCount.count || 0,
                        expiring_count: results.expiringCount.count || 0,
                        expired_count: results.expiredCount.count || 0
                    }
                });
            }
        });
    });
});

module.exports = router;