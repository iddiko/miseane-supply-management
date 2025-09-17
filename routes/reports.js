const express = require('express');
const { db } = require('../database/init');
const { authenticateToken, requirePurchaser, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

// 대시보드 통계 데이터
router.get('/dashboard/stats', (req, res) => {
    const queries = {
        // 총 제품 수
        totalProducts: 'SELECT COUNT(*) as count FROM products WHERE is_active = 1',
        // 총 공급업체 수
        totalSuppliers: 'SELECT COUNT(*) as count FROM suppliers WHERE is_active = 1',
        // 미달 재고 수
        lowStockCount: `
            SELECT COUNT(DISTINCT p.id) as count
            FROM products p
            LEFT JOIN inventory i ON p.id = i.product_id
            WHERE p.is_active = 1
            AND (COALESCE(SUM(i.quantity - i.reserved_quantity), 0) <= p.min_stock_level)
        `,
        // 오늘 주문 수
        todayOrders: `
            SELECT COUNT(*) as count
            FROM purchase_orders
            WHERE DATE(created_at) = DATE('now')
        `,
        // 이번 달 총 주문 금액
        monthlyOrderValue: `
            SELECT COALESCE(SUM(total_amount), 0) as amount
            FROM purchase_orders
            WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
        `
    };

    Promise.all([
        new Promise((resolve) => db.get(queries.totalProducts, (err, row) => resolve(row?.count || 0))),
        new Promise((resolve) => db.get(queries.totalSuppliers, (err, row) => resolve(row?.count || 0))),
        new Promise((resolve) => db.get(queries.lowStockCount, (err, row) => resolve(row?.count || 0))),
        new Promise((resolve) => db.get(queries.todayOrders, (err, row) => resolve(row?.count || 0))),
        new Promise((resolve) => db.get(queries.monthlyOrderValue, (err, row) => resolve(row?.amount || 0)))
    ]).then(([totalProducts, totalSuppliers, lowStockCount, todayOrders, monthlyOrderValue]) => {
        res.json({
            success: true,
            data: {
                totalProducts,
                totalSuppliers,
                lowStockCount,
                todayOrders,
                monthlyOrderValue
            }
        });
    }).catch(error => {
        console.error('Dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: '통계 데이터 조회 중 오류가 발생했습니다.'
        });
    });
});

// 최근 활동 로그
router.get('/dashboard/recent-activities', (req, res) => {
    const query = `
        SELECT 'order' as type, id, 'New Purchase Order #' || id as message, created_at
        FROM purchase_orders
        ORDER BY created_at DESC
        LIMIT 10
    `;

    db.all(query, (err, activities) => {
        if (err) {
            console.error('Recent activities error:', err);
            return res.status(500).json({
                success: false,
                message: '최근 활동 조회 중 오류가 발생했습니다.'
            });
        }

        res.json({
            success: true,
            data: activities || []
        });
    });
});

