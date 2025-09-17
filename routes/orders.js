const express = require('express');
const { db } = require('../database/init');
const { authenticateToken, requirePurchaser, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

// 구매 주문 목록 조회 (검색, 필터링, 페이지네이션)
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
            po.id, po.po_number, po.status, po.order_date,
            po.expected_delivery, po.total_amount, po.notes,
            po.created_at, po.approved_at,
            s.name as supplier_name, s.supplier_code,
            u1.full_name as requested_by_name,
            u2.full_name as approved_by_name,
            COUNT(poi.id) as item_count,
            SUM(CASE WHEN poi.received_quantity < poi.quantity THEN 1 ELSE 0 END) as pending_items
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        LEFT JOIN users u1 ON po.requested_by = u1.id
        LEFT JOIN users u2 ON po.approved_by = u2.id
        LEFT JOIN purchase_order_items poi ON po.id = poi.po_id
        WHERE 1=1
    `;
    const params = [];

    if (search) {
        query += ' AND (po.po_number LIKE ? OR s.name LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
        query += ' AND po.status = ?';
        params.push(status);
    }

    if (supplier_id) {
        query += ' AND po.supplier_id = ?';
        params.push(supplier_id);
    }

    if (date_from) {
        query += ' AND date(po.order_date) >= ?';
        params.push(date_from);
    }

    if (date_to) {
        query += ' AND date(po.order_date) <= ?';
        params.push(date_to);
    }

    query += ' GROUP BY po.id ORDER BY po.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    db.all(query, params, (err, orders) => {
        if (err) {
            console.error('주문 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '구매 주문 목록 조회 중 오류가 발생했습니다.'
            });
        }

        // 총 개수 조회
        let countQuery = `
            SELECT COUNT(*) as total
            FROM purchase_orders po
            LEFT JOIN suppliers s ON po.supplier_id = s.id
            WHERE 1=1
        `;
        const countParams = [];

        if (search) {
            countQuery += ' AND (po.po_number LIKE ? OR s.name LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`);
        }

        if (status) {
            countQuery += ' AND po.status = ?';
            countParams.push(status);
        }

        if (supplier_id) {
            countQuery += ' AND po.supplier_id = ?';
            countParams.push(supplier_id);
        }

        if (date_from) {
            countQuery += ' AND date(po.order_date) >= ?';
            countParams.push(date_from);
        }

        if (date_to) {
            countQuery += ' AND date(po.order_date) <= ?';
            countParams.push(date_to);
        }

        db.get(countQuery, countParams, (err, countResult) => {
            if (err) {
                console.error('주문 개수 조회 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '주문 개수 조회 중 오류가 발생했습니다.'
                });
            }

            res.json({
                success: true,
                data: {
                    orders,
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

// 구매 주문 상세 조회
router.get('/:id', (req, res) => {
    const { id } = req.params;

    const orderQuery = `
        SELECT
            po.*,
            s.name as supplier_name, s.supplier_code, s.contact_person,
            s.email as supplier_email, s.phone as supplier_phone,
            u1.full_name as requested_by_name,
            u2.full_name as approved_by_name
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        LEFT JOIN users u1 ON po.requested_by = u1.id
        LEFT JOIN users u2 ON po.approved_by = u2.id
        WHERE po.id = ?
    `;

    const itemsQuery = `
        SELECT
            poi.*,
            p.product_code, p.name as product_name, p.unit,
            c.name as category_name
        FROM purchase_order_items poi
        INNER JOIN products p ON poi.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE poi.po_id = ?
        ORDER BY poi.id
    `;

    db.get(orderQuery, [id], (err, order) => {
        if (err) {
            console.error('주문 상세 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '주문 상세 정보 조회 중 오류가 발생했습니다.'
            });
        }

        if (!order) {
            return res.status(404).json({
                success: false,
                message: '구매 주문을 찾을 수 없습니다.'
            });
        }

        db.all(itemsQuery, [id], (err, items) => {
            if (err) {
                console.error('주문 상품 조회 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '주문 상품 조회 중 오류가 발생했습니다.'
                });
            }

            res.json({
                success: true,
                data: {
                    order,
                    items
                }
            });
        });
    });
});

// 구매 주문 생성 (구매담당자 이상)
router.post('/', requirePurchaser, (req, res) => {
    const {
        supplier_id,
        expected_delivery,
        notes,
        items
    } = req.body;

    // 필수 필드 검증
    if (!supplier_id || !items || items.length === 0) {
        return res.status(400).json({
            success: false,
            message: '공급업체와 주문 상품은 필수 입력 사항입니다.'
        });
    }

    // PO 번호 생성
    const currentDate = new Date();
    const poNumber = `PO${currentDate.getFullYear()}${String(currentDate.getMonth() + 1).padStart(2, '0')}${Date.now().toString().slice(-6)}`;

    // 총 금액 계산
    const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 구매 주문 생성
        db.run(`
            INSERT INTO purchase_orders (
                po_number, supplier_id, requested_by, status,
                expected_delivery, total_amount, notes
            ) VALUES (?, ?, ?, 'draft', ?, ?, ?)
        `, [
            poNumber, supplier_id, req.user.userId,
            expected_delivery || null, totalAmount, notes || null
        ], function(err) {
            if (err) {
                db.run('ROLLBACK');
                console.error('주문 생성 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '구매 주문 생성 중 오류가 발생했습니다.'
                });
            }

            const orderId = this.lastID;

            // 주문 상품 생성
            let itemsInserted = 0;
            let hasError = false;

            items.forEach((item) => {
                if (hasError) return;

                const { product_id, quantity, unit_price, notes: itemNotes } = item;
                const totalPrice = quantity * unit_price;

                db.run(`
                    INSERT INTO purchase_order_items (
                        po_id, product_id, quantity, unit_price, total_price, notes
                    ) VALUES (?, ?, ?, ?, ?, ?)
                `, [
                    orderId, product_id, quantity, unit_price, totalPrice, itemNotes || null
                ], function(err) {
                    if (err) {
                        hasError = true;
                        db.run('ROLLBACK');
                        console.error('주문 상품 생성 오류:', err);
                        return res.status(500).json({
                            success: false,
                            message: '주문 상품 생성 중 오류가 발생했습니다.'
                        });
                    }

                    itemsInserted++;
                    if (itemsInserted === items.length && !hasError) {
                        db.run('COMMIT');
                        res.status(201).json({
                            success: true,
                            message: '구매 주문이 성공적으로 생성되었습니다.',
                            data: {
                                order_id: orderId,
                                po_number: poNumber,
                                total_amount: totalAmount
                            }
                        });
                    }
                });
            });
        });
    });
});

