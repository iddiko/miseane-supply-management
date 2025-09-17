const express = require('express');
const { db } = require('../database/init');
const { authenticateToken, requirePurchaser } = require('../middleware/auth');

const router = express.Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

// 공급업체 목록 조회
router.get('/', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || '';

    let query = `
        SELECT
            id, supplier_code, name, contact_person, email, phone,
            address, country, rating, status, created_at
        FROM suppliers
        WHERE 1=1
    `;
    const params = [];

    if (search) {
        query += ' AND (name LIKE ? OR supplier_code LIKE ? OR contact_person LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (status) {
        query += ' AND status = ?';
        params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    db.all(query, params, (err, suppliers) => {
        if (err) {
            console.error('공급업체 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '공급업체 목록 조회 중 오류가 발생했습니다.'
            });
        }

        // 총 개수 조회
        let countQuery = 'SELECT COUNT(*) as total FROM suppliers WHERE 1=1';
        const countParams = [];

        if (search) {
            countQuery += ' AND (name LIKE ? OR supplier_code LIKE ? OR contact_person LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (status) {
            countQuery += ' AND status = ?';
            countParams.push(status);
        }

        db.get(countQuery, countParams, (err, countResult) => {
            if (err) {
                console.error('공급업체 개수 조회 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '공급업체 개수 조회 중 오류가 발생했습니다.'
                });
            }

            res.json({
                success: true,
                data: {
                    suppliers,
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

// 공급업체 상세 조회
router.get('/:id', (req, res) => {
    const { id } = req.params;

    db.get('SELECT * FROM suppliers WHERE id = ?', [id], (err, supplier) => {
        if (err) {
            console.error('공급업체 상세 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '공급업체 상세 정보 조회 중 오류가 발생했습니다.'
            });
        }

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: '공급업체를 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            data: { supplier }
        });
    });
});

// 공급업체 등록 (구매담당자 이상)
router.post('/', requirePurchaser, (req, res) => {
    const {
        supplier_code,
        name,
        contact_person,
        email,
        phone,
        address,
        country,
        tax_number,
        payment_terms,
        rating
    } = req.body;

    // 필수 필드 검증
    if (!supplier_code || !name) {
        return res.status(400).json({
            success: false,
            message: '공급업체 코드와 이름은 필수 입력 사항입니다.'
        });
    }

    // 중복 코드 검사
    db.get('SELECT id FROM suppliers WHERE supplier_code = ?', [supplier_code], (err, existing) => {
        if (err) {
            console.error('중복 검사 오류:', err);
            return res.status(500).json({
                success: false,
                message: '공급업체 등록 중 오류가 발생했습니다.'
            });
        }

        if (existing) {
            return res.status(409).json({
                success: false,
                message: '이미 사용 중인 공급업체 코드입니다.'
            });
        }

        // 공급업체 등록
        db.run(`
            INSERT INTO suppliers (
                supplier_code, name, contact_person, email, phone,
                address, country, tax_number, payment_terms, rating, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
        `, [
            supplier_code, name, contact_person || null, email || null,
            phone || null, address || null, country || null,
            tax_number || null, payment_terms || 30, rating || 3
        ], function(err) {
            if (err) {
                console.error('공급업체 등록 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '공급업체 등록 중 오류가 발생했습니다.'
                });
            }

            res.status(201).json({
                success: true,
                message: '공급업체가 성공적으로 등록되었습니다.',
                data: {
                    supplier_id: this.lastID
                }
            });
        });
    });
});

// 공급업체 수정 (구매담당자 이상)
router.put('/:id', requirePurchaser, (req, res) => {
    const { id } = req.params;
    const {
        name,
        contact_person,
        email,
        phone,
        address,
        country,
        tax_number,
        payment_terms,
        rating,
        status
    } = req.body;

    // 공급업체 존재 확인
    db.get('SELECT id FROM suppliers WHERE id = ?', [id], (err, supplier) => {
        if (err) {
            console.error('공급업체 확인 오류:', err);
            return res.status(500).json({
                success: false,
                message: '공급업체 수정 중 오류가 발생했습니다.'
            });
        }

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: '공급업체를 찾을 수 없습니다.'
            });
        }

        // 공급업체 정보 수정
        db.run(`
            UPDATE suppliers SET
                name = COALESCE(?, name),
                contact_person = COALESCE(?, contact_person),
                email = COALESCE(?, email),
                phone = COALESCE(?, phone),
                address = COALESCE(?, address),
                country = COALESCE(?, country),
                tax_number = COALESCE(?, tax_number),
                payment_terms = COALESCE(?, payment_terms),
                rating = COALESCE(?, rating),
                status = COALESCE(?, status),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            name, contact_person, email, phone, address,
            country, tax_number, payment_terms, rating, status, id
        ], function(err) {
            if (err) {
                console.error('공급업체 수정 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '공급업체 수정 중 오류가 발생했습니다.'
                });
            }

            res.json({
                success: true,
                message: '공급업체 정보가 성공적으로 수정되었습니다.'
            });
        });
    });
});

// 공급업체 삭제 (비활성화) - 구매담당자 이상
router.delete('/:id', requirePurchaser, (req, res) => {
    const { id } = req.params;

    // 공급업체 존재 확인
    db.get('SELECT id FROM suppliers WHERE id = ?', [id], (err, supplier) => {
        if (err) {
            console.error('공급업체 확인 오류:', err);
            return res.status(500).json({
                success: false,
                message: '공급업체 삭제 중 오류가 발생했습니다.'
            });
        }

        if (!supplier) {
            return res.status(404).json({
                success: false,
                message: '공급업체를 찾을 수 없습니다.'
            });
        }

        // 공급업체 비활성화
        db.run(
            'UPDATE suppliers SET status = "inactive", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [id],
            function(err) {
                if (err) {
                    console.error('공급업체 비활성화 오류:', err);
                    return res.status(500).json({
                        success: false,
                        message: '공급업체 비활성화 중 오류가 발생했습니다.'
                    });
                }

                res.json({
                    success: true,
                    message: '공급업체가 성공적으로 비활성화되었습니다.'
                });
            }
        );
    });
});

// 공급업체별 제품 목록
router.get('/:id/products', (req, res) => {
    const { id } = req.params;

    db.all(`
        SELECT
            p.id, p.product_code, p.name, p.description,
            c.name as category_name, p.unit, p.unit_price,
            p.is_active
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.supplier_id = ? AND p.is_active = 1
        ORDER BY p.name
    `, [id], (err, products) => {
        if (err) {
            console.error('공급업체 제품 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '공급업체 제품 목록 조회 중 오류가 발생했습니다.'
            });
        }

        res.json({
            success: true,
            data: { products }
        });
    });
});

module.exports = router;