// 재고 현황 보고서
router.get('/inventory/status', (req, res) => {
    const category_id = req.query.category_id || '';
    const supplier_id = req.query.supplier_id || '';
    const location = req.query.location || '';

    let query = `
        SELECT
            p.id, p.product_code, p.name as product_name, p.unit,
            p.min_stock_level, p.max_stock_level, p.unit_price,
            c.name as category_name,
            s.name as supplier_name,
            COALESCE(SUM(i.quantity), 0) as total_quantity,
            COALESCE(SUM(i.reserved_quantity), 0) as total_reserved,
            COALESCE(SUM(i.quantity - i.reserved_quantity), 0) as available_quantity,
            COALESCE(SUM(i.quantity * i.unit_cost), 0) as total_value,
            COALESCE(AVG(i.unit_cost), p.unit_price) as avg_cost,
            COUNT(DISTINCT i.batch_number) as batch_count,
            MIN(i.expiry_date) as earliest_expiry,
            CASE
                WHEN COALESCE(SUM(i.quantity - i.reserved_quantity), 0) <= p.min_stock_level THEN 'low'
                WHEN COALESCE(SUM(i.quantity - i.reserved_quantity), 0) >= p.max_stock_level THEN 'high'
                ELSE 'normal'
            END as stock_status
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN inventory i ON p.id = i.product_id
        WHERE p.is_active = 1
    `;
    const params = [];

    if (category_id) {
        query += ' AND p.category_id = ?';
        params.push(category_id);
    }

    if (supplier_id) {
        query += ' AND p.supplier_id = ?';
        params.push(supplier_id);
    }

    if (location) {
        query += ' AND i.location = ?';
        params.push(location);
    }

    query += ' GROUP BY p.id ORDER BY total_value DESC';

    db.all(query, params, (err, inventory) => {
        if (err) {
            console.error('재고 현황 보고서 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '재고 현황 보고서 조회 중 오류가 발생했습니다.'
            });
        }

        // 요약 정보 계산
        const summary = inventory.reduce((acc, item) => {
            acc.total_products++;
            acc.total_value += parseFloat(item.total_value) || 0;
            acc.total_quantity += parseInt(item.total_quantity) || 0;

            if (item.stock_status === 'low') acc.low_stock_items++;
            else if (item.stock_status === 'high') acc.high_stock_items++;
            else acc.normal_stock_items++;

            return acc;
        }, {
            total_products: 0,
            total_value: 0,
            total_quantity: 0,
            low_stock_items: 0,
            normal_stock_items: 0,
            high_stock_items: 0
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

// 재고 이동 보고서
router.get('/inventory/movements', (req, res) => {
    const date_from = req.query.date_from || '';
    const date_to = req.query.date_to || '';
    const product_id = req.query.product_id || '';
    const movement_type = req.query.movement_type || ''; // 'in', 'out', 'adjustment'

    // 입고 데이터
    let incomingQuery = `
        SELECT
            'incoming' as movement_type,
            si.product_id,
            p.product_code, p.name as product_name, p.unit,
            si.received_quantity as quantity,
            si.batch_number,
            si.unit_cost,
            s.received_date as movement_date,
            s.shipment_number as reference,
            'shipment' as source_table,
            sup.name as supplier_name
        FROM shipment_items si
        INNER JOIN shipments s ON si.shipment_id = s.id
        INNER JOIN products p ON si.product_id = p.id
        LEFT JOIN suppliers sup ON s.supplier_id = sup.id
        WHERE si.received_quantity > 0
    `;

    // 재고 조정 데이터는 notifications 테이블에서 임시로 조회
    let adjustmentQuery = `
        SELECT
            'adjustment' as movement_type,
            CAST(n.related_id AS INTEGER) as product_id,
            '' as product_code, n.title as product_name, '' as unit,
            0 as quantity,
            '' as batch_number,
            0 as unit_cost,
            n.created_at as movement_date,
            'ADJ-' || n.id as reference,
            'adjustment' as source_table,
            '' as supplier_name
        FROM notifications n
        WHERE n.type = 'inventory_adjustment'
    `;

    const params = [];
    let whereConditions = '';

    if (date_from) {
        whereConditions += ' AND date(s.received_date) >= ?';
        params.push(date_from);
    }

    if (date_to) {
        whereConditions += ' AND date(s.received_date) <= ?';
        params.push(date_to);
    }

    if (product_id) {
        whereConditions += ' AND si.product_id = ?';
        params.push(product_id);
    }

    let finalQuery = '';
    if (!movement_type || movement_type === 'in') {
        finalQuery = incomingQuery + whereConditions;
    }

    if (!movement_type || movement_type === 'adjustment') {
        if (finalQuery) finalQuery += ' UNION ALL ';
        finalQuery += adjustmentQuery;
    }

    if (!finalQuery) {
        finalQuery = incomingQuery + whereConditions;
    }

    finalQuery += ' ORDER BY movement_date DESC LIMIT 1000';

    db.all(finalQuery, params, (err, movements) => {
        if (err) {
            console.error('재고 이동 보고서 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '재고 이동 보고서 조회 중 오류가 발생했습니다.'
            });
        }

        // 요약 정보
        const summary = movements.reduce((acc, movement) => {
            acc.total_movements++;
            if (movement.movement_type === 'incoming') {
                acc.total_incoming += movement.quantity;
                acc.incoming_value += movement.quantity * (movement.unit_cost || 0);
            } else if (movement.movement_type === 'adjustment') {
                acc.total_adjustments++;
            }
            return acc;
        }, {
            total_movements: 0,
            total_incoming: 0,
            incoming_value: 0,
            total_adjustments: 0
        });

        res.json({
            success: true,
            data: {
                movements,
                summary
            }
        });
    });
});

// 구매 주문 보고서
router.get('/orders/summary', requirePurchaser, (req, res) => {
    const date_from = req.query.date_from || '';
    const date_to = req.query.date_to || '';
    const supplier_id = req.query.supplier_id || '';
    const status = req.query.status || '';

    let query = `
        SELECT
            po.id, po.po_number, po.status, po.order_date,
            po.expected_delivery, po.total_amount, po.approved_at,
            s.name as supplier_name, s.supplier_code,
            u1.full_name as requested_by,
            u2.full_name as approved_by,
            COUNT(poi.id) as item_count,
            SUM(poi.quantity) as total_quantity,
            SUM(poi.received_quantity) as received_quantity,
            CASE
                WHEN po.expected_delivery < date('now') AND po.status NOT IN ('completed', 'cancelled') THEN 'overdue'
                WHEN po.status = 'completed' THEN 'completed'
                WHEN po.status = 'cancelled' THEN 'cancelled'
                ELSE 'active'
            END as order_status
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        LEFT JOIN users u1 ON po.requested_by = u1.id
        LEFT JOIN users u2 ON po.approved_by = u2.id
        LEFT JOIN purchase_order_items poi ON po.id = poi.po_id
        WHERE 1=1
    `;
    const params = [];

    if (date_from) {
        query += ' AND date(po.order_date) >= ?';
        params.push(date_from);
    }

    if (date_to) {
        query += ' AND date(po.order_date) <= ?';
        params.push(date_to);
    }

    if (supplier_id) {
        query += ' AND po.supplier_id = ?';
        params.push(supplier_id);
    }

    if (status) {
        query += ' AND po.status = ?';
        params.push(status);
    }

    query += ' GROUP BY po.id ORDER BY po.order_date DESC';

    db.all(query, params, (err, orders) => {
        if (err) {
            console.error('구매 주문 보고서 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '구매 주문 보고서 조회 중 오류가 발생했습니다.'
            });
        }

        // 요약 정보
        const summary = orders.reduce((acc, order) => {
            acc.total_orders++;
            acc.total_amount += parseFloat(order.total_amount) || 0;

            switch (order.order_status) {
                case 'completed': acc.completed_orders++; break;
                case 'cancelled': acc.cancelled_orders++; break;
                case 'overdue': acc.overdue_orders++; break;
                default: acc.active_orders++; break;
            }

            return acc;
        }, {
            total_orders: 0,
            total_amount: 0,
            active_orders: 0,
            completed_orders: 0,
            cancelled_orders: 0,
            overdue_orders: 0
        });

        res.json({
            success: true,
            data: {
                orders,
                summary
            }
        });
    });
});

// 공급업체별 구매 분석 보고서
router.get('/suppliers/analysis', requirePurchaser, (req, res) => {
    const date_from = req.query.date_from || '';
    const date_to = req.query.date_to || '';

    let query = `
        SELECT
            s.id, s.supplier_code, s.name, s.rating, s.country,
            COUNT(DISTINCT po.id) as total_orders,
            SUM(po.total_amount) as total_amount,
            AVG(po.total_amount) as avg_order_amount,
            COUNT(DISTINCT CASE WHEN po.status = 'completed' THEN po.id END) as completed_orders,
            COUNT(DISTINCT CASE WHEN po.expected_delivery < date('now') AND po.status NOT IN ('completed', 'cancelled') THEN po.id END) as overdue_orders,
            AVG(CASE WHEN po.approved_at IS NOT NULL AND po.order_date IS NOT NULL THEN julianday(po.approved_at) - julianday(po.order_date) END) as avg_approval_days,
            COUNT(DISTINCT p.id) as product_count,
            SUM(CASE WHEN qc.status = 'fail' THEN 1 ELSE 0 END) as quality_issues
        FROM suppliers s
        LEFT JOIN purchase_orders po ON s.id = po.supplier_id
        LEFT JOIN products p ON s.id = p.supplier_id
        LEFT JOIN shipments sh ON s.id = sh.supplier_id
        LEFT JOIN shipment_items si ON sh.id = si.shipment_id
        LEFT JOIN quality_checks qc ON si.id = qc.shipment_item_id
        WHERE s.status = 'active'
    `;
    const params = [];

    if (date_from) {
        query += ' AND (po.order_date IS NULL OR date(po.order_date) >= ?)';
        params.push(date_from);
    }

    if (date_to) {
        query += ' AND (po.order_date IS NULL OR date(po.order_date) <= ?)';
        params.push(date_to);
    }

    query += ' GROUP BY s.id ORDER BY total_amount DESC';

    db.all(query, params, (err, suppliers) => {
        if (err) {
            console.error('공급업체 분석 보고서 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '공급업체 분석 보고서 조회 중 오류가 발생했습니다.'
            });
        }

        // 성과 지표 계산
        const analysis = suppliers.map(supplier => ({
            ...supplier,
            completion_rate: supplier.total_orders > 0 ?
                Math.round((supplier.completed_orders / supplier.total_orders) * 100) : 0,
            on_time_rate: supplier.total_orders > 0 ?
                Math.round(((supplier.total_orders - supplier.overdue_orders) / supplier.total_orders) * 100) : 0,
            quality_score: supplier.total_orders > 0 ?
                Math.round(((supplier.total_orders - supplier.quality_issues) / supplier.total_orders) * 100) : 100
        }));

        res.json({
            success: true,
            data: { suppliers: analysis }
        });
    });
});

// 품질 검사 보고서
router.get('/quality/summary', (req, res) => {
    const date_from = req.query.date_from || '';
    const date_to = req.query.date_to || '';
    const supplier_id = req.query.supplier_id || '';

    let query = `
        SELECT
            qc.id, qc.status, qc.check_date, qc.approved_quantity,
            qc.rejected_quantity, qc.visual_inspection, qc.documentation_check,
            qc.sample_test, qc.comments,
            p.product_code, p.name as product_name,
            c.name as category_name,
            s.name as supplier_name,
            si.batch_number, si.received_quantity,
            u.full_name as inspector_name,
            CASE
                WHEN qc.approved_quantity + qc.rejected_quantity > 0 THEN
                    ROUND((CAST(qc.rejected_quantity AS FLOAT) / (qc.approved_quantity + qc.rejected_quantity)) * 100, 2)
                ELSE 0
            END as rejection_rate
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

    if (date_from) {
        query += ' AND date(qc.check_date) >= ?';
        params.push(date_from);
    }

    if (date_to) {
        query += ' AND date(qc.check_date) <= ?';
        params.push(date_to);
    }

    if (supplier_id) {
        query += ' AND s.supplier_id = ?';
        params.push(supplier_id);
    }

    query += ' ORDER BY qc.check_date DESC';

    db.all(query, params, (err, checks) => {
        if (err) {
            console.error('품질 검사 보고서 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '품질 검사 보고서 조회 중 오류가 발생했습니다.'
            });
        }

        // 요약 정보
        const summary = checks.reduce((acc, check) => {
            acc.total_checks++;
            acc.total_approved += check.approved_quantity || 0;
            acc.total_rejected += check.rejected_quantity || 0;

            switch (check.status) {
                case 'pass': acc.passed_checks++; break;
                case 'fail': acc.failed_checks++; break;
                case 'conditional': acc.conditional_checks++; break;
                default: acc.pending_checks++; break;
            }

            if (check.visual_inspection) acc.visual_inspections++;
            if (check.documentation_check) acc.doc_checks++;
            if (check.sample_test) acc.sample_tests++;

            return acc;
        }, {
            total_checks: 0,
            total_approved: 0,
            total_rejected: 0,
            passed_checks: 0,
            failed_checks: 0,
            conditional_checks: 0,
            pending_checks: 0,
            visual_inspections: 0,
            doc_checks: 0,
            sample_tests: 0
        });

        // 전체 합격률 계산
        const totalInspected = summary.total_approved + summary.total_rejected;
        summary.overall_pass_rate = totalInspected > 0 ?
            Math.round((summary.total_approved / totalInspected) * 100) : 0;

        res.json({
            success: true,
            data: {
                checks,
                summary
            }
        });
    });
});

// 만료 예정/만료된 제품 보고서
router.get('/inventory/expiring', (req, res) => {
    const days = parseInt(req.query.days) || 30;

    const query = `
        SELECT
            i.id, i.batch_number, i.quantity, i.expiry_date, i.location,
            p.product_code, p.name as product_name, p.unit, p.unit_price,
            c.name as category_name,
            s.name as supplier_name,
            (julianday(i.expiry_date) - julianday('now')) as days_to_expiry,
            (i.quantity * COALESCE(i.unit_cost, p.unit_price)) as total_value,
            CASE
                WHEN i.expiry_date <= date('now') THEN 'expired'
                WHEN i.expiry_date <= date('now', '+7 days') THEN 'critical'
                WHEN i.expiry_date <= date('now', '+30 days') THEN 'warning'
                ELSE 'normal'
            END as urgency_level
        FROM inventory i
        INNER JOIN products p ON i.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE i.quantity > 0
        AND i.expiry_date <= date('now', '+' || ? || ' days')
        ORDER BY i.expiry_date ASC
    `;

    db.all(query, [days], (err, items) => {
        if (err) {
            console.error('만료 예정 제품 보고서 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '만료 예정 제품 보고서 조회 중 오류가 발생했습니다.'
            });
        }

        // 요약 정보
        const summary = items.reduce((acc, item) => {
            acc.total_items++;
            acc.total_quantity += item.quantity;
            acc.total_value += item.total_value || 0;

            switch (item.urgency_level) {
                case 'expired': acc.expired_items++; break;
                case 'critical': acc.critical_items++; break;
                case 'warning': acc.warning_items++; break;
                default: acc.normal_items++; break;
            }

            return acc;
        }, {
            total_items: 0,
            total_quantity: 0,
            total_value: 0,
            expired_items: 0,
            critical_items: 0,
            warning_items: 0,
            normal_items: 0
        });

        res.json({
            success: true,
            data: {
                items,
                summary
            }
        });
    });
});

// 대시보드용 종합 보고서
router.get('/dashboard/overview', (req, res) => {
    const queries = {
        // 재고 요약
        inventorySummary: `
            SELECT
                COUNT(DISTINCT p.id) as total_products,
                SUM(i.quantity) as total_stock,
                SUM(i.quantity * COALESCE(i.unit_cost, p.unit_price)) as total_value,
                COUNT(CASE WHEN SUM(i.quantity - i.reserved_quantity) <= p.min_stock_level THEN 1 END) as low_stock_products
            FROM products p
            LEFT JOIN inventory i ON p.id = i.product_id
            WHERE p.is_active = 1
        `,

        // 주문 요약 (이번 달)
        orderSummary: `
            SELECT
                COUNT(*) as total_orders,
                SUM(total_amount) as total_amount,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
                COUNT(CASE WHEN expected_delivery < date('now') AND status NOT IN ('completed', 'cancelled') THEN 1 END) as overdue_orders
            FROM purchase_orders
            WHERE date(order_date) >= date('now', 'start of month')
        `,

        // 품질 검사 요약 (이번 달)
        qualitySummary: `
            SELECT
                COUNT(*) as total_checks,
                SUM(approved_quantity) as total_approved,
                SUM(rejected_quantity) as total_rejected,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_checks
            FROM quality_checks
            WHERE date(check_date) >= date('now', 'start of month')
        `,

        // 입고 요약 (이번 주)
        shipmentSummary: `
            SELECT
                COUNT(*) as total_shipments,
                COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_shipments,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_shipments
            FROM shipments
            WHERE date(received_date) >= date('now', '-7 days')
        `
    };

    const results = {};
    let completedQueries = 0;

    Object.keys(queries).forEach(key => {
        db.get(queries[key], (err, result) => {
            if (err) {
                console.error(`대시보드 보고서 조회 오류 (${key}):`, err);
                results[key] = { error: true };
            } else {
                results[key] = result;
            }

            completedQueries++;
            if (completedQueries === Object.keys(queries).length) {
                res.json({
                    success: true,
                    data: {
                        inventory: results.inventorySummary || {},
                        orders: results.orderSummary || {},
                        quality: results.qualitySummary || {},
                        shipments: results.shipmentSummary || {}
                    }
                });
            }
        });
    });
});

// 보고서 내보내기 (CSV 형식) - 기본 구현
router.get('/export/:reportType', requirePurchaser, (req, res) => {
    const { reportType } = req.params;
    const format = req.query.format || 'json'; // json, csv

    if (format !== 'json' && format !== 'csv') {
        return res.status(400).json({
            success: false,
            message: '지원하지 않는 형식입니다. (json, csv만 지원)'
        });
    }

    // 간단한 CSV 변환 함수
    const convertToCSV = (data) => {
        if (!data || data.length === 0) return '';

        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(row =>
            Object.values(row).map(value =>
                typeof value === 'string' && value.includes(',') ? `"${value}"` : value
            ).join(',')
        ).join('\n');

        return headers + '\n' + rows;
    };

    switch (reportType) {
        case 'inventory':
            // 재고 현황 보고서 내보내기 로직
            res.json({
                success: true,
                message: '재고 현황 보고서 내보내기 기능이 구현될 예정입니다.',
                data: { report_type: reportType, format }
            });
            break;

        case 'orders':
            // 구매 주문 보고서 내보내기 로직
            res.json({
                success: true,
                message: '구매 주문 보고서 내보내기 기능이 구현될 예정입니다.',
                data: { report_type: reportType, format }
            });
            break;

        default:
            res.status(400).json({
                success: false,
                message: '지원하지 않는 보고서 유형입니다.'
            });
    }
});

module.exports = router;