// 구매 주문 수정 (구매담당자 이상, 승인 전에만 가능)
router.put('/:id', requirePurchaser, (req, res) => {
    const { id } = req.params;
    const { expected_delivery, notes, items } = req.body;

    // 주문 존재 및 상태 확인
    db.get('SELECT * FROM purchase_orders WHERE id = ?', [id], (err, order) => {
        if (err) {
            console.error('주문 확인 오류:', err);
            return res.status(500).json({
                success: false,
                message: '주문 수정 중 오류가 발생했습니다.'
            });
        }

        if (!order) {
            return res.status(404).json({
                success: false,
                message: '구매 주문을 찾을 수 없습니다.'
            });
        }

        if (order.status !== 'draft' && order.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: '승인된 주문은 수정할 수 없습니다.'
            });
        }

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            let updateQuery = 'UPDATE purchase_orders SET updated_at = CURRENT_TIMESTAMP';
            const updateParams = [];

            if (expected_delivery) {
                updateQuery += ', expected_delivery = ?';
                updateParams.push(expected_delivery);
            }

            if (notes !== undefined) {
                updateQuery += ', notes = ?';
                updateParams.push(notes);
            }

            // 상품이 변경되는 경우 총액 재계산
            if (items && items.length > 0) {
                const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
                updateQuery += ', total_amount = ?';
                updateParams.push(totalAmount);
            }

            updateQuery += ' WHERE id = ?';
            updateParams.push(id);

            db.run(updateQuery, updateParams, function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    console.error('주문 정보 수정 오류:', err);
                    return res.status(500).json({
                        success: false,
                        message: '주문 정보 수정 중 오류가 발생했습니다.'
                    });
                }

                // 상품 정보가 제공된 경우 기존 상품 삭제 후 재등록
                if (items && items.length > 0) {
                    db.run('DELETE FROM purchase_order_items WHERE po_id = ?', [id], function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            console.error('기존 주문 상품 삭제 오류:', err);
                            return res.status(500).json({
                                success: false,
                                message: '주문 상품 수정 중 오류가 발생했습니다.'
                            });
                        }

                        // 새 상품 등록
                        let itemsInserted = 0;
                        let hasError = false;

                        items.forEach((item) => {
                            if (hasError) return;

                            const { product_id, quantity, unit_price, notes: itemNotes } = item;
                            const totalPrice = quantity * unit_price;

                            db.run(`
                                INSERT INTO purchase_order_items (
                                    po_id, product_id, quantity, unit_price, total_price, notes
                                ) VALUES (?, ?, ?, ?, ?, ?)
                            `, [
                                id, product_id, quantity, unit_price, totalPrice, itemNotes || null
                            ], function(err) {
                                if (err) {
                                    hasError = true;
                                    db.run('ROLLBACK');
                                    console.error('주문 상품 수정 오류:', err);
                                    return res.status(500).json({
                                        success: false,
                                        message: '주문 상품 수정 중 오류가 발생했습니다.'
                                    });
                                }

                                itemsInserted++;
                                if (itemsInserted === items.length && !hasError) {
                                    db.run('COMMIT');
                                    res.json({
                                        success: true,
                                        message: '구매 주문이 성공적으로 수정되었습니다.'
                                    });
                                }
                            });
                        });
                    });
                } else {
                    db.run('COMMIT');
                    res.json({
                        success: true,
                        message: '구매 주문이 성공적으로 수정되었습니다.'
                    });
                }
            });
        });
    });
});

