const express = require('express');
const { db } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('./auth');

const router = express.Router();

// 가격 변동 이력 기록 함수
function recordPriceChange(productId, fieldName, oldValue, newValue, userId, reason = null, callback) {
    // 값이 실제로 변경되었는지 확인
    if (oldValue === newValue) {
        return callback && callback();
    }

    db.run(`
        INSERT INTO product_price_history (
            product_id, field_name, old_value, new_value,
            changed_by, change_reason, changed_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `, [productId, fieldName, oldValue, newValue, userId, reason], function(err) {
        if (err) {
            console.error('Price history recording error:', err);
        }
        if (callback) callback(err, this?.lastID);
    });
}

// 제품의 가격 변동 이력 조회
router.get('/product/:productId', authenticateToken, checkPermission('product', 'read'), (req, res) => {
    const { productId } = req.params;
    const { page = 1, limit = 20, fieldName } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE pph.product_id = ?';
    const params = [productId];

    if (fieldName) {
        whereClause += ' AND pph.field_name = ?';
        params.push(fieldName);
    }

    // 총 개수 조회
    db.get(`
        SELECT COUNT(*) as total
        FROM product_price_history pph
        ${whereClause}
    `, params, (err, countResult) => {
        if (err) {
            console.error('Get price history count error:', err);
            return res.status(500).json({ success: false, message: '가격 이력 개수 조회 중 오류가 발생했습니다' });
        }

        // 가격 이력 조회
        db.all(`
            SELECT pph.*,
                   p.name as product_name, p.product_code,
                   u.full_name as changed_by_name
            FROM product_price_history pph
            LEFT JOIN products p ON pph.product_id = p.id
            LEFT JOIN users u ON pph.changed_by = u.id
            ${whereClause}
            ORDER BY pph.changed_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset], (err, history) => {
            if (err) {
                console.error('Get price history error:', err);
                return res.status(500).json({ success: false, message: '가격 이력 조회 중 오류가 발생했습니다' });
            }

            res.json({
                success: true,
                data: {
                    history,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: countResult.total,
                        totalPages: Math.ceil(countResult.total / limit)
                    }
                }
            });
        });
    });
});

// 전체 가격 변동 이력 조회 (관리자용)
router.get('/all', authenticateToken, checkPermission('price', 'update'), (req, res) => {
    const {
        page = 1,
        limit = 50,
        startDate,
        endDate,
        productId,
        fieldName,
        userId
    } = req.query;

    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (startDate) {
        whereClause += ' AND pph.changed_at >= ?';
        params.push(startDate);
    }

    if (endDate) {
        whereClause += ' AND pph.changed_at <= ?';
        params.push(endDate + ' 23:59:59');
    }

    if (productId) {
        whereClause += ' AND pph.product_id = ?';
        params.push(productId);
    }

    if (fieldName) {
        whereClause += ' AND pph.field_name = ?';
        params.push(fieldName);
    }

    if (userId) {
        whereClause += ' AND pph.changed_by = ?';
        params.push(userId);
    }

    // 총 개수 조회
    db.get(`
        SELECT COUNT(*) as total
        FROM product_price_history pph
        ${whereClause}
    `, params, (err, countResult) => {
        if (err) {
            console.error('Get all price history count error:', err);
            return res.status(500).json({ success: false, message: '가격 이력 개수 조회 중 오류가 발생했습니다' });
        }

        // 가격 이력 조회
        db.all(`
            SELECT pph.*,
                   p.name as product_name, p.product_code,
                   u.full_name as changed_by_name,
                   c.name as category_name
            FROM product_price_history pph
            LEFT JOIN products p ON pph.product_id = p.id
            LEFT JOIN users u ON pph.changed_by = u.id
            LEFT JOIN categories c ON p.category_id = c.id
            ${whereClause}
            ORDER BY pph.changed_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset], (err, history) => {
            if (err) {
                console.error('Get all price history error:', err);
                return res.status(500).json({ success: false, message: '가격 이력 조회 중 오류가 발생했습니다' });
            }

            res.json({
                success: true,
                data: {
                    history,
                    pagination: {
                        page: parseInt(page),
                        limit: parseInt(limit),
                        total: countResult.total,
                        totalPages: Math.ceil(countResult.total / limit)
                    }
                }
            });
        });
    });
});

