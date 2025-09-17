const express = require('express');
const { db } = require('../database/init');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission } = require('./auth');

const router = express.Router();

// 사이트 목록 조회
router.get('/', authenticateToken, checkPermission('site', 'read'), (req, res) => {
    const {
        page = 1,
        limit = 10,
        search = '',
        type = '',
        status = 'active'
    } = req.query;

    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (search) {
        whereClause += ' AND (name LIKE ? OR site_code LIKE ? OR contact_person LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (type) {
        whereClause += ' AND type = ?';
        params.push(type);
    }

    if (status) {
        whereClause += ' AND status = ?';
        params.push(status);
    }

    // 총 개수 조회
    db.get(`SELECT COUNT(*) as total FROM sites ${whereClause}`, params, (err, countResult) => {
        if (err) {
            console.error('Get sites count error:', err);
            return res.status(500).json({ success: false, message: '사이트 개수 조회 중 오류가 발생했습니다' });
        }

        // 사이트 목록 조회
        db.all(`
            SELECT s.*,
                   COUNT(sp.id) as assigned_products_count,
                   COALESCE(SUM(sp.quantity_default), 0) as total_quantity
            FROM sites s
            LEFT JOIN site_products sp ON s.id = sp.site_id AND sp.is_active = 1
            ${whereClause}
            GROUP BY s.id
            ORDER BY s.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset], (err, sites) => {
            if (err) {
                console.error('Get sites error:', err);
                return res.status(500).json({ success: false, message: '사이트 목록 조회 중 오류가 발생했습니다' });
            }

            res.json({
                success: true,
                data: {
                    sites,
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

// 사이트 상세 조회
router.get('/:id', authenticateToken, checkPermission('site', 'read'), (req, res) => {
    const { id } = req.params;

    db.get(`
        SELECT * FROM sites WHERE id = ?
    `, [id], (err, site) => {
        if (err) {
            console.error('Get site error:', err);
            return res.status(500).json({ success: false, message: '사이트 조회 중 오류가 발생했습니다' });
        }

        if (!site) {
            return res.status(404).json({ success: false, message: '사이트를 찾을 수 없습니다' });
        }

        // 할당된 제품 목록 조회
        db.all(`
            SELECT sp.*, p.name as product_name, p.product_code, p.unit, p.unit_price,
                   p.category_id, c.name as category_name
            FROM site_products sp
            JOIN products p ON sp.product_id = p.id
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE sp.site_id = ? AND sp.is_active = 1
            ORDER BY p.name
        `, [id], (err, assignedProducts) => {
            if (err) {
                console.error('Get site products error:', err);
                assignedProducts = [];
            }

            res.json({
                success: true,
                data: {
                    site,
                    assignedProducts
                }
            });
        });
    });
});

// 사이트 생성
router.post('/', authenticateToken, checkPermission('site', 'create'), (req, res) => {
    const {
        site_code,
        name,
        type,
        address,
        contact_person,
        contact_phone,
        contact_email,
        population,
        rooms,
        beds,
        contract_start_date,
        contract_end_date,
        notes
    } = req.body;

    if (!site_code || !name || !type) {
        return res.status(400).json({
            success: false,
            message: '사이트 코드, 이름, 타입은 필수 입력 항목입니다'
        });
    }

    // 중복 검사
    db.get('SELECT id FROM sites WHERE site_code = ?', [site_code], (err, existingSite) => {
        if (err) {
            console.error('Check duplicate site error:', err);
            return res.status(500).json({ success: false, message: '사이트 생성 중 오류가 발생했습니다' });
        }

        if (existingSite) {
            return res.status(409).json({ success: false, message: '이미 사용 중인 사이트 코드입니다' });
        }

        // 사이트 생성
        db.run(`
            INSERT INTO sites (
                site_code, name, type, address, contact_person, contact_phone,
                contact_email, population, rooms, beds, contract_start_date,
                contract_end_date, notes, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'), datetime('now'))
        `, [
            site_code, name, type, address, contact_person, contact_phone,
            contact_email, population, rooms, beds, contract_start_date,
            contract_end_date, notes
        ], function(err) {
            if (err) {
                console.error('Create site error:', err);
                return res.status(500).json({ success: false, message: '사이트 생성 중 오류가 발생했습니다' });
            }

            // 감사 로그
            db.run(`
                INSERT INTO audit_logs (user_id, action_type, table_name, record_id, after_data, ip_address, timestamp)
                VALUES (?, 'create', 'sites', ?, ?, ?, datetime('now'))
            `, [req.user.userId, this.lastID, JSON.stringify({ site_code, name, type }), req.ip || 'unknown']);

            res.status(201).json({
                success: true,
                message: '사이트가 성공적으로 생성되었습니다',
                data: { siteId: this.lastID }
            });
        });
    });
});

// 사이트 수정
router.put('/:id', authenticateToken, checkPermission('site', 'update'), (req, res) => {
    const { id } = req.params;
    const {
        site_code,
        name,
        type,
        address,
        contact_person,
        contact_phone,
        contact_email,
        population,
        rooms,
        beds,
        contract_start_date,
        contract_end_date,
        status,
        notes
    } = req.body;

    // 기존 데이터 조회
    db.get('SELECT * FROM sites WHERE id = ?', [id], (err, existingSite) => {
        if (err) {
            console.error('Get existing site error:', err);
            return res.status(500).json({ success: false, message: '사이트 수정 중 오류가 발생했습니다' });
        }

        if (!existingSite) {
            return res.status(404).json({ success: false, message: '사이트를 찾을 수 없습니다' });
        }

        // 사이트 코드 중복 검사 (자신 제외)
        if (site_code !== existingSite.site_code) {
            db.get('SELECT id FROM sites WHERE site_code = ? AND id != ?', [site_code, id], (err, duplicateSite) => {
                if (err) {
                    console.error('Check duplicate site code error:', err);
                    return res.status(500).json({ success: false, message: '사이트 수정 중 오류가 발생했습니다' });
                }

                if (duplicateSite) {
                    return res.status(409).json({ success: false, message: '이미 사용 중인 사이트 코드입니다' });
                }

                updateSite();
            });
        } else {
            updateSite();
        }

        function updateSite() {
            db.run(`
                UPDATE sites SET
                    site_code = ?, name = ?, type = ?, address = ?,
                    contact_person = ?, contact_phone = ?, contact_email = ?,
                    population = ?, rooms = ?, beds = ?,
                    contract_start_date = ?, contract_end_date = ?,
                    status = ?, notes = ?, updated_at = datetime('now')
                WHERE id = ?
            `, [
                site_code, name, type, address, contact_person, contact_phone,
                contact_email, population, rooms, beds, contract_start_date,
                contract_end_date, status, notes, id
            ], function(err) {
                if (err) {
                    console.error('Update site error:', err);
                    return res.status(500).json({ success: false, message: '사이트 수정 중 오류가 발생했습니다' });
                }

                // 감사 로그
                db.run(`
                    INSERT INTO audit_logs (user_id, action_type, table_name, record_id, before_data, after_data, ip_address, timestamp)
                    VALUES (?, 'update', 'sites', ?, ?, ?, ?, datetime('now'))
                `, [req.user.userId, id, JSON.stringify(existingSite), JSON.stringify(req.body), req.ip || 'unknown']);

                res.json({ success: true, message: '사이트가 성공적으로 수정되었습니다' });
            });
        }
    });
});

// 사이트 삭제 (소프트 삭제)
router.delete('/:id', authenticateToken, checkPermission('site', 'delete'), (req, res) => {
    const { id } = req.params;

    db.get('SELECT * FROM sites WHERE id = ?', [id], (err, site) => {
        if (err) {
            console.error('Get site for delete error:', err);
            return res.status(500).json({ success: false, message: '사이트 삭제 중 오류가 발생했습니다' });
        }

        if (!site) {
            return res.status(404).json({ success: false, message: '사이트를 찾을 수 없습니다' });
        }

        db.run(`
            UPDATE sites SET status = 'inactive', updated_at = datetime('now') WHERE id = ?
        `, [id], function(err) {
            if (err) {
                console.error('Delete site error:', err);
                return res.status(500).json({ success: false, message: '사이트 삭제 중 오류가 발생했습니다' });
            }

            // 해당 사이트의 제품 할당도 비활성화
            db.run(`
                UPDATE site_products SET is_active = 0 WHERE site_id = ?
            `, [id]);

            // 감사 로그
            db.run(`
                INSERT INTO audit_logs (user_id, action_type, table_name, record_id, before_data, ip_address, timestamp)
                VALUES (?, 'delete', 'sites', ?, ?, ?, datetime('now'))
            `, [req.user.userId, id, JSON.stringify(site), req.ip || 'unknown']);

            res.json({ success: true, message: '사이트가 성공적으로 삭제되었습니다' });
        });
    });
});

// 사이트에 제품 할당
router.post('/:id/products', authenticateToken, checkPermission('site', 'update'), (req, res) => {
    const { id: siteId } = req.params;
    const { productId, quantityDefault, salePriceOverride, supplyPriceOverride } = req.body;

    if (!productId || !quantityDefault) {
        return res.status(400).json({
            success: false,
            message: '제품 ID와 기본 수량은 필수 입력 항목입니다'
        });
    }

    // 중복 할당 검사
    db.get(`
        SELECT id FROM site_products
        WHERE site_id = ? AND product_id = ? AND is_active = 1
    `, [siteId, productId], (err, existing) => {
        if (err) {
            console.error('Check duplicate assignment error:', err);
            return res.status(500).json({ success: false, message: '제품 할당 중 오류가 발생했습니다' });
        }

        if (existing) {
            return res.status(409).json({ success: false, message: '이미 할당된 제품입니다' });
        }

        // 제품 할당
        db.run(`
            INSERT INTO site_products (
                site_id, product_id, quantity_default, sale_price_override,
                supply_price_override, is_active, assigned_at
            ) VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
        `, [siteId, productId, quantityDefault, salePriceOverride, supplyPriceOverride], function(err) {
            if (err) {
                console.error('Assign product to site error:', err);
                return res.status(500).json({ success: false, message: '제품 할당 중 오류가 발생했습니다' });
            }

            // 감사 로그
            db.run(`
                INSERT INTO audit_logs (user_id, action_type, table_name, record_id, after_data, ip_address, timestamp)
                VALUES (?, 'assign_product', 'site_products', ?, ?, ?, datetime('now'))
            `, [req.user.userId, this.lastID, JSON.stringify({ siteId, productId, quantityDefault }), req.ip || 'unknown']);

            res.status(201).json({
                success: true,
                message: '제품이 성공적으로 할당되었습니다',
                data: { assignmentId: this.lastID }
            });
        });
    });
});

// 사이트의 제품 할당 해제
router.delete('/:id/products/:productId', authenticateToken, checkPermission('site', 'update'), (req, res) => {
    const { id: siteId, productId } = req.params;

    db.run(`
        UPDATE site_products SET is_active = 0
        WHERE site_id = ? AND product_id = ?
    `, [siteId, productId], function(err) {
        if (err) {
            console.error('Unassign product from site error:', err);
            return res.status(500).json({ success: false, message: '제품 할당 해제 중 오류가 발생했습니다' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ success: false, message: '할당된 제품을 찾을 수 없습니다' });
        }

        // 감사 로그
        db.run(`
            INSERT INTO audit_logs (user_id, action_type, table_name, record_id, after_data, ip_address, timestamp)
            VALUES (?, 'unassign_product', 'site_products', ?, ?, ?, datetime('now'))
        `, [req.user.userId, 0, JSON.stringify({ siteId, productId }), req.ip || 'unknown']);

        res.json({ success: true, message: '제품 할당이 성공적으로 해제되었습니다' });
    });
});

// 사이트 타입 목록 조회
router.get('/types/list', authenticateToken, checkPermission('site', 'read'), (req, res) => {
    db.all(`
        SELECT DISTINCT type, COUNT(*) as count
        FROM sites
        WHERE status = 'active'
        GROUP BY type
        ORDER BY type
    `, (err, types) => {
        if (err) {
            console.error('Get site types error:', err);
            return res.status(500).json({ success: false, message: '사이트 타입 조회 중 오류가 발생했습니다' });
        }

        res.json({ success: true, data: types });
    });
});

module.exports = router;