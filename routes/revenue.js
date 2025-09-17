const express = require('express');
const { db } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('./auth');

const router = express.Router();

// 수익 계산 엔진 클래스
class RevenueCalculator {
    static calculateRevenue(product, quantity, siteOverrides = {}) {
        const {
            cost_qty = 1,
            cost_unit_price = 0,
            supply_price = 0,
            sale_price = 0,
            deposit = 0,
            one_time_fee = false
        } = product;

        // 오버라이드 가격 적용
        const effectiveSalePrice = siteOverrides.sale_price_override || sale_price;
        const effectiveSupplyPrice = siteOverrides.supply_price_override || supply_price;

        // 기본 계산
        const revenue = effectiveSalePrice * quantity;
        const directCost = (cost_unit_price * cost_qty) * (quantity / cost_qty);
        const depositAmount = one_time_fee ? deposit : (deposit * quantity);

        // 총 이익 계산
        const grossProfit = revenue - directCost - depositAmount;

        return {
            quantity,
            unitSalePrice: effectiveSalePrice,
            unitSupplyPrice: effectiveSupplyPrice,
            unitCost: cost_unit_price * cost_qty,
            totalRevenue: revenue,
            totalCost: directCost,
            depositAmount,
            grossProfit,
            profitMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0
        };
    }

    static calculateDistribution(grossProfit, distributionRule) {
        const distribution = {};
        let distributedAmount = 0;

        try {
            const rules = typeof distributionRule === 'string'
                ? JSON.parse(distributionRule)
                : distributionRule;

            for (const [role, percentage] of Object.entries(rules)) {
                const amount = grossProfit * percentage;
                distribution[role] = {
                    percentage: percentage * 100,
                    amount: Math.round(amount * 100) / 100
                };
                distributedAmount += amount;
            }

            // 남은 금액 처리 (반올림 오차)
            const remaining = grossProfit - distributedAmount;
            if (Math.abs(remaining) > 0.01) {
                distribution.adjustment = {
                    percentage: 0,
                    amount: Math.round(remaining * 100) / 100
                };
            }

        } catch (error) {
            console.error('Distribution calculation error:', error);
            distribution.error = '배분 규칙 처리 중 오류가 발생했습니다';
        }

        return distribution;
    }

