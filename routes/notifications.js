const express = require('express');
const { db } = require('../database/init');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

// 알림 목록 조회 (검색, 필터링, 페이지네이션)
router.get('/', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const type = req.query.type || '';
    const priority = req.query.priority || '';
    const is_read = req.query.is_read || '';
    const user_id = req.query.user_id || req.user.userId; // 기본적으로 현재 사용자의 알림만

    let query = `
        SELECT
            n.id, n.type, n.title, n.message, n.is_read, n.priority,
            n.related_id, n.related_table, n.created_at,
            u.full_name as user_name
        FROM notifications n
        LEFT JOIN users u ON n.user_id = u.id
        WHERE 1=1
    `;
    const params = [];

    // 관리자가 아닌 경우 자신의 알림만 조회
    if (req.user.role !== 'admin' && !req.query.user_id) {
        query += ' AND (n.user_id = ? OR n.user_id IS NULL)';
        params.push(req.user.userId);
    } else if (user_id) {
        query += ' AND n.user_id = ?';
        params.push(user_id);
    }

    if (type) {
        query += ' AND n.type = ?';
        params.push(type);
    }

    if (priority) {
        query += ' AND n.priority = ?';
        params.push(priority);
    }

    if (is_read !== '') {
        query += ' AND n.is_read = ?';
        params.push(is_read === 'true' ? 1 : 0);
    }

    query += ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    db.all(query, params, (err, notifications) => {
        if (err) {
            console.error('알림 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '알림 목록 조회 중 오류가 발생했습니다.'
            });
        }

        // 총 개수 조회
        let countQuery = 'SELECT COUNT(*) as total FROM notifications n WHERE 1=1';
        const countParams = [];

        if (req.user.role !== 'admin' && !req.query.user_id) {
            countQuery += ' AND (n.user_id = ? OR n.user_id IS NULL)';
            countParams.push(req.user.userId);
        } else if (user_id) {
            countQuery += ' AND n.user_id = ?';
            countParams.push(user_id);
        }

        if (type) {
            countQuery += ' AND n.type = ?';
            countParams.push(type);
        }

        if (priority) {
            countQuery += ' AND n.priority = ?';
            countParams.push(priority);
        }

        if (is_read !== '') {
            countQuery += ' AND n.is_read = ?';
            countParams.push(is_read === 'true' ? 1 : 0);
        }

        db.get(countQuery, countParams, (err, countResult) => {
            if (err) {
                console.error('알림 개수 조회 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '알림 개수 조회 중 오류가 발생했습니다.'
                });
            }

            res.json({
                success: true,
                data: {
                    notifications,
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

// 읽지 않은 알림 개수 조회
router.get('/unread/count', (req, res) => {
    const query = `
        SELECT COUNT(*) as count
        FROM notifications
        WHERE (user_id = ? OR user_id IS NULL)
        AND is_read = 0
    `;

    db.get(query, [req.user.userId], (err, result) => {
        if (err) {
            console.error('읽지 않은 알림 개수 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '읽지 않은 알림 개수 조회 중 오류가 발생했습니다.'
            });
        }

        res.json({
            success: true,
            data: {
                unread_count: result.count
            }
        });
    });
});

// 알림 상세 조회
router.get('/:id', (req, res) => {
    const { id } = req.params;

    const query = `
        SELECT
            n.*,
            u.full_name as user_name, u.email as user_email
        FROM notifications n
        LEFT JOIN users u ON n.user_id = u.id
        WHERE n.id = ?
    `;

    // 권한 확인: 관리자이거나 자신의 알림인 경우만 조회 가능
    const authQuery = req.user.role === 'admin' ? query : `${query} AND (n.user_id = ? OR n.user_id IS NULL)`;
    const authParams = req.user.role === 'admin' ? [id] : [id, req.user.userId];

    db.get(authQuery, authParams, (err, notification) => {
        if (err) {
            console.error('알림 상세 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '알림 상세 정보 조회 중 오류가 발생했습니다.'
            });
        }

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: '알림을 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            data: { notification }
        });
    });
});

// 알림 생성 (관리자만)
router.post('/', requireAdmin, (req, res) => {
    const {
        user_id,
        type,
        title,
        message,
        priority,
        related_id,
        related_table
    } = req.body;

    // 필수 필드 검증
    if (!type || !title || !message) {
        return res.status(400).json({
            success: false,
            message: '알림 유형, 제목, 메시지는 필수 입력 사항입니다.'
        });
    }

    const validTypes = ['low_stock', 'expired', 'quality_issue', 'order_approval', 'shipment'];
    const validPriorities = ['low', 'medium', 'high'];

    if (!validTypes.includes(type)) {
        return res.status(400).json({
            success: false,
            message: '유효하지 않은 알림 유형입니다.'
        });
    }

    if (priority && !validPriorities.includes(priority)) {
        return res.status(400).json({
            success: false,
            message: '유효하지 않은 우선순위입니다.'
        });
    }

    db.run(`
        INSERT INTO notifications (
            user_id, type, title, message, priority, related_id, related_table
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
        user_id || null, type, title, message,
        priority || 'medium', related_id || null, related_table || null
    ], function(err) {
        if (err) {
            console.error('알림 생성 오류:', err);
            return res.status(500).json({
                success: false,
                message: '알림 생성 중 오류가 발생했습니다.'
            });
        }

        res.status(201).json({
            success: true,
            message: '알림이 성공적으로 생성되었습니다.',
            data: {
                notification_id: this.lastID
            }
        });
    });
});

// 알림 읽음 처리
router.put('/:id/read', (req, res) => {
    const { id } = req.params;

    // 권한 확인: 관리자이거나 자신의 알림인 경우만 수정 가능
    const authCondition = req.user.role === 'admin' ? '' : ' AND (user_id = ? OR user_id IS NULL)';
    const authParams = req.user.role === 'admin' ? [id] : [id, req.user.userId];

    const query = `UPDATE notifications SET is_read = 1 WHERE id = ?${authCondition}`;

    db.run(query, authParams, function(err) {
        if (err) {
            console.error('알림 읽음 처리 오류:', err);
            return res.status(500).json({
                success: false,
                message: '알림 읽음 처리 중 오류가 발생했습니다.'
            });
        }

        if (this.changes === 0) {
            return res.status(404).json({
                success: false,
                message: '알림을 찾을 수 없거나 권한이 없습니다.'
            });
        }

        res.json({
            success: true,
            message: '알림이 읽음 처리되었습니다.'
        });
    });
});

// 모든 알림 읽음 처리
router.put('/read/all', (req, res) => {
    const query = `
        UPDATE notifications SET is_read = 1
        WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0
    `;

    db.run(query, [req.user.userId], function(err) {
        if (err) {
            console.error('모든 알림 읽음 처리 오류:', err);
            return res.status(500).json({
                success: false,
                message: '모든 알림 읽음 처리 중 오류가 발생했습니다.'
            });
        }

        res.json({
            success: true,
            message: `${this.changes}개의 알림이 읽음 처리되었습니다.`,
            data: {
                updated_count: this.changes
            }
        });
    });
});

// 알림 삭제 (관리자만)
router.delete('/:id', requireAdmin, (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM notifications WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('알림 삭제 오류:', err);
            return res.status(500).json({
                success: false,
                message: '알림 삭제 중 오류가 발생했습니다.'
            });
        }

        if (this.changes === 0) {
            return res.status(404).json({
                success: false,
                message: '알림을 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            message: '알림이 성공적으로 삭제되었습니다.'
        });
    });
});

// 대량 알림 생성 (관리자만) - 재고 부족, 만료 예정 등 시스템 알림
router.post('/system/generate', requireAdmin, (req, res) => {
    const { type } = req.body;

    if (!type) {
        return res.status(400).json({
            success: false,
            message: '알림 유형은 필수 입력 사항입니다.'
        });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        let generatedCount = 0;
        let hasError = false;

        switch (type) {
            case 'low_stock':
                // 재고 부족 알림 생성
                const lowStockQuery = `
                    SELECT
                        p.id, p.product_code, p.name, p.min_stock_level,
                        COALESCE(SUM(i.quantity - i.reserved_quantity), 0) as available_stock
                    FROM products p
                    LEFT JOIN inventory i ON p.id = i.product_id
                    WHERE p.is_active = 1
                    GROUP BY p.id
                    HAVING available_stock <= p.min_stock_level
                `;

                db.all(lowStockQuery, (err, products) => {
                    if (err) {
                        hasError = true;
                        db.run('ROLLBACK');
                        console.error('재고 부족 제품 조회 오류:', err);
                        return res.status(500).json({
                            success: false,
                            message: '재고 부족 알림 생성 중 오류가 발생했습니다.'
                        });
                    }

                    if (products.length === 0) {
                        db.run('COMMIT');
                        return res.json({
                            success: true,
                            message: '재고 부족인 제품이 없습니다.',
                            data: { generated_count: 0 }
                        });
                    }

                    products.forEach((product) => {
                        if (hasError) return;

                        db.run(`
                            INSERT INTO notifications (
                                type, title, message, priority, related_id, related_table
                            ) VALUES ('low_stock', ?, ?, 'high', ?, 'products')
                        `, [
                            `재고 부족 알림: ${product.name}`,
                            `제품 "${product.name} (${product.product_code})"의 재고가 부족합니다. 현재 재고: ${product.available_stock}, 최소 재고: ${product.min_stock_level}`,
                            product.id
                        ], function(err) {
                            if (err) {
                                hasError = true;
                                db.run('ROLLBACK');
                                console.error('재고 부족 알림 생성 오류:', err);
                                return res.status(500).json({
                                    success: false,
                                    message: '재고 부족 알림 생성 중 오류가 발생했습니다.'
                                });
                            }

                            generatedCount++;
                            if (generatedCount === products.length && !hasError) {
                                db.run('COMMIT');
                                res.json({
                                    success: true,
                                    message: '재고 부족 알림이 성공적으로 생성되었습니다.',
                                    data: { generated_count: generatedCount }
                                });
                            }
                        });
                    });
                });
                break;

            case 'expired':
                // 만료된 재고 알림 생성
                const expiredQuery = `
                    SELECT
                        i.id, i.batch_number, i.quantity, i.expiry_date,
                        p.product_code, p.name as product_name
                    FROM inventory i
                    INNER JOIN products p ON i.product_id = p.id
                    WHERE i.quantity > 0
                    AND i.expiry_date <= date('now')
                    AND NOT EXISTS (
                        SELECT 1 FROM notifications n
                        WHERE n.type = 'expired'
                        AND n.related_id = i.id
                        AND n.related_table = 'inventory'
                        AND date(n.created_at) = date('now')
                    )
                `;

                db.all(expiredQuery, (err, items) => {
                    if (err) {
                        hasError = true;
                        db.run('ROLLBACK');
                        console.error('만료된 재고 조회 오류:', err);
                        return res.status(500).json({
                            success: false,
                            message: '만료 재고 알림 생성 중 오류가 발생했습니다.'
                        });
                    }

                    if (items.length === 0) {
                        db.run('COMMIT');
                        return res.json({
                            success: true,
                            message: '만료된 재고가 없습니다.',
                            data: { generated_count: 0 }
                        });
                    }

                    items.forEach((item) => {
                        if (hasError) return;

                        db.run(`
                            INSERT INTO notifications (
                                type, title, message, priority, related_id, related_table
                            ) VALUES ('expired', ?, ?, 'high', ?, 'inventory')
                        `, [
                            `만료 재고 알림: ${item.product_name}`,
                            `제품 "${item.product_name} (${item.product_code})" 배치 "${item.batch_number}"이 만료되었습니다. 수량: ${item.quantity}, 만료일: ${item.expiry_date}`,
                            item.id
                        ], function(err) {
                            if (err) {
                                hasError = true;
                                db.run('ROLLBACK');
                                console.error('만료 재고 알림 생성 오류:', err);
                                return res.status(500).json({
                                    success: false,
                                    message: '만료 재고 알림 생성 중 오류가 발생했습니다.'
                                });
                            }

                            generatedCount++;
                            if (generatedCount === items.length && !hasError) {
                                db.run('COMMIT');
                                res.json({
                                    success: true,
                                    message: '만료 재고 알림이 성공적으로 생성되었습니다.',
                                    data: { generated_count: generatedCount }
                                });
                            }
                        });
                    });
                });
                break;

            default:
                db.run('ROLLBACK');
                return res.status(400).json({
                    success: false,
                    message: '지원하지 않는 알림 유형입니다.'
                });
        }
    });
});

// 알림 유형별 통계
router.get('/stats/types', (req, res) => {
    const query = `
        SELECT
            type,
            COUNT(*) as count,
            SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread_count,
            priority,
            COUNT(*) as priority_count
        FROM notifications
        WHERE date(created_at) >= date('now', '-30 days')
        GROUP BY type, priority
        ORDER BY type, priority
    `;

    db.all(query, (err, stats) => {
        if (err) {
            console.error('알림 통계 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '알림 통계 조회 중 오류가 발생했습니다.'
            });
        }

        // 데이터 재구조화
        const typeStats = {};
        stats.forEach(stat => {
            if (!typeStats[stat.type]) {
                typeStats[stat.type] = {
                    total: 0,
                    unread: 0,
                    priorities: {}
                };
            }
            typeStats[stat.type].total += stat.count;
            typeStats[stat.type].unread += stat.unread_count;
            typeStats[stat.type].priorities[stat.priority] = stat.priority_count;
        });

        res.json({
            success: true,
            data: { type_stats: typeStats }
        });
    });
});

// 알림 대시보드 요약
router.get('/dashboard/summary', (req, res) => {
    const queries = {
        totalNotifications: 'SELECT COUNT(*) as count FROM notifications',
        unreadNotifications: 'SELECT COUNT(*) as count FROM notifications WHERE is_read = 0',
        highPriorityNotifications: 'SELECT COUNT(*) as count FROM notifications WHERE priority = "high" AND is_read = 0',
        todayNotifications: `
            SELECT COUNT(*) as count
            FROM notifications
            WHERE date(created_at) = date('now')
        `,
        recentActivity: `
            SELECT type, COUNT(*) as count
            FROM notifications
            WHERE date(created_at) >= date('now', '-7 days')
            GROUP BY type
            ORDER BY count DESC
            LIMIT 5
        `
    };

    const results = {};
    let completedQueries = 0;

    Object.keys(queries).forEach(key => {
        if (key === 'recentActivity') {
            db.all(queries[key], (err, result) => {
                if (err) {
                    console.error(`알림 요약 조회 오류 (${key}):`, err);
                    results[key] = { error: true };
                } else {
                    results[key] = result;
                }

                completedQueries++;
                if (completedQueries === Object.keys(queries).length) {
                    res.json({
                        success: true,
                        data: {
                            total_notifications: results.totalNotifications.count || 0,
                            unread_notifications: results.unreadNotifications.count || 0,
                            high_priority_notifications: results.highPriorityNotifications.count || 0,
                            today_notifications: results.todayNotifications.count || 0,
                            recent_activity: results.recentActivity || []
                        }
                    });
                }
            });
        } else {
            db.get(queries[key], (err, result) => {
                if (err) {
                    console.error(`알림 요약 조회 오류 (${key}):`, err);
                    results[key] = { error: true };
                } else {
                    results[key] = result;
                }

                completedQueries++;
                if (completedQueries === Object.keys(queries).length) {
                    res.json({
                        success: true,
                        data: {
                            total_notifications: results.totalNotifications.count || 0,
                            unread_notifications: results.unreadNotifications.count || 0,
                            high_priority_notifications: results.highPriorityNotifications.count || 0,
                            today_notifications: results.todayNotifications.count || 0,
                            recent_activity: results.recentActivity || []
                        }
                    });
                }
            });
        }
    });
});

module.exports = router;