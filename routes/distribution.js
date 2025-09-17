const express = require('express');
const { db } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('./auth');

const router = express.Router();

// 배분 규칙 목록 조회
router.get('/rules', authenticateToken, checkPermission('settings', 'distribution'), (req, res) => {
    const {
        page = 1,
        limit = 10,
        search = '',
        isActive = true
    } = req.query;

    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
        whereClause += ' AND (dr.rule_name LIKE ? OR p.name LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }

    if (isActive !== undefined) {
        whereClause += ' AND dr.is_active = ?';
        params.push(isActive === 'true' ? 1 : 0);
    }

    // 총 개수 조회
    db.get(`
        SELECT COUNT(*) as total
        FROM distribution_rules dr
        LEFT JOIN products p ON dr.product_id = p.id
        ${whereClause}
    `, params, (err, countResult) => {
        if (err) {
            console.error('Get distribution rules count error:', err);
            return res.status(500).json({ success: false, message: '배분 규칙 개수 조회 중 오류가 발생했습니다' });
        }

        // 배분 규칙 목록 조회
        db.all(`
            SELECT dr.*,
                   p.name as product_name, p.product_code,
                   u.full_name as created_by_name
            FROM distribution_rules dr
            LEFT JOIN products p ON dr.product_id = p.id
            LEFT JOIN users u ON dr.created_by = u.id
            ${whereClause}
            ORDER BY dr.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset], (err, rules) => {
            if (err) {
                console.error('Get distribution rules error:', err);
                return res.status(500).json({ success: false, message: '배분 규칙 목록 조회 중 오류가 발생했습니다' });
            }

            // JSON 파싱
            const rulesWithParsedJson = rules.map(rule => ({
                ...rule,
                distribution_breakdown: rule.distribution_json ? JSON.parse(rule.distribution_json) : {}
            }));

            res.json({
                success: true,
                data: {
                    rules: rulesWithParsedJson,
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

// 배분 규칙 상세 조회
router.get('/rules/:id', authenticateToken, checkPermission('settings', 'distribution'), (req, res) => {
    const { id } = req.params;

    db.get(`
        SELECT dr.*,
               p.name as product_name, p.product_code,
               u.full_name as created_by_name
        FROM distribution_rules dr
        LEFT JOIN products p ON dr.product_id = p.id
        LEFT JOIN users u ON dr.created_by = u.id
        WHERE dr.id = ?
    `, [id], (err, rule) => {
        if (err) {
            console.error('Get distribution rule error:', err);
            return res.status(500).json({ success: false, message: '배분 규칙 조회 중 오류가 발생했습니다' });
        }

        if (!rule) {
            return res.status(404).json({ success: false, message: '배분 규칙을 찾을 수 없습니다' });
        }

        // JSON 파싱
        rule.distribution_breakdown = rule.distribution_json ? JSON.parse(rule.distribution_json) : {};

        res.json({ success: true, data: rule });
    });
});

// 배분 규칙 생성
router.post('/rules', authenticateToken, checkPermission('settings', 'distribution'), (req, res) => {
    const {
        ruleName,
        productId,
        siteType,
        regionType = 'nationwide',
        distributionBreakdown,
        appliesFrom,
        appliesTo,
        isActive = true
    } = req.body;

    if (!ruleName || !distributionBreakdown || !appliesFrom) {
        return res.status(400).json({
            success: false,
            message: '규칙명, 배분 내역, 적용 시작일은 필수 입력 항목입니다'
        });
    }

    // 배분 비율 검증
    const totalPercentage = Object.values(distributionBreakdown).reduce((sum, value) => sum + value, 0);
    if (Math.abs(totalPercentage - 1.0) > 0.001) {
        return res.status(400).json({
            success: false,
            message: `배분 비율의 합계가 100%가 아닙니다 (현재: ${(totalPercentage * 100).toFixed(1)}%)`
        });
    }

    // 중복 규칙 검사 (같은 제품, 사이트 타입, 기간)
    db.get(`
        SELECT id FROM distribution_rules
        WHERE product_id = ? AND site_type = ? AND region_type = ?
        AND is_active = 1
        AND (
            (applies_to IS NULL) OR
            (? >= applies_from AND ? <= COALESCE(applies_to, '9999-12-31')) OR
            (COALESCE(?, '9999-12-31') >= applies_from AND COALESCE(?, '9999-12-31') <= COALESCE(applies_to, '9999-12-31'))
        )
    `, [productId, siteType, regionType, appliesFrom, appliesFrom, appliesTo, appliesTo], (err, existingRule) => {
        if (err) {
            console.error('Check duplicate distribution rule error:', err);
            return res.status(500).json({ success: false, message: '배분 규칙 생성 중 오류가 발생했습니다' });
        }

        if (existingRule) {
            return res.status(409).json({ success: false, message: '같은 조건의 배분 규칙이 이미 존재합니다' });
        }

        // 배분 규칙 생성
        db.run(`
            INSERT INTO distribution_rules (
                rule_name, product_id, site_type, region_type, distribution_json,
                applies_from, applies_to, is_active, created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `, [
            ruleName, productId, siteType, regionType, JSON.stringify(distributionBreakdown),
            appliesFrom, appliesTo, isActive ? 1 : 0, req.user.userId
        ], function(err) {
            if (err) {
                console.error('Create distribution rule error:', err);
                return res.status(500).json({ success: false, message: '배분 규칙 생성 중 오류가 발생했습니다' });
            }

            // 감사 로그
            db.run(`
                INSERT INTO audit_logs (user_id, action_type, table_name, record_id, after_data, ip_address, timestamp)
                VALUES (?, 'create', 'distribution_rules', ?, ?, ?, datetime('now'))
            `, [req.user.userId, this.lastID, JSON.stringify({ ruleName, distributionBreakdown }), req.ip || 'unknown']);

            res.status(201).json({
                success: true,
                message: '배분 규칙이 성공적으로 생성되었습니다',
                data: { ruleId: this.lastID }
            });
        });
    });
});

// 배분 규칙 수정
router.put('/rules/:id', authenticateToken, checkPermission('settings', 'distribution'), (req, res) => {
    const { id } = req.params;
    const {
        ruleName,
        productId,
        siteType,
        regionType,
        distributionBreakdown,
        appliesFrom,
        appliesTo,
        isActive
    } = req.body;

    // 기존 규칙 조회
    db.get('SELECT * FROM distribution_rules WHERE id = ?', [id], (err, existingRule) => {
        if (err) {
            console.error('Get existing distribution rule error:', err);
            return res.status(500).json({ success: false, message: '배분 규칙 수정 중 오류가 발생했습니다' });
        }

        if (!existingRule) {
            return res.status(404).json({ success: false, message: '배분 규칙을 찾을 수 없습니다' });
        }

        // 배분 비율 검증
        if (distributionBreakdown) {
            const totalPercentage = Object.values(distributionBreakdown).reduce((sum, value) => sum + value, 0);
            if (Math.abs(totalPercentage - 1.0) > 0.001) {
                return res.status(400).json({
                    success: false,
                    message: `배분 비율의 합계가 100%가 아닙니다 (현재: ${(totalPercentage * 100).toFixed(1)}%)`
                });
            }
        }

        // 배분 규칙 수정
        db.run(`
            UPDATE distribution_rules SET
                rule_name = ?, product_id = ?, site_type = ?, region_type = ?,
                distribution_json = ?, applies_from = ?, applies_to = ?,
                is_active = ?, updated_at = datetime('now')
            WHERE id = ?
        `, [
            ruleName || existingRule.rule_name,
            productId !== undefined ? productId : existingRule.product_id,
            siteType !== undefined ? siteType : existingRule.site_type,
            regionType || existingRule.region_type,
            distributionBreakdown ? JSON.stringify(distributionBreakdown) : existingRule.distribution_json,
            appliesFrom || existingRule.applies_from,
            appliesTo !== undefined ? appliesTo : existingRule.applies_to,
            isActive !== undefined ? (isActive ? 1 : 0) : existingRule.is_active,
            id
        ], function(err) {
            if (err) {
                console.error('Update distribution rule error:', err);
                return res.status(500).json({ success: false, message: '배분 규칙 수정 중 오류가 발생했습니다' });
            }

            // 감사 로그
            db.run(`
                INSERT INTO audit_logs (user_id, action_type, table_name, record_id, before_data, after_data, ip_address, timestamp)
                VALUES (?, 'update', 'distribution_rules', ?, ?, ?, ?, datetime('now'))
            `, [req.user.userId, id, JSON.stringify(existingRule), JSON.stringify(req.body), req.ip || 'unknown']);

            res.json({ success: true, message: '배분 규칙이 성공적으로 수정되었습니다' });
        });
    });
});

// 배분 규칙 삭제 (소프트 삭제)
router.delete('/rules/:id', authenticateToken, checkPermission('settings', 'distribution'), (req, res) => {
    const { id } = req.params;

    db.get('SELECT * FROM distribution_rules WHERE id = ?', [id], (err, rule) => {
        if (err) {
            console.error('Get distribution rule for delete error:', err);
            return res.status(500).json({ success: false, message: '배분 규칙 삭제 중 오류가 발생했습니다' });
        }

        if (!rule) {
            return res.status(404).json({ success: false, message: '배분 규칙을 찾을 수 없습니다' });
        }

        db.run(`
            UPDATE distribution_rules SET is_active = 0, updated_at = datetime('now') WHERE id = ?
        `, [id], function(err) {
            if (err) {
                console.error('Delete distribution rule error:', err);
                return res.status(500).json({ success: false, message: '배분 규칙 삭제 중 오류가 발생했습니다' });
            }

            // 감사 로그
            db.run(`
                INSERT INTO audit_logs (user_id, action_type, table_name, record_id, before_data, ip_address, timestamp)
                VALUES (?, 'delete', 'distribution_rules', ?, ?, ?, datetime('now'))
            `, [req.user.userId, id, JSON.stringify(rule), req.ip || 'unknown']);

            res.json({ success: true, message: '배분 규칙이 성공적으로 삭제되었습니다' });
        });
    });
});

// 배분 시뮬레이션
router.post('/simulate', authenticateToken, checkPermission('settings', 'distribution'), (req, res) => {
    const {
        productId,
        siteType,
        grossProfit,
        distributionBreakdown
    } = req.body;

    if (!grossProfit || !distributionBreakdown) {
        return res.status(400).json({
            success: false,
            message: '총 이익과 배분 내역은 필수 입력 항목입니다'
        });
    }

    // 배분 비율 검증
    const totalPercentage = Object.values(distributionBreakdown).reduce((sum, value) => sum + value, 0);
    if (Math.abs(totalPercentage - 1.0) > 0.001) {
        return res.status(400).json({
            success: false,
            message: `배분 비율의 합계가 100%가 아닙니다 (현재: ${(totalPercentage * 100).toFixed(1)}%)`
        });
    }

    // 배분 계산
    const distribution = {};
    let distributedAmount = 0;

    for (const [role, percentage] of Object.entries(distributionBreakdown)) {
        const amount = grossProfit * percentage;
        distribution[role] = {
            percentage: percentage * 100,
            amount: Math.round(amount * 100) / 100
        };
        distributedAmount += amount;
    }

    // 반올림 오차 처리
    const remaining = grossProfit - distributedAmount;
    if (Math.abs(remaining) > 0.01) {
        distribution.adjustment = {
            percentage: 0,
            amount: Math.round(remaining * 100) / 100
        };
    }

    // 제품 정보 조회 (있는 경우)
    if (productId) {
        db.get('SELECT name, product_code FROM products WHERE id = ?', [productId], (err, product) => {
            const result = {
                success: true,
                data: {
                    simulation: {
                        grossProfit,
                        distributionBreakdown,
                        distribution,
                        totalDistributed: distributedAmount,
                        remaining: Math.round(remaining * 100) / 100
                    },
                    product: product || null,
                    siteType,
                    timestamp: new Date().toISOString()
                }
            };

            res.json(result);
        });
    } else {
        res.json({
            success: true,
            data: {
                simulation: {
                    grossProfit,
                    distributionBreakdown,
                    distribution,
                    totalDistributed: distributedAmount,
                    remaining: Math.round(remaining * 100) / 100
                },
                siteType,
                timestamp: new Date().toISOString()
            }
        });
    }
});

// 배분 규칙 템플릿 조회
router.get('/templates', authenticateToken, checkPermission('settings', 'distribution'), (req, res) => {
    const templates = [
        {
            name: '기본 배분 규칙',
            description: '전사 표준 배분 비율',
            breakdown: {
                factory: 0.32,
                hq: 0.03,
                regional: 0.25,
                branch: 0.02,
                nationwide: 0.02,
                local: 0.03,
                area: 0.05,
                hospital: 0.30
            }
        },
        {
            name: '요양원 특화 배분',
            description: '요양원 고객사 특화 배분 규칙',
            breakdown: {
                factory: 0.30,
                hq: 0.05,
                regional: 0.20,
                branch: 0.03,
                local: 0.07,
                hospital: 0.35
            }
        },
        {
            name: '경로당 특화 배분',
            description: '경로당 고객사 특화 배분 규칙',
            breakdown: {
                factory: 0.35,
                hq: 0.05,
                regional: 0.20,
                branch: 0.05,
                local: 0.10,
                hospital: 0.25
            }
        },
        {
            name: '프리미엄 제품 배분',
            description: '고급 제품라인 배분 규칙',
            breakdown: {
                factory: 0.25,
                hq: 0.10,
                regional: 0.25,
                branch: 0.05,
                nationwide: 0.05,
                local: 0.05,
                hospital: 0.25
            }
        }
    ];

    res.json({ success: true, data: templates });
});

// 활성 배분 규칙 조회 (특정 조건)
router.get('/active', authenticateToken, checkPermission('settings', 'distribution'), (req, res) => {
    const { productId, siteType, date = new Date().toISOString().split('T')[0] } = req.query;

    db.get(`
        SELECT dr.*, p.name as product_name, p.product_code
        FROM distribution_rules dr
        LEFT JOIN products p ON dr.product_id = p.id
        WHERE dr.is_active = 1
        AND (dr.applies_to IS NULL OR dr.applies_to >= ?)
        AND dr.applies_from <= ?
        AND (dr.product_id IS NULL OR dr.product_id = ?)
        AND (dr.site_type IS NULL OR dr.site_type = ?)
        ORDER BY
            CASE WHEN dr.product_id IS NOT NULL THEN 1 ELSE 2 END,
            CASE WHEN dr.site_type IS NOT NULL THEN 1 ELSE 2 END,
            dr.created_at DESC
        LIMIT 1
    `, [date, date, productId || null, siteType || null], (err, rule) => {
        if (err) {
            console.error('Get active distribution rule error:', err);
            return res.status(500).json({ success: false, message: '활성 배분 규칙 조회 중 오류가 발생했습니다' });
        }

        if (rule) {
            rule.distribution_breakdown = rule.distribution_json ? JSON.parse(rule.distribution_json) : {};
        }

        res.json({ success: true, data: rule });
    });
});

module.exports = router;