// 구매 주문 승인 (관리자만)
router.post('/:id/approve', requireAdmin, (req, res) => {
    const { id } = req.params;

    // 주문 존재 및 상태 확인
    db.get('SELECT * FROM purchase_orders WHERE id = ?', [id], (err, order) => {
        if (err) {
            console.error('주문 확인 오류:', err);
            return res.status(500).json({
                success: false,
                message: '주문 승인 중 오류가 발생했습니다.'
            });
        }

        if (!order) {
            return res.status(404).json({
                success: false,
                message: '구매 주문을 찾을 수 없습니다.'
            });
        }

        if (order.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: '대기 중인 주문만 승인할 수 있습니다.'
            });
        }

        db.run(`
            UPDATE purchase_orders SET
                status = 'approved',
                approved_by = ?,
                approved_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [req.user.userId, id], function(err) {
            if (err) {
                console.error('주문 승인 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '주문 승인 중 오류가 발생했습니다.'
                });
            }

            res.json({
                success: true,
                message: '구매 주문이 성공적으로 승인되었습니다.'
            });
        });
    });
});

// 구매 주문 상태 변경
router.put('/:id/status', requirePurchaser, (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['draft', 'pending', 'approved', 'sent', 'partial', 'completed', 'cancelled'];

    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
            success: false,
            message: '유효하지 않은 상태입니다.'
        });
    }

    // 주문 존재 확인
    db.get('SELECT * FROM purchase_orders WHERE id = ?', [id], (err, order) => {
        if (err) {
            console.error('주문 확인 오류:', err);
            return res.status(500).json({
                success: false,
                message: '주문 상태 변경 중 오류가 발생했습니다.'
            });
        }

        if (!order) {
            return res.status(404).json({
                success: false,
                message: '구매 주문을 찾을 수 없습니다.'
            });
        }

        db.run(`
            UPDATE purchase_orders SET
                status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [status, id], function(err) {
            if (err) {
                console.error('주문 상태 변경 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '주문 상태 변경 중 오류가 발생했습니다.'
                });
            }

            res.json({
                success: true,
                message: '주문 상태가 성공적으로 변경되었습니다.'
            });
        });
    });
});

// 구매 주문 취소
router.delete('/:id', requirePurchaser, (req, res) => {
    const { id } = req.params;

    // 주문 존재 및 상태 확인
    db.get('SELECT * FROM purchase_orders WHERE id = ?', [id], (err, order) => {
        if (err) {
            console.error('주문 확인 오류:', err);
            return res.status(500).json({
                success: false,
                message: '주문 취소 중 오류가 발생했습니다.'
            });
        }

        if (!order) {
            return res.status(404).json({
                success: false,
                message: '구매 주문을 찾을 수 없습니다.'
            });
        }

        if (order.status === 'completed' || order.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: '완료되거나 취소된 주문은 취소할 수 없습니다.'
            });
        }

        db.run(`
            UPDATE purchase_orders SET
                status = 'cancelled',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [id], function(err) {
            if (err) {
                console.error('주문 취소 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '주문 취소 중 오류가 발생했습니다.'
                });
            }

            res.json({
                success: true,
                message: '구매 주문이 성공적으로 취소되었습니다.'
            });
        });
    });
});

// 주문 대시보드 요약
router.get('/dashboard/summary', (req, res) => {
    const queries = {
        totalOrders: 'SELECT COUNT(*) as count FROM purchase_orders',
        pendingOrders: 'SELECT COUNT(*) as count FROM purchase_orders WHERE status = "pending"',
        approvedOrders: 'SELECT COUNT(*) as count FROM purchase_orders WHERE status IN ("approved", "sent")',
        thisMonthTotal: `
            SELECT SUM(total_amount) as amount
            FROM purchase_orders
            WHERE date(created_at) >= date('now', 'start of month')
            AND status != 'cancelled'
        `,
        overduDeliveries: `
            SELECT COUNT(*) as count
            FROM purchase_orders
            WHERE expected_delivery < date('now')
            AND status NOT IN ('completed', 'cancelled')
        `
    };

    const results = {};
    let completedQueries = 0;

    Object.keys(queries).forEach(key => {
        db.get(queries[key], (err, result) => {
            if (err) {
                console.error(`주문 요약 조회 오류 (${key}):`, err);
                results[key] = { error: true };
            } else {
                results[key] = result;
            }

            completedQueries++;
            if (completedQueries === Object.keys(queries).length) {
                res.json({
                    success: true,
                    data: {
                        total_orders: results.totalOrders.count || 0,
                        pending_orders: results.pendingOrders.count || 0,
                        approved_orders: results.approvedOrders.count || 0,
                        this_month_total: results.thisMonthTotal.amount || 0,
                        overdue_deliveries: results.overduDeliveries.count || 0
                    }
                });
            }
        });
    });
});

module.exports = router;