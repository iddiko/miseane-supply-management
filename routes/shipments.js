const express = require('express');
const { db } = require('../database/init');
const { authenticateToken, requireWarehouse } = require('../middleware/auth');

const router = express.Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

// 입고 목록 조회 (검색, 필터링, 페이지네이션)
router.get('/', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const supplier_id = req.query.supplier_id || '';
    const date_from = req.query.date_from || '';
    const date_to = req.query.date_to || '';

    let query = `
        SELECT
            s.id, s.shipment_number, s.status, s.tracking_number,
            s.shipped_date, s.received_date, s.notes, s.created_at,
            sup.name as supplier_name, sup.supplier_code,
            po.po_number,
            u.full_name as received_by_name,
            COUNT(si.id) as item_count,
            SUM(CASE WHEN si.received_quantity > 0 THEN 1 ELSE 0 END) as received_items
        FROM shipments s
        LEFT JOIN suppliers sup ON s.supplier_id = sup.id
        LEFT JOIN purchase_orders po ON s.po_id = po.id
        LEFT JOIN users u ON s.received_by = u.id
        LEFT JOIN shipment_items si ON s.id = si.shipment_id
        WHERE 1=1
    `;
    const params = [];

    if (search) {
        query += ' AND (s.shipment_number LIKE ? OR s.tracking_number LIKE ? OR sup.name LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
        query += ' AND s.status = ?';
        params.push(status);
    }

    if (supplier_id) {
        query += ' AND s.supplier_id = ?';
        params.push(supplier_id);
    }

    if (date_from) {
        query += ' AND date(s.received_date) >= ?';
        params.push(date_from);
    }

    if (date_to) {
        query += ' AND date(s.received_date) <= ?';
        params.push(date_to);
    }

    query += ' GROUP BY s.id ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    db.all(query, params, (err, shipments) => {
        if (err) {
            console.error('입고 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '입고 목록 조회 중 오류가 발생했습니다.'
            });
        }

        // 총 개수 조회
        let countQuery = `
            SELECT COUNT(*) as total
            FROM shipments s
            LEFT JOIN suppliers sup ON s.supplier_id = sup.id
            WHERE 1=1
        `;
        const countParams = [];

        if (search) {
            countQuery += ' AND (s.shipment_number LIKE ? OR s.tracking_number LIKE ? OR sup.name LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (status) {
            countQuery += ' AND s.status = ?';
            countParams.push(status);
        }

        if (supplier_id) {
            countQuery += ' AND s.supplier_id = ?';
            countParams.push(supplier_id);
        }

        if (date_from) {
            countQuery += ' AND date(s.received_date) >= ?';
            countParams.push(date_from);
        }

        if (date_to) {
            countQuery += ' AND date(s.received_date) <= ?';
            countParams.push(date_to);
        }

        db.get(countQuery, countParams, (err, countResult) => {
            if (err) {
                console.error('입고 개수 조회 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '입고 개수 조회 중 오류가 발생했습니다.'
                });
            }

            res.json({
                success: true,
                data: {
                    shipments,
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

// 입고 상세 조회
router.get('/:id', (req, res) => {
    const { id } = req.params;

    const shipmentQuery = `
        SELECT
            s.*,
            sup.name as supplier_name, sup.supplier_code, sup.contact_person,
            po.po_number, po.order_date,
            u.full_name as received_by_name
        FROM shipments s
        LEFT JOIN suppliers sup ON s.supplier_id = sup.id
        LEFT JOIN purchase_orders po ON s.po_id = po.id
        LEFT JOIN users u ON s.received_by = u.id
        WHERE s.id = ?
    `;

    const itemsQuery = `
        SELECT
            si.*,
            p.product_code, p.name as product_name, p.unit,
            c.name as category_name,
            poi.quantity as ordered_quantity, poi.unit_price
        FROM shipment_items si
        INNER JOIN products p ON si.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN purchase_order_items poi ON si.po_item_id = poi.id
        WHERE si.shipment_id = ?
        ORDER BY si.id
    `;

    db.get(shipmentQuery, [id], (err, shipment) => {
        if (err) {
            console.error('입고 상세 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '입고 상세 정보 조회 중 오류가 발생했습니다.'
            });
        }

        if (!shipment) {
            return res.status(404).json({
                success: false,
                message: '입고 정보를 찾을 수 없습니다.'
            });
        }

        db.all(itemsQuery, [id], (err, items) => {
            if (err) {
                console.error('입고 상품 조회 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '입고 상품 조회 중 오류가 발생했습니다.'
                });
            }

            res.json({
                success: true,
                data: {
                    shipment,
                    items
                }
            });
        });
    });
});

// 입고 생성 (창고담당자 이상)
router.post('/', requireWarehouse, (req, res) => {
    const {
        po_id,
        supplier_id,
        tracking_number,
        shipped_date,
        notes,
        items
    } = req.body;

    // 필수 필드 검증
    if (!supplier_id || !items || items.length === 0) {
        return res.status(400).json({
            success: false,
            message: '공급업체와 입고 상품은 필수 입력 사항입니다.'
        });
    }

    // 입고 번호 생성
    const currentDate = new Date();
    const shipmentNumber = `SHP${currentDate.getFullYear()}${String(currentDate.getMonth() + 1).padStart(2, '0')}${Date.now().toString().slice(-6)}`;

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 입고 생성
        db.run(`
            INSERT INTO shipments (
                shipment_number, po_id, supplier_id, tracking_number,
                shipped_date, notes, status
            ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
        `, [
            shipmentNumber, po_id || null, supplier_id,
            tracking_number || null, shipped_date || null, notes || null
        ], function(err) {
            if (err) {
                db.run('ROLLBACK');
                console.error('입고 생성 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '입고 생성 중 오류가 발생했습니다.'
                });
            }

            const shipmentId = this.lastID;

            // 입고 상품 생성
            let itemsInserted = 0;
            let hasError = false;

            items.forEach((item) => {
                if (hasError) return;

                const {
                    product_id,
                    po_item_id,
                    expected_quantity,
                    batch_number,
                    expiry_date,
                    unit_cost,
                    notes: itemNotes
                } = item;

                db.run(`
                    INSERT INTO shipment_items (
                        shipment_id, product_id, po_item_id, expected_quantity,
                        batch_number, expiry_date, unit_cost, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    shipmentId, product_id, po_item_id || null, expected_quantity,
                    batch_number || null, expiry_date || null, unit_cost || null, itemNotes || null
                ], function(err) {
                    if (err) {
                        hasError = true;
                        db.run('ROLLBACK');
                        console.error('입고 상품 생성 오류:', err);
                        return res.status(500).json({
                            success: false,
                            message: '입고 상품 생성 중 오류가 발생했습니다.'
                        });
                    }

                    itemsInserted++;
                    if (itemsInserted === items.length && !hasError) {
                        db.run('COMMIT');
                        res.status(201).json({
                            success: true,
                            message: '입고가 성공적으로 생성되었습니다.',
                            data: {
                                shipment_id: shipmentId,
                                shipment_number: shipmentNumber
                            }
                        });
                    }
                });
            });
        });
    });
});

// 입고 상품 검수 및 재고 업데이트 (창고담당자 이상)
router.post('/:id/receive', requireWarehouse, (req, res) => {
    const { id } = req.params;
    const { items } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({
            success: false,
            message: '검수할 상품 정보가 필요합니다.'
        });
    }

    // 입고 존재 확인
    db.get('SELECT * FROM shipments WHERE id = ?', [id], (err, shipment) => {
        if (err) {
            console.error('입고 확인 오류:', err);
            return res.status(500).json({
                success: false,
                message: '입고 검수 중 오류가 발생했습니다.'
            });
        }

        if (!shipment) {
            return res.status(404).json({
                success: false,
                message: '입고 정보를 찾을 수 없습니다.'
            });
        }

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            let itemsProcessed = 0;
            let hasError = false;
            let totalReceived = 0;
            let totalExpected = 0;

            items.forEach((item) => {
                if (hasError) return;

                const {
                    shipment_item_id,
                    received_quantity,
                    damaged_quantity,
                    batch_number,
                    expiry_date,
                    unit_cost
                } = item;

                // 입고 상품 정보 업데이트
                db.run(`
                    UPDATE shipment_items SET
                        received_quantity = ?,
                        damaged_quantity = ?,
                        batch_number = COALESCE(?, batch_number),
                        expiry_date = COALESCE(?, expiry_date),
                        unit_cost = COALESCE(?, unit_cost)
                    WHERE id = ? AND shipment_id = ?
                `, [
                    received_quantity || 0,
                    damaged_quantity || 0,
                    batch_number,
                    expiry_date,
                    unit_cost,
                    shipment_item_id,
                    id
                ], function(err) {
                    if (err) {
                        hasError = true;
                        db.run('ROLLBACK');
                        console.error('입고 상품 업데이트 오류:', err);
                        return res.status(500).json({
                            success: false,
                            message: '입고 상품 업데이트 중 오류가 발생했습니다.'
                        });
                    }

                    // 정상 입고 수량이 있는 경우 재고에 추가
                    const goodQuantity = (received_quantity || 0) - (damaged_quantity || 0);
                    if (goodQuantity > 0) {
                        // 입고 상품 정보 조회
                        db.get('SELECT * FROM shipment_items WHERE id = ?', [shipment_item_id], (err, shipmentItem) => {
                            if (err) {
                                hasError = true;
                                db.run('ROLLBACK');
                                console.error('입고 상품 조회 오류:', err);
                                return res.status(500).json({
                                    success: false,
                                    message: '입고 상품 조회 중 오류가 발생했습니다.'
                                });
                            }

                            // 재고에 추가
                            db.run(`
                                INSERT INTO inventory (
                                    product_id, location, batch_number, quantity,
                                    unit_cost, expiry_date, received_date
                                ) VALUES (?, 'MAIN_WAREHOUSE', ?, ?, ?, ?, CURRENT_TIMESTAMP)
                            `, [
                                shipmentItem.product_id,
                                batch_number || shipmentItem.batch_number,
                                goodQuantity,
                                unit_cost || shipmentItem.unit_cost,
                                expiry_date || shipmentItem.expiry_date
                            ], function(err) {
                                if (err) {
                                    hasError = true;
                                    db.run('ROLLBACK');
                                    console.error('재고 추가 오류:', err);
                                    return res.status(500).json({
                                        success: false,
                                        message: '재고 추가 중 오류가 발생했습니다.'
                                    });
                                }

                                totalReceived += goodQuantity;
                                totalExpected += shipmentItem.expected_quantity;

                                itemsProcessed++;
                                if (itemsProcessed === items.length && !hasError) {
                                    // 입고 상태 업데이트
                                    let newStatus = 'completed';
                                    if (totalReceived < totalExpected) {
                                        newStatus = 'partial';
                                    } else if (damaged_quantity > 0) {
                                        newStatus = 'damaged';
                                    }

                                    db.run(`
                                        UPDATE shipments SET
                                            status = ?,
                                            received_by = ?,
                                            received_date = CURRENT_TIMESTAMP
                                        WHERE id = ?
                                    `, [newStatus, req.user.userId, id], function(err) {
                                        if (err) {
                                            db.run('ROLLBACK');
                                            console.error('입고 상태 업데이트 오류:', err);
                                            return res.status(500).json({
                                                success: false,
                                                message: '입고 상태 업데이트 중 오류가 발생했습니다.'
                                            });
                                        }

                                        db.run('COMMIT');
                                        res.json({
                                            success: true,
                                            message: '입고 검수가 성공적으로 완료되었습니다.',
                                            data: {
                                                status: newStatus,
                                                total_received: totalReceived,
                                                total_expected: totalExpected
                                            }
                                        });
                                    });
                                }
                            });
                        });
                    } else {
                        totalExpected += (received_quantity || 0);
                        itemsProcessed++;
                        if (itemsProcessed === items.length && !hasError) {
                            // 입고 상태 업데이트
                            const newStatus = damaged_quantity > 0 ? 'damaged' : 'rejected';

                            db.run(`
                                UPDATE shipments SET
                                    status = ?,
                                    received_by = ?,
                                    received_date = CURRENT_TIMESTAMP
                                WHERE id = ?
                            `, [newStatus, req.user.userId, id], function(err) {
                                if (err) {
                                    db.run('ROLLBACK');
                                    console.error('입고 상태 업데이트 오류:', err);
                                    return res.status(500).json({
                                        success: false,
                                        message: '입고 상태 업데이트 중 오류가 발생했습니다.'
                                    });
                                }

                                db.run('COMMIT');
                                res.json({
                                    success: true,
                                    message: '입고 검수가 완료되었습니다.',
                                    data: {
                                        status: newStatus,
                                        total_received: totalReceived,
                                        total_expected: totalExpected
                                    }
                                });
                            });
                        }
                    }
                });
            });
        });
    });
});

// 입고 수정 (창고담당자 이상)
router.put('/:id', requireWarehouse, (req, res) => {
    const { id } = req.params;
    const { tracking_number, shipped_date, received_date, notes, status } = req.body;

    // 입고 존재 확인
    db.get('SELECT id FROM shipments WHERE id = ?', [id], (err, shipment) => {
        if (err) {
            console.error('입고 확인 오류:', err);
            return res.status(500).json({
                success: false,
                message: '입고 수정 중 오류가 발생했습니다.'
            });
        }

        if (!shipment) {
            return res.status(404).json({
                success: false,
                message: '입고 정보를 찾을 수 없습니다.'
            });
        }

        db.run(`
            UPDATE shipments SET
                tracking_number = COALESCE(?, tracking_number),
                shipped_date = COALESCE(?, shipped_date),
                received_date = COALESCE(?, received_date),
                notes = COALESCE(?, notes),
                status = COALESCE(?, status)
            WHERE id = ?
        `, [tracking_number, shipped_date, received_date, notes, status, id], function(err) {
            if (err) {
                console.error('입고 수정 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '입고 수정 중 오류가 발생했습니다.'
                });
            }

            res.json({
                success: true,
                message: '입고 정보가 성공적으로 수정되었습니다.'
            });
        });
    });
});

// 입고 취소 (창고담당자 이상)
router.delete('/:id', requireWarehouse, (req, res) => {
    const { id } = req.params;

    // 입고 존재 및 상태 확인
    db.get('SELECT * FROM shipments WHERE id = ?', [id], (err, shipment) => {
        if (err) {
            console.error('입고 확인 오류:', err);
            return res.status(500).json({
                success: false,
                message: '입고 취소 중 오류가 발생했습니다.'
            });
        }

        if (!shipment) {
            return res.status(404).json({
                success: false,
                message: '입고 정보를 찾을 수 없습니다.'
            });
        }

        if (shipment.status === 'completed' || shipment.status === 'partial') {
            return res.status(400).json({
                success: false,
                message: '이미 처리된 입고는 취소할 수 없습니다.'
            });
        }

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // 입고 상품 삭제
            db.run('DELETE FROM shipment_items WHERE shipment_id = ?', [id], function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    console.error('입고 상품 삭제 오류:', err);
                    return res.status(500).json({
                        success: false,
                        message: '입고 취소 중 오류가 발생했습니다.'
                    });
                }

                // 입고 삭제
                db.run('DELETE FROM shipments WHERE id = ?', [id], function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        console.error('입고 삭제 오류:', err);
                        return res.status(500).json({
                            success: false,
                            message: '입고 취소 중 오류가 발생했습니다.'
                        });
                    }

                    db.run('COMMIT');
                    res.json({
                        success: true,
                        message: '입고가 성공적으로 취소되었습니다.'
                    });
                });
            });
        });
    });
});

// 구매 주문별 입고 현황 조회
router.get('/po/:poId', (req, res) => {
    const { poId } = req.params;

    const query = `
        SELECT
            s.id, s.shipment_number, s.status, s.received_date,
            COUNT(si.id) as item_count,
            SUM(si.expected_quantity) as total_expected,
            SUM(si.received_quantity) as total_received,
            SUM(si.damaged_quantity) as total_damaged
        FROM shipments s
        LEFT JOIN shipment_items si ON s.id = si.shipment_id
        WHERE s.po_id = ?
        GROUP BY s.id
        ORDER BY s.created_at DESC
    `;

    db.all(query, [poId], (err, shipments) => {
        if (err) {
            console.error('구매 주문 입고 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '구매 주문 입고 현황 조회 중 오류가 발생했습니다.'
            });
        }

        res.json({
            success: true,
            data: { shipments }
        });
    });
});

// 입고 대시보드 요약
router.get('/dashboard/summary', (req, res) => {
    const queries = {
        totalShipments: 'SELECT COUNT(*) as count FROM shipments',
        pendingShipments: 'SELECT COUNT(*) as count FROM shipments WHERE status = "pending"',
        completedShipments: 'SELECT COUNT(*) as count FROM shipments WHERE status = "completed"',
        thisWeekShipments: `
            SELECT COUNT(*) as count
            FROM shipments
            WHERE date(received_date) >= date('now', '-7 days')
            AND status IN ('completed', 'partial')
        `,
        damagedItems: `
            SELECT SUM(damaged_quantity) as count
            FROM shipment_items
            WHERE damaged_quantity > 0
        `
    };

    const results = {};
    let completedQueries = 0;

    Object.keys(queries).forEach(key => {
        db.get(queries[key], (err, result) => {
            if (err) {
                console.error(`입고 요약 조회 오류 (${key}):`, err);
                results[key] = { error: true };
            } else {
                results[key] = result;
            }

            completedQueries++;
            if (completedQueries === Object.keys(queries).length) {
                res.json({
                    success: true,
                    data: {
                        total_shipments: results.totalShipments.count || 0,
                        pending_shipments: results.pendingShipments.count || 0,
                        completed_shipments: results.completedShipments.count || 0,
                        this_week_shipments: results.thisWeekShipments.count || 0,
                        damaged_items: results.damagedItems.count || 0
                    }
                });
            }
        });
    });
});

module.exports = router;