// 제품 가격 업데이트 (이력 기록 포함)
router.put('/product/:productId/prices', authenticateToken, checkPermission('price', 'update'), (req, res) => {
    const { productId } = req.params;
    const {
        cost_qty,
        cost_unit_price,
        cost_total,
        supply_price,
        sale_price,
        deposit,
        unit_price, // 기존 unit_price도 지원
        change_reason
    } = req.body;

    // 현재 제품 정보 조회
    db.get('SELECT * FROM products WHERE id = ?', [productId], (err, currentProduct) => {
        if (err) {
            console.error('Get current product error:', err);
            return res.status(500).json({ success: false, message: '제품 조회 중 오류가 발생했습니다' });
        }

        if (!currentProduct) {
            return res.status(404).json({ success: false, message: '제품을 찾을 수 없습니다' });
        }

        // 변경할 필드들 정의
        const priceFields = {
            cost_qty: cost_qty,
            cost_unit_price: cost_unit_price,
            cost_total: cost_total,
            supply_price: supply_price,
            sale_price: sale_price,
            deposit: deposit,
            unit_price: unit_price
        };

        // 실제 변경된 필드만 필터링
        const updates = {};
        const historyRecords = [];

        for (const [field, newValue] of Object.entries(priceFields)) {
            if (newValue !== undefined && newValue !== null) {
                const currentValue = currentProduct[field];
                if (parseFloat(currentValue) !== parseFloat(newValue)) {
                    updates[field] = newValue;
                    historyRecords.push({
                        field,
                        oldValue: currentValue,
                        newValue: newValue
                    });
                }
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.json({ success: true, message: '변경된 가격이 없습니다' });
        }

        // cost_total 자동 계산
        if (updates.cost_qty || updates.cost_unit_price) {
            const newCostQty = updates.cost_qty || currentProduct.cost_qty || 1;
            const newCostUnitPrice = updates.cost_unit_price || currentProduct.cost_unit_price || 0;
            const calculatedCostTotal = newCostQty * newCostUnitPrice;

            if (!updates.cost_total) {
                updates.cost_total = calculatedCostTotal;
                if (calculatedCostTotal !== currentProduct.cost_total) {
                    historyRecords.push({
                        field: 'cost_total',
                        oldValue: currentProduct.cost_total,
                        newValue: calculatedCostTotal
                    });
                }
            }
        }

        // 업데이트 쿼리 생성
        const setClause = Object.keys(updates).map(field => `${field} = ?`).join(', ');
        const updateValues = Object.values(updates);

        // 제품 가격 업데이트
        db.run(`
            UPDATE products SET ${setClause}, updated_at = datetime('now')
            WHERE id = ?
        `, [...updateValues, productId], function(err) {
            if (err) {
                console.error('Update product prices error:', err);
                return res.status(500).json({ success: false, message: '가격 업데이트 중 오류가 발생했습니다' });
            }

            // 가격 변동 이력 기록
            let recordsCompleted = 0;
            const totalRecords = historyRecords.length;

            if (totalRecords === 0) {
                return res.json({ success: true, message: '가격이 성공적으로 업데이트되었습니다' });
            }

            historyRecords.forEach(record => {
                recordPriceChange(
                    productId,
                    record.field,
                    record.oldValue,
                    record.newValue,
                    req.user.userId,
                    change_reason,
                    (err) => {
                        recordsCompleted++;
                        if (recordsCompleted === totalRecords) {
                            // 감사 로그
                            db.run(`
                                INSERT INTO audit_logs (user_id, action_type, table_name, record_id, before_data, after_data, ip_address, timestamp)
                                VALUES (?, 'price_update', 'products', ?, ?, ?, ?, datetime('now'))
                            `, [
                                req.user.userId,
                                productId,
                                JSON.stringify(currentProduct),
                                JSON.stringify(updates),
                                req.ip || 'unknown'
                            ]);

                            res.json({
                                success: true,
                                message: '가격이 성공적으로 업데이트되었습니다',
                                data: {
                                    updatedFields: Object.keys(updates),
                                    historyRecordsCreated: totalRecords
                                }
                            });
                        }
                    }
                );
            });
        });
    });
});

// 특정 기간의 가격 변동 통계
router.get('/stats', authenticateToken, checkPermission('product', 'read'), (req, res) => {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    let dateFormat, groupByClause;
    switch (groupBy) {
        case 'month':
            dateFormat = '%Y-%m';
            groupByClause = "strftime('%Y-%m', pph.changed_at)";
            break;
        case 'week':
            dateFormat = '%Y-W%W';
            groupByClause = "strftime('%Y-W%W', pph.changed_at)";
            break;
        default:
            dateFormat = '%Y-%m-%d';
            groupByClause = "strftime('%Y-%m-%d', pph.changed_at)";
    }

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (startDate) {
        whereClause += ' AND pph.changed_at >= ?';
        params.push(startDate);
    }

    if (endDate) {
        whereClause += ' AND pph.changed_at <= ?';
        params.push(endDate + ' 23:59:59');
    }

    db.all(`
        SELECT
            ${groupByClause} as period,
            pph.field_name,
            COUNT(*) as change_count,
            COUNT(DISTINCT pph.product_id) as affected_products,
            COUNT(DISTINCT pph.changed_by) as users_involved,
            AVG(CASE WHEN pph.old_value > 0 THEN
                ((pph.new_value - pph.old_value) / pph.old_value * 100)
                ELSE NULL END) as avg_change_percentage
        FROM product_price_history pph
        ${whereClause}
        GROUP BY ${groupByClause}, pph.field_name
        ORDER BY period DESC, pph.field_name
    `, params, (err, stats) => {
        if (err) {
            console.error('Get price history stats error:', err);
            return res.status(500).json({ success: false, message: '가격 변동 통계 조회 중 오류가 발생했습니다' });
        }

        // 전체 요약
        db.get(`
            SELECT
                COUNT(*) as total_changes,
                COUNT(DISTINCT pph.product_id) as total_products_affected,
                COUNT(DISTINCT pph.changed_by) as total_users_involved,
                COUNT(DISTINCT pph.field_name) as fields_changed
            FROM product_price_history pph
            ${whereClause}
        `, params, (err, summary) => {
            if (err) {
                console.error('Get price history summary error:', err);
                summary = {};
            }

            res.json({
                success: true,
                data: {
                    stats,
                    summary,
                    period: { startDate, endDate, groupBy }
                }
            });
        });
    });
});

// 특정 제품의 현재 가격과 이력 비교
router.get('/product/:productId/comparison', authenticateToken, checkPermission('product', 'read'), (req, res) => {
    const { productId } = req.params;
    const { compareDate } = req.query;

    // 현재 제품 정보 조회
    db.get(`
        SELECT p.*, c.name as category_name, s.name as supplier_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE p.id = ?
    `, [productId], (err, currentProduct) => {
        if (err) {
            console.error('Get product for comparison error:', err);
            return res.status(500).json({ success: false, message: '제품 조회 중 오류가 발생했습니다' });
        }

        if (!currentProduct) {
            return res.status(404).json({ success: false, message: '제품을 찾을 수 없습니다' });
        }

        if (!compareDate) {
            return res.json({
                success: true,
                data: {
                    current: currentProduct,
                    historical: null,
                    comparison: null
                }
            });
        }

        // 지정된 날짜 이전의 마지막 가격 이력 조회
        db.all(`
            SELECT field_name, new_value, changed_at
            FROM product_price_history
            WHERE product_id = ? AND changed_at <= ?
            ORDER BY changed_at DESC
        `, [productId, compareDate + ' 23:59:59'], (err, historyRecords) => {
            if (err) {
                console.error('Get historical prices error:', err);
                return res.status(500).json({ success: false, message: '이력 조회 중 오류가 발생했습니다' });
            }

            // 각 필드의 마지막 값 추출
            const historicalPrices = {};
            const fieldsSeen = new Set();

            for (const record of historyRecords) {
                if (!fieldsSeen.has(record.field_name)) {
                    historicalPrices[record.field_name] = record.new_value;
                    fieldsSeen.add(record.field_name);
                }
            }

            // 가격 필드들 비교
            const priceFields = ['cost_qty', 'cost_unit_price', 'cost_total', 'supply_price', 'sale_price', 'deposit', 'unit_price'];
            const comparison = {};

            priceFields.forEach(field => {
                const currentValue = parseFloat(currentProduct[field]) || 0;
                const historicalValue = parseFloat(historicalPrices[field]) || currentValue;
                const change = currentValue - historicalValue;
                const changePercentage = historicalValue > 0 ? (change / historicalValue) * 100 : 0;

                comparison[field] = {
                    current: currentValue,
                    historical: historicalValue,
                    change: Math.round(change * 100) / 100,
                    changePercentage: Math.round(changePercentage * 100) / 100
                };
            });

            res.json({
                success: true,
                data: {
                    current: currentProduct,
                    historical: historicalPrices,
                    comparison,
                    compareDate
                }
            });
        });
    });
});

// 가격 변동 이력 내보내기
router.get('/export', authenticateToken, checkPermission('product', 'read'), (req, res) => {
    const { startDate, endDate, productId, format = 'csv' } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (startDate) {
        whereClause += ' AND pph.changed_at >= ?';
        params.push(startDate);
    }

    if (endDate) {
        whereClause += ' AND pph.changed_at <= ?';
        params.push(endDate + ' 23:59:59');
    }

    if (productId) {
        whereClause += ' AND pph.product_id = ?';
        params.push(productId);
    }

    db.all(`
        SELECT
            p.product_code,
            p.name as product_name,
            c.name as category_name,
            pph.field_name,
            pph.old_value,
            pph.new_value,
            pph.change_reason,
            u.full_name as changed_by,
            pph.changed_at
        FROM product_price_history pph
        LEFT JOIN products p ON pph.product_id = p.id
        LEFT JOIN users u ON pph.changed_by = u.id
        LEFT JOIN categories c ON p.category_id = c.id
        ${whereClause}
        ORDER BY pph.changed_at DESC
    `, params, (err, records) => {
        if (err) {
            console.error('Export price history error:', err);
            return res.status(500).json({ success: false, message: '가격 이력 내보내기 중 오류가 발생했습니다' });
        }

        if (format === 'csv') {
            const csvHeader = 'Product Code,Product Name,Category,Field,Old Value,New Value,Change Reason,Changed By,Changed At\n';
            const csvData = records.map(record => [
                record.product_code,
                record.product_name,
                record.category_name,
                record.field_name,
                record.old_value,
                record.new_value,
                record.change_reason || '',
                record.changed_by,
                record.changed_at
            ].map(field => `"${field || ''}"`).join(',')).join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=price_history_${new Date().toISOString().split('T')[0]}.csv`);
            res.send(csvHeader + csvData);
        } else {
            res.json({ success: true, data: records });
        }
    });
});

module.exports = { router, recordPriceChange };