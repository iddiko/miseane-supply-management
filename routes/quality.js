const express = require('express');
const { db } = require('../database/init');
const { authenticateToken, requireQuality, requireWarehouse } = require('../middleware/auth');

const router = express.Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

// 품질 검사 목록 조회 (검색, 필터링, 페이지네이션)
router.get('/', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const date_from = req.query.date_from || '';
    const date_to = req.query.date_to || '';

    let query = `
        SELECT
            qc.id, qc.check_date, qc.status, qc.visual_inspection,
            qc.documentation_check, qc.sample_test, qc.approved_quantity,
            qc.rejected_quantity, qc.comments, qc.created_at,
            p.product_code, p.name as product_name, p.unit,
            c.name as category_name,
            s.shipment_number, s.received_date,
            sup.name as supplier_name,
            u.full_name as inspector_name,
            si.batch_number, si.expiry_date, si.received_quantity
        FROM quality_checks qc
        INNER JOIN shipment_items si ON qc.shipment_item_id = si.id
        INNER JOIN shipments s ON si.shipment_id = s.id
        INNER JOIN products p ON si.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers sup ON s.supplier_id = sup.id
        LEFT JOIN users u ON qc.inspector_id = u.id
        WHERE 1=1
    `;
    const params = [];

    if (search) {
        query += ' AND (p.name LIKE ? OR p.product_code LIKE ? OR s.shipment_number LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
        query += ' AND qc.status = ?';
        params.push(status);
    }

    if (date_from) {
        query += ' AND date(qc.check_date) >= ?';
        params.push(date_from);
    }

    if (date_to) {
        query += ' AND date(qc.check_date) <= ?';
        params.push(date_to);
    }

    query += ' ORDER BY qc.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    db.all(query, params, (err, checks) => {
        if (err) {
            console.error('품질 검사 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '품질 검사 목록 조회 중 오류가 발생했습니다.'
            });
        }

        // 총 개수 조회
        let countQuery = `
            SELECT COUNT(*) as total
            FROM quality_checks qc
            INNER JOIN shipment_items si ON qc.shipment_item_id = si.id
            INNER JOIN shipments s ON si.shipment_id = s.id
            INNER JOIN products p ON si.product_id = p.id
            WHERE 1=1
        `;
        const countParams = [];

        if (search) {
            countQuery += ' AND (p.name LIKE ? OR p.product_code LIKE ? OR s.shipment_number LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (status) {
            countQuery += ' AND qc.status = ?';
            countParams.push(status);
        }

        if (date_from) {
            countQuery += ' AND date(qc.check_date) >= ?';
            countParams.push(date_from);
        }

        if (date_to) {
            countQuery += ' AND date(qc.check_date) <= ?';
            countParams.push(date_to);
        }

        db.get(countQuery, countParams, (err, countResult) => {
            if (err) {
                console.error('품질 검사 개수 조회 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '품질 검사 개수 조회 중 오류가 발생했습니다.'
                });
            }

            res.json({
                success: true,
                data: {
                    checks,
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

// 품질 검사 상세 조회
router.get('/:id', (req, res) => {
    const { id } = req.params;

    const query = `
        SELECT
            qc.*,
            p.product_code, p.name as product_name, p.unit, p.specifications,
            c.name as category_name,
            s.shipment_number, s.received_date, s.tracking_number,
            sup.name as supplier_name, sup.supplier_code,
            u.full_name as inspector_name, u.email as inspector_email,
            si.batch_number, si.expiry_date, si.received_quantity,
            si.expected_quantity, si.unit_cost
        FROM quality_checks qc
        INNER JOIN shipment_items si ON qc.shipment_item_id = si.id
        INNER JOIN shipments s ON si.shipment_id = s.id
        INNER JOIN products p ON si.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers sup ON s.supplier_id = sup.id
        LEFT JOIN users u ON qc.inspector_id = u.id
        WHERE qc.id = ?
    `;

    db.get(query, [id], (err, check) => {
        if (err) {
            console.error('품질 검사 상세 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '품질 검사 상세 정보 조회 중 오류가 발생했습니다.'
            });
        }

        if (!check) {
            return res.status(404).json({
                success: false,
                message: '품질 검사 정보를 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            data: { check }
        });
    });
});

// 품질 검사 생성 (품질관리자 이상)
router.post('/', requireQuality, (req, res) => {
    const {
        shipment_item_id,
        visual_inspection,
        documentation_check,
        sample_test,
        approved_quantity,
        rejected_quantity,
        comments
    } = req.body;

    // 필수 필드 검증
    if (!shipment_item_id) {
        return res.status(400).json({
            success: false,
            message: '입고 상품 ID는 필수 입력 사항입니다.'
        });
    }

    // 입고 상품 존재 확인
    db.get('SELECT * FROM shipment_items WHERE id = ?', [shipment_item_id], (err, shipmentItem) => {
        if (err) {
            console.error('입고 상품 확인 오류:', err);
            return res.status(500).json({
                success: false,
                message: '품질 검사 생성 중 오류가 발생했습니다.'
            });
        }

        if (!shipmentItem) {
            return res.status(404).json({
                success: false,
                message: '입고 상품을 찾을 수 없습니다.'
            });
        }

        // 이미 품질 검사가 있는지 확인
        db.get('SELECT id FROM quality_checks WHERE shipment_item_id = ?', [shipment_item_id], (err, existing) => {
            if (err) {
                console.error('중복 검사 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '품질 검사 생성 중 오류가 발생했습니다.'
                });
            }

            if (existing) {
                return res.status(409).json({
                    success: false,
                    message: '이미 품질 검사가 진행된 상품입니다.'
                });
            }

            // 검사 상태 결정
            let status = 'pending';
            const totalChecked = (approved_quantity || 0) + (rejected_quantity || 0);

            if (totalChecked > 0) {
                if (rejected_quantity > 0) {
                    status = (approved_quantity > 0) ? 'conditional' : 'fail';
                } else {
                    status = 'pass';
                }
            }

            // 품질 검사 생성
            db.run(`
                INSERT INTO quality_checks (
                    shipment_item_id, inspector_id, status, visual_inspection,
                    documentation_check, sample_test, approved_quantity,
                    rejected_quantity, comments
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                shipment_item_id, req.user.userId, status,
                visual_inspection ? 1 : 0, documentation_check ? 1 : 0,
                sample_test ? 1 : 0, approved_quantity || 0,
                rejected_quantity || 0, comments || null
            ], function(err) {
                if (err) {
                    console.error('품질 검사 생성 오류:', err);
                    return res.status(500).json({
                        success: false,
                        message: '품질 검사 생성 중 오류가 발생했습니다.'
                    });
                }

                res.status(201).json({
                    success: true,
                    message: '품질 검사가 성공적으로 생성되었습니다.',
                    data: {
                        check_id: this.lastID,
                        status: status
                    }
                });
            });
        });
    });
});

// 품질 검사 수정 (품질관리자 이상)
router.put('/:id', requireQuality, (req, res) => {
    const { id } = req.params;
    const {
        visual_inspection,
        documentation_check,
        sample_test,
        approved_quantity,
        rejected_quantity,
        comments
    } = req.body;

    // 품질 검사 존재 확인
    db.get('SELECT * FROM quality_checks WHERE id = ?', [id], (err, check) => {
        if (err) {
            console.error('품질 검사 확인 오류:', err);
            return res.status(500).json({
                success: false,
                message: '품질 검사 수정 중 오류가 발생했습니다.'
            });
        }

        if (!check) {
            return res.status(404).json({
                success: false,
                message: '품질 검사 정보를 찾을 수 없습니다.'
            });
        }

        // 검사 상태 재계산
        let status = check.status;
        if (approved_quantity !== undefined || rejected_quantity !== undefined) {
            const newApproved = approved_quantity !== undefined ? approved_quantity : check.approved_quantity;
            const newRejected = rejected_quantity !== undefined ? rejected_quantity : check.rejected_quantity;
            const totalChecked = newApproved + newRejected;

            if (totalChecked > 0) {
                if (newRejected > 0) {
                    status = (newApproved > 0) ? 'conditional' : 'fail';
                } else {
                    status = 'pass';
                }
            } else {
                status = 'pending';
            }
        }

        db.run(`
            UPDATE quality_checks SET
                status = ?,
                visual_inspection = COALESCE(?, visual_inspection),
                documentation_check = COALESCE(?, documentation_check),
                sample_test = COALESCE(?, sample_test),
                approved_quantity = COALESCE(?, approved_quantity),
                rejected_quantity = COALESCE(?, rejected_quantity),
                comments = COALESCE(?, comments),
                check_date = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            status,
            visual_inspection !== undefined ? (visual_inspection ? 1 : 0) : null,
            documentation_check !== undefined ? (documentation_check ? 1 : 0) : null,
            sample_test !== undefined ? (sample_test ? 1 : 0) : null,
            approved_quantity,
            rejected_quantity,
            comments,
            id
        ], function(err) {
            if (err) {
                console.error('품질 검사 수정 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '품질 검사 수정 중 오류가 발생했습니다.'
                });
            }

            res.json({
                success: true,
                message: '품질 검사가 성공적으로 수정되었습니다.',
                data: {
                    status: status
                }
            });
        });
    });
});

// 품질 검사 완료 처리 (품질관리자 이상)
router.post('/:id/complete', requireQuality, (req, res) => {
    const { id } = req.params;
    const { approved_quantity, rejected_quantity, comments } = req.body;

    if (approved_quantity === undefined || rejected_quantity === undefined) {
        return res.status(400).json({
            success: false,
            message: '승인 수량과 반려 수량은 필수 입력 사항입니다.'
        });
    }

    // 품질 검사 존재 확인 및 입고 상품 정보 조회
    const query = `
        SELECT qc.*, si.received_quantity, si.product_id, si.shipment_id
        FROM quality_checks qc
        INNER JOIN shipment_items si ON qc.shipment_item_id = si.id
        WHERE qc.id = ?
    `;

    db.get(query, [id], (err, check) => {
        if (err) {
            console.error('품질 검사 확인 오류:', err);
            return res.status(500).json({
                success: false,
                message: '품질 검사 완료 처리 중 오류가 발생했습니다.'
            });
        }

        if (!check) {
            return res.status(404).json({
                success: false,
                message: '품질 검사 정보를 찾을 수 없습니다.'
            });
        }

        const totalChecked = approved_quantity + rejected_quantity;
        if (totalChecked > check.received_quantity) {
            return res.status(400).json({
                success: false,
                message: '검사 수량이 입고 수량을 초과할 수 없습니다.'
            });
        }

        // 검사 상태 결정
        let status = 'pass';
        if (rejected_quantity > 0) {
            status = (approved_quantity > 0) ? 'conditional' : 'fail';
        }

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // 품질 검사 완료 처리
            db.run(`
                UPDATE quality_checks SET
                    status = ?,
                    approved_quantity = ?,
                    rejected_quantity = ?,
                    comments = COALESCE(?, comments),
                    check_date = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [status, approved_quantity, rejected_quantity, comments, id], function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    console.error('품질 검사 완료 오류:', err);
                    return res.status(500).json({
                        success: false,
                        message: '품질 검사 완료 처리 중 오류가 발생했습니다.'
                    });
                }

                // 승인된 수량만큼 재고에 추가 (기존 재고 업데이트 또는 새로 생성)
                if (approved_quantity > 0) {
                    // 해당 제품의 기존 재고 확인
                    db.get(`
                        SELECT si.batch_number, si.expiry_date, si.unit_cost
                        FROM shipment_items si
                        WHERE si.id = ?
                    `, [check.shipment_item_id], (err, shipmentItem) => {
                        if (err) {
                            db.run('ROLLBACK');
                            console.error('입고 상품 정보 조회 오류:', err);
                            return res.status(500).json({
                                success: false,
                                message: '재고 업데이트 중 오류가 발생했습니다.'
                            });
                        }

                        // 승인된 수량을 재고에 추가
                        db.run(`
                            INSERT INTO inventory (
                                product_id, location, batch_number, quantity,
                                unit_cost, expiry_date, received_date
                            ) VALUES (?, 'QC_APPROVED', ?, ?, ?, ?, CURRENT_TIMESTAMP)
                        `, [
                            check.product_id,
                            shipmentItem.batch_number,
                            approved_quantity,
                            shipmentItem.unit_cost,
                            shipmentItem.expiry_date
                        ], function(err) {
                            if (err) {
                                db.run('ROLLBACK');
                                console.error('재고 추가 오류:', err);
                                return res.status(500).json({
                                    success: false,
                                    message: '재고 추가 중 오류가 발생했습니다.'
                                });
                            }

                            // 알림 생성 (필요한 경우)
                            if (status === 'fail' || status === 'conditional') {
                                db.run(`
                                    INSERT INTO notifications (
                                        type, title, message, priority, related_id, related_table
                                    ) VALUES ('quality_issue', ?, ?, 'high', ?, 'quality_checks')
                                `, [
                                    '품질 검사 이슈',
                                    `품질 검사에서 문제가 발견되었습니다. (승인: ${approved_quantity}, 반려: ${rejected_quantity})`,
                                    id
                                ], function(err) {
                                    if (err) {
                                        console.error('알림 생성 오류:', err);
                                        // 알림 생성 실패는 전체 트랜잭션을 롤백하지 않음
                                    }

                                    db.run('COMMIT');
                                    res.json({
                                        success: true,
                                        message: '품질 검사가 성공적으로 완료되었습니다.',
                                        data: {
                                            status: status,
                                            approved_quantity: approved_quantity,
                                            rejected_quantity: rejected_quantity
                                        }
                                    });
                                });
                            } else {
                                db.run('COMMIT');
                                res.json({
                                    success: true,
                                    message: '품질 검사가 성공적으로 완료되었습니다.',
                                    data: {
                                        status: status,
                                        approved_quantity: approved_quantity,
                                        rejected_quantity: rejected_quantity
                                    }
                                });
                            }
                        });
                    });
                } else {
                    // 전량 반려인 경우
                    db.run(`
                        INSERT INTO notifications (
                            type, title, message, priority, related_id, related_table
                        ) VALUES ('quality_issue', ?, ?, 'high', ?, 'quality_checks')
                    `, [
                        '품질 검사 전량 반려',
                        `품질 검사에서 전량이 반려되었습니다. (반려: ${rejected_quantity})`,
                        id
                    ], function(err) {
                        if (err) {
                            console.error('알림 생성 오류:', err);
                        }

                        db.run('COMMIT');
                        res.json({
                            success: true,
                            message: '품질 검사가 완료되었습니다.',
                            data: {
                                status: status,
                                approved_quantity: approved_quantity,
                                rejected_quantity: rejected_quantity
                            }
                        });
                    });
                }
            });
        });
    });
});

// 입고별 품질 검사 목록 조회
router.get('/shipment/:shipmentId', (req, res) => {
    const { shipmentId } = req.params;

    const query = `
        SELECT
            qc.id, qc.status, qc.check_date, qc.approved_quantity,
            qc.rejected_quantity, qc.visual_inspection, qc.documentation_check,
            qc.sample_test, qc.comments,
            p.product_code, p.name as product_name, p.unit,
            si.batch_number, si.received_quantity,
            u.full_name as inspector_name
        FROM quality_checks qc
        INNER JOIN shipment_items si ON qc.shipment_item_id = si.id
        INNER JOIN products p ON si.product_id = p.id
        LEFT JOIN users u ON qc.inspector_id = u.id
        WHERE si.shipment_id = ?
        ORDER BY qc.check_date DESC
    `;

    db.all(query, [shipmentId], (err, checks) => {
        if (err) {
            console.error('입고 품질 검사 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '입고 품질 검사 조회 중 오류가 발생했습니다.'
            });
        }

        res.json({
            success: true,
            data: { checks }
        });
    });
});

// 검사 대기 중인 입고 상품 조회
router.get('/pending/items', requireQuality, (req, res) => {
    const query = `
        SELECT
            si.id, si.batch_number, si.received_quantity, si.expiry_date,
            p.product_code, p.name as product_name, p.unit, p.specifications,
            c.name as category_name,
            s.shipment_number, s.received_date,
            sup.name as supplier_name
        FROM shipment_items si
        INNER JOIN shipments s ON si.shipment_id = s.id
        INNER JOIN products p ON si.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers sup ON s.supplier_id = sup.id
        LEFT JOIN quality_checks qc ON si.id = qc.shipment_item_id
        WHERE si.received_quantity > 0
        AND qc.id IS NULL
        ORDER BY s.received_date DESC
    `;

    db.all(query, (err, items) => {
        if (err) {
            console.error('검사 대기 상품 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '검사 대기 상품 조회 중 오류가 발생했습니다.'
            });
        }

        res.json({
            success: true,
            data: { items }
        });
    });
});

// 품질 검사 대시보드 요약
router.get('/dashboard/summary', (req, res) => {
    const queries = {
        totalChecks: 'SELECT COUNT(*) as count FROM quality_checks',
        pendingChecks: 'SELECT COUNT(*) as count FROM quality_checks WHERE status = "pending"',
        passedChecks: 'SELECT COUNT(*) as count FROM quality_checks WHERE status = "pass"',
        failedChecks: 'SELECT COUNT(*) as count FROM quality_checks WHERE status = "fail"',
        thisWeekChecks: `
            SELECT COUNT(*) as count
            FROM quality_checks
            WHERE date(check_date) >= date('now', '-7 days')
        `,
        pendingItems: `
            SELECT COUNT(*) as count
            FROM shipment_items si
            LEFT JOIN quality_checks qc ON si.id = qc.shipment_item_id
            WHERE si.received_quantity > 0 AND qc.id IS NULL
        `,
        rejectionRate: `
            SELECT
                ROUND(
                    CAST(SUM(rejected_quantity) AS FLOAT) /
                    NULLIF(SUM(approved_quantity + rejected_quantity), 0) * 100, 2
                ) as rate
            FROM quality_checks
            WHERE approved_quantity + rejected_quantity > 0
        `
    };

    const results = {};
    let completedQueries = 0;

    Object.keys(queries).forEach(key => {
        db.get(queries[key], (err, result) => {
            if (err) {
                console.error(`품질 검사 요약 조회 오류 (${key}):`, err);
                results[key] = { error: true };
            } else {
                results[key] = result;
            }

            completedQueries++;
            if (completedQueries === Object.keys(queries).length) {
                res.json({
                    success: true,
                    data: {
                        total_checks: results.totalChecks.count || 0,
                        pending_checks: results.pendingChecks.count || 0,
                        passed_checks: results.passedChecks.count || 0,
                        failed_checks: results.failedChecks.count || 0,
                        this_week_checks: results.thisWeekChecks.count || 0,
                        pending_items: results.pendingItems.count || 0,
                        rejection_rate: results.rejectionRate.rate || 0
                    }
                });
            }
        });
    });
});

module.exports = router;