    static async getDistributionRule(productId = null, siteType = null) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT * FROM distribution_rules
                WHERE is_active = 1
                AND (applies_to IS NULL OR applies_to >= date('now'))
                AND (product_id IS NULL OR product_id = ?)
                AND (site_type IS NULL OR site_type = ?)
                ORDER BY
                    CASE WHEN product_id IS NOT NULL THEN 1 ELSE 2 END,
                    CASE WHEN site_type IS NOT NULL THEN 1 ELSE 2 END,
                    created_at DESC
                LIMIT 1
            `;

            db.get(query, [productId, siteType], (err, rule) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rule);
                }
            });
        });
    }
}

// 수익 시뮬레이션
router.post('/simulate', authenticateToken, checkPermission('report', 'profit'), (req, res) => {
    const { productId, quantity, siteId, overrides = {} } = req.body;

    if (!productId || !quantity) {
        return res.status(400).json({
            success: false,
            message: '제품 ID와 수량은 필수 입력 항목입니다'
        });
    }

    // 제품 정보 조회
    db.get(`
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ? AND p.is_active = 1
    `, [productId], async (err, product) => {
        if (err) {
            console.error('Get product for simulation error:', err);
            return res.status(500).json({ success: false, message: '제품 조회 중 오류가 발생했습니다' });
        }

        if (!product) {
            return res.status(404).json({ success: false, message: '제품을 찾을 수 없습니다' });
        }

        try {
            // 사이트 정보 조회 (있는 경우)
            let siteInfo = null;
            let siteOverrides = {};

            if (siteId) {
                siteInfo = await new Promise((resolve, reject) => {
                    db.get(`
                        SELECT s.*, sp.sale_price_override, sp.supply_price_override
                        FROM sites s
                        LEFT JOIN site_products sp ON s.id = sp.site_id AND sp.product_id = ? AND sp.is_active = 1
                        WHERE s.id = ?
                    `, [productId, siteId], (err, site) => {
                        if (err) reject(err);
                        else resolve(site);
                    });
                });

                if (siteInfo) {
                    siteOverrides = {
                        sale_price_override: siteInfo.sale_price_override,
                        supply_price_override: siteInfo.supply_price_override
                    };
                }
            }

            // 오버라이드 적용
            Object.assign(siteOverrides, overrides);

            // 수익 계산
            const revenueCalc = RevenueCalculator.calculateRevenue(product, quantity, siteOverrides);

            // 배분 규칙 조회
            const distributionRule = await RevenueCalculator.getDistributionRule(
                productId,
                siteInfo?.type
            );

            let distribution = {};
            if (distributionRule) {
                distribution = RevenueCalculator.calculateDistribution(
                    revenueCalc.grossProfit,
                    distributionRule.distribution_json
                );
            }

            res.json({
                success: true,
                data: {
                    product: {
                        id: product.id,
                        name: product.name,
                        product_code: product.product_code,
                        category_name: product.category_name
                    },
                    site: siteInfo ? {
                        id: siteInfo.id,
                        name: siteInfo.name,
                        type: siteInfo.type
                    } : null,
                    calculation: revenueCalc,
                    distribution: {
                        rule: distributionRule ? {
                            id: distributionRule.id,
                            name: distributionRule.rule_name
                        } : null,
                        breakdown: distribution
                    },
                    timestamp: new Date().toISOString()
                }
            });

        } catch (error) {
            console.error('Revenue simulation error:', error);
            res.status(500).json({ success: false, message: '수익 시뮬레이션 중 오류가 발생했습니다' });
        }
    });
});

// 수익 거래 기록 생성
router.post('/transactions', authenticateToken, checkPermission('report', 'profit'), (req, res) => {
    const {
        transactionType = 'sale',
        siteId,
        productId,
        quantity,
        unitSalePrice,
        unitSupplyPrice,
        unitCost,
        distributionRuleId,
        notes
    } = req.body;

    if (!productId || !quantity || !unitSalePrice) {
        return res.status(400).json({
            success: false,
            message: '제품 ID, 수량, 판매 단가는 필수 입력 항목입니다'
        });
    }

    const totalRevenue = unitSalePrice * quantity;
    const totalCost = unitCost * quantity;
    const grossProfit = totalRevenue - totalCost;

    // 배분 세부사항 계산
    let distributionDetails = null;
    if (distributionRuleId) {
        db.get('SELECT distribution_json FROM distribution_rules WHERE id = ?', [distributionRuleId], (err, rule) => {
            if (!err && rule) {
                distributionDetails = RevenueCalculator.calculateDistribution(grossProfit, rule.distribution_json);
            }

            createTransaction();
        });
    } else {
        createTransaction();
    }

    function createTransaction() {
        db.run(`
            INSERT INTO revenue_transactions (
                transaction_type, site_id, product_id, quantity,
                unit_sale_price, unit_supply_price, unit_cost,
                total_revenue, total_cost, gross_profit,
                distribution_rule_id, distribution_details,
                transaction_date, created_by, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)
        `, [
            transactionType, siteId, productId, quantity,
            unitSalePrice, unitSupplyPrice, unitCost,
            totalRevenue, totalCost, grossProfit,
            distributionRuleId, distributionDetails ? JSON.stringify(distributionDetails) : null,
            req.user.userId, notes
        ], function(err) {
            if (err) {
                console.error('Create revenue transaction error:', err);
                return res.status(500).json({ success: false, message: '수익 거래 생성 중 오류가 발생했습니다' });
            }

            // 감사 로그
            db.run(`
                INSERT INTO audit_logs (user_id, action_type, table_name, record_id, after_data, ip_address, timestamp)
                VALUES (?, 'create', 'revenue_transactions', ?, ?, ?, datetime('now'))
            `, [req.user.userId, this.lastID, JSON.stringify({ productId, quantity, totalRevenue, grossProfit }), req.ip || 'unknown']);

            res.status(201).json({
                success: true,
                message: '수익 거래가 성공적으로 기록되었습니다',
                data: {
                    transactionId: this.lastID,
                    totalRevenue,
                    grossProfit,
                    distributionDetails
                }
            });
        });
    }
});

// 수익 거래 목록 조회
router.get('/transactions', authenticateToken, checkPermission('report', 'profit'), (req, res) => {
    const {
        page = 1,
        limit = 20,
        startDate,
        endDate,
        productId,
        siteId,
        transactionType
    } = req.query;

    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (startDate) {
        whereClause += ' AND rt.transaction_date >= ?';
        params.push(startDate);
    }

    if (endDate) {
        whereClause += ' AND rt.transaction_date <= ?';
        params.push(endDate + ' 23:59:59');
    }

    if (productId) {
        whereClause += ' AND rt.product_id = ?';
        params.push(productId);
    }

    if (siteId) {
        whereClause += ' AND rt.site_id = ?';
        params.push(siteId);
    }

    if (transactionType) {
        whereClause += ' AND rt.transaction_type = ?';
        params.push(transactionType);
    }

    // 총 개수 조회
    db.get(`SELECT COUNT(*) as total FROM revenue_transactions rt ${whereClause}`, params, (err, countResult) => {
        if (err) {
            console.error('Get revenue transactions count error:', err);
            return res.status(500).json({ success: false, message: '수익 거래 개수 조회 중 오류가 발생했습니다' });
        }

        // 거래 목록 조회
        db.all(`
            SELECT rt.*,
                   p.name as product_name, p.product_code,
                   s.name as site_name, s.type as site_type,
                   u.full_name as created_by_name,
                   dr.rule_name as distribution_rule_name
            FROM revenue_transactions rt
            LEFT JOIN products p ON rt.product_id = p.id
            LEFT JOIN sites s ON rt.site_id = s.id
            LEFT JOIN users u ON rt.created_by = u.id
            LEFT JOIN distribution_rules dr ON rt.distribution_rule_id = dr.id
            ${whereClause}
            ORDER BY rt.transaction_date DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset], (err, transactions) => {
            if (err) {
                console.error('Get revenue transactions error:', err);
                return res.status(500).json({ success: false, message: '수익 거래 목록 조회 중 오류가 발생했습니다' });
            }

            // 배분 세부사항 파싱
            const transactionsWithParsedDetails = transactions.map(t => ({
                ...t,
                distribution_details: t.distribution_details ? JSON.parse(t.distribution_details) : null
            }));

            res.json({
                success: true,
                data: {
                    transactions: transactionsWithParsedDetails,
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

// 수익 요약 보고서
router.get('/summary', authenticateToken, checkPermission('report', 'profit'), (req, res) => {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    let dateFormat, groupByClause;
    switch (groupBy) {
        case 'month':
            dateFormat = '%Y-%m';
            groupByClause = "strftime('%Y-%m', rt.transaction_date)";
            break;
        case 'week':
            dateFormat = '%Y-W%W';
            groupByClause = "strftime('%Y-W%W', rt.transaction_date)";
            break;
        default:
            dateFormat = '%Y-%m-%d';
            groupByClause = "strftime('%Y-%m-%d', rt.transaction_date)";
    }

    let whereClause = 'WHERE rt.transaction_type = "sale"';
    const params = [];

    if (startDate) {
        whereClause += ' AND rt.transaction_date >= ?';
        params.push(startDate);
    }

    if (endDate) {
        whereClause += ' AND rt.transaction_date <= ?';
        params.push(endDate + ' 23:59:59');
    }

    db.all(`
        SELECT
            ${groupByClause} as period,
            COUNT(*) as transaction_count,
            SUM(rt.quantity) as total_quantity,
            SUM(rt.total_revenue) as total_revenue,
            SUM(rt.total_cost) as total_cost,
            SUM(rt.gross_profit) as total_profit,
            AVG(rt.gross_profit / rt.total_revenue * 100) as avg_profit_margin
        FROM revenue_transactions rt
        ${whereClause}
        GROUP BY ${groupByClause}
        ORDER BY period DESC
    `, params, (err, summary) => {
        if (err) {
            console.error('Get revenue summary error:', err);
            return res.status(500).json({ success: false, message: '수익 요약 조회 중 오류가 발생했습니다' });
        }

        // 전체 총계
        db.get(`
            SELECT
                COUNT(*) as total_transactions,
                SUM(rt.quantity) as total_quantity,
                SUM(rt.total_revenue) as total_revenue,
                SUM(rt.total_cost) as total_cost,
                SUM(rt.gross_profit) as total_profit
            FROM revenue_transactions rt
            ${whereClause}
        `, params, (err, totals) => {
            if (err) {
                console.error('Get revenue totals error:', err);
                totals = {};
            }

            res.json({
                success: true,
                data: {
                    summary,
                    totals,
                    period: { startDate, endDate, groupBy }
                }
            });
        });
    });
});

module.exports = router;