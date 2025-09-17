const express = require('express');
const { db } = require('../database/init');
const { authenticateToken, requirePurchaser } = require('../middleware/auth');

const router = express.Router();

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticateToken);

// 카테고리 목록 조회
router.get('/categories', (req, res) => {
    db.all('SELECT id, name, description FROM categories WHERE is_active = 1 ORDER BY name', (err, categories) => {
        if (err) {
            console.error('카테고리 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '카테고리 조회 중 오류가 발생했습니다.'
            });
        }

        res.json({
            success: true,
            data: categories || []
        });
    });
});

// 제품 목록 조회 (검색, 필터링, 페이지네이션)
router.get('/', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const category_id = req.query.category_id || '';
    const supplier_id = req.query.supplier_id || '';
    const is_active = req.query.is_active || '';

    let query = `
        SELECT
            p.id, p.product_code, p.name, p.description, p.unit,
            p.cost_price, p.sale_price, p.factory_profit, p.calculated_profit,
            p.min_stock_level, p.max_stock_level,
            p.is_active, p.created_at, p.category_id, p.supplier_id,
            c.name as category_name,
            s.name as supplier_name,
            u.full_name as created_by_name,
            u.email as created_by_email,
            COALESCE(SUM(i.quantity - i.reserved_quantity), 0) as available_stock
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN users u ON p.created_by = u.id
        LEFT JOIN inventory i ON p.id = i.product_id
        WHERE 1=1
    `;
    const params = [];

    if (search) {
        query += ' AND (p.name LIKE ? OR p.product_code LIKE ? OR p.description LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (category_id) {
        query += ' AND p.category_id = ?';
        params.push(category_id);
    }

    if (supplier_id) {
        query += ' AND p.supplier_id = ?';
        params.push(supplier_id);
    }

    if (is_active !== '') {
        query += ' AND p.is_active = ?';
        params.push(is_active === 'true' ? 1 : 0);
    }

    query += ' GROUP BY p.id ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    db.all(query, params, (err, products) => {
        if (err) {
            console.error('제품 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '제품 목록 조회 중 오류가 발생했습니다.'
            });
        }

        // 총 개수 조회
        let countQuery = 'SELECT COUNT(*) as total FROM products p WHERE 1=1';
        const countParams = [];

        if (search) {
            countQuery += ' AND (p.name LIKE ? OR p.product_code LIKE ? OR p.description LIKE ?)';
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (category_id) {
            countQuery += ' AND p.category_id = ?';
            countParams.push(category_id);
        }

        if (supplier_id) {
            countQuery += ' AND p.supplier_id = ?';
            countParams.push(supplier_id);
        }

        if (is_active !== '') {
            countQuery += ' AND p.is_active = ?';
            countParams.push(is_active === 'true' ? 1 : 0);
        }

        db.get(countQuery, countParams, (err, countResult) => {
            if (err) {
                console.error('제품 개수 조회 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '제품 개수 조회 중 오류가 발생했습니다.'
                });
            }

            res.json({
                success: true,
                data: {
                    products,
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

// 제품 상세 조회
router.get('/:id', (req, res) => {
    const { id } = req.params;

    const query = `
        SELECT
            p.*,
            c.name as category_name,
            s.name as supplier_name, s.supplier_code,
            u.full_name as created_by_name,
            u.email as created_by_email,
            COALESCE(SUM(i.quantity - i.reserved_quantity), 0) as available_stock,
            COALESCE(SUM(i.quantity), 0) as total_stock
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN users u ON p.created_by = u.id
        LEFT JOIN inventory i ON p.id = i.product_id
        WHERE p.id = ?
        GROUP BY p.id
    `;

    db.get(query, [id], (err, product) => {
        if (err) {
            console.error('제품 상세 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '제품 상세 정보 조회 중 오류가 발생했습니다.'
            });
        }

        if (!product) {
            return res.status(404).json({
                success: false,
                message: '제품을 찾을 수 없습니다.'
            });
        }

        res.json({
            success: true,
            data: { product }
        });
    });
});

// 제품 등록 (구매담당자 이상)
router.post('/', requirePurchaser, (req, res) => {
    const {
        product_code,
        name,
        description,
        category_id,
        unit,
        cost_price,
        sale_price,
        factory_profit,
        supplier_id,
        min_stock_level,
        max_stock_level,
        shelf_life_days,
        storage_conditions,
        specifications,
        image_url
    } = req.body;

    // 필수 필드 검증
    if (!product_code || !name || !category_id || !supplier_id) {
        return res.status(400).json({
            success: false,
            message: '제품 코드, 이름, 카테고리, 공급업체는 필수 입력 사항입니다.'
        });
    }

    // 가격 필드 검증
    if (!cost_price || !sale_price) {
        return res.status(400).json({
            success: false,
            message: '원가와 판매가는 필수 입력 사항입니다.'
        });
    }

    // 수익 자동 계산
    const calculatedProfit = sale_price - cost_price - (factory_profit || 0);

    // 중복 코드 검사
    db.get('SELECT id FROM products WHERE product_code = ?', [product_code], (err, existing) => {
        if (err) {
            console.error('중복 검사 오류:', err);
            return res.status(500).json({
                success: false,
                message: '제품 등록 중 오류가 발생했습니다.'
            });
        }

        if (existing) {
            return res.status(409).json({
                success: false,
                message: '이미 사용 중인 제품 코드입니다.'
            });
        }

        // 제품 등록
        db.run(`
            INSERT INTO products (
                product_code, name, description, category_id, unit, cost_price, sale_price,
                factory_profit, calculated_profit, supplier_id, min_stock_level, max_stock_level,
                shelf_life_days, storage_conditions, specifications, image_url, is_active, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        `, [
            product_code, name, description || null, category_id, unit || 'ea',
            cost_price || 0, sale_price || 0, factory_profit || 0, calculatedProfit,
            supplier_id, min_stock_level || 0, max_stock_level || 1000, shelf_life_days || 365,
            storage_conditions || null, specifications || null, image_url || null,
            req.user.id
        ], function(err) {
            if (err) {
                console.error('제품 등록 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '제품 등록 중 오류가 발생했습니다.'
                });
            }

            res.status(201).json({
                success: true,
                message: '제품이 성공적으로 등록되었습니다.',
                data: {
                    product_id: this.lastID
                }
            });
        });
    });
});

// 제품 수정 (구매담당자 이상)
router.put('/:id', requirePurchaser, (req, res) => {
    const { id } = req.params;
    const {
        name,
        description,
        category_id,
        unit,
        cost_price,
        sale_price,
        factory_profit,
        supplier_id,
        min_stock_level,
        max_stock_level,
        shelf_life_days,
        storage_conditions,
        specifications,
        image_url,
        is_active
    } = req.body;

    // 제품 존재 확인
    db.get('SELECT id FROM products WHERE id = ?', [id], (err, product) => {
        if (err) {
            console.error('제품 확인 오류:', err);
            return res.status(500).json({
                success: false,
                message: '제품 수정 중 오류가 발생했습니다.'
            });
        }

        if (!product) {
            return res.status(404).json({
                success: false,
                message: '제품을 찾을 수 없습니다.'
            });
        }

        // 수익 계산
        const calculatedProfit = sale_price && cost_price && factory_profit !== undefined
            ? sale_price - cost_price - factory_profit
            : null;

        // 제품 정보 수정
        db.run(`
            UPDATE products SET
                name = COALESCE(?, name),
                description = COALESCE(?, description),
                category_id = COALESCE(?, category_id),
                unit = COALESCE(?, unit),
                cost_price = COALESCE(?, cost_price),
                sale_price = COALESCE(?, sale_price),
                factory_profit = COALESCE(?, factory_profit),
                calculated_profit = COALESCE(?, calculated_profit),
                supplier_id = COALESCE(?, supplier_id),
                min_stock_level = COALESCE(?, min_stock_level),
                max_stock_level = COALESCE(?, max_stock_level),
                shelf_life_days = COALESCE(?, shelf_life_days),
                storage_conditions = COALESCE(?, storage_conditions),
                specifications = COALESCE(?, specifications),
                image_url = COALESCE(?, image_url),
                is_active = COALESCE(?, is_active),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            name, description, category_id, unit, cost_price, sale_price, factory_profit, calculatedProfit,
            supplier_id, min_stock_level, max_stock_level, shelf_life_days, storage_conditions,
            specifications, image_url, is_active, id
        ], function(err) {
            if (err) {
                console.error('제품 수정 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '제품 수정 중 오류가 발생했습니다.'
                });
            }

            res.json({
                success: true,
                message: '제품 정보가 성공적으로 수정되었습니다.'
            });
        });
    });
});

// 제품 삭제 (비활성화) - 구매담당자 이상
router.delete('/:id', requirePurchaser, (req, res) => {
    const { id } = req.params;

    // 제품 존재 확인
    db.get('SELECT id FROM products WHERE id = ?', [id], (err, product) => {
        if (err) {
            console.error('제품 확인 오류:', err);
            return res.status(500).json({
                success: false,
                message: '제품 삭제 중 오류가 발생했습니다.'
            });
        }

        if (!product) {
            return res.status(404).json({
                success: false,
                message: '제품을 찾을 수 없습니다.'
            });
        }

        // 제품 비활성화
        db.run(
            'UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [id],
            function(err) {
                if (err) {
                    console.error('제품 비활성화 오류:', err);
                    return res.status(500).json({
                        success: false,
                        message: '제품 비활성화 중 오류가 발생했습니다.'
                    });
                }

                res.json({
                    success: true,
                    message: '제품이 성공적으로 비활성화되었습니다.'
                });
            }
        );
    });
});

// 카테고리 목록 조회
router.get('/categories/list', (req, res) => {
    db.all(`
        SELECT
            c.id, c.name, c.description, c.parent_id,
            parent.name as parent_name,
            COUNT(p.id) as product_count
        FROM categories c
        LEFT JOIN categories parent ON c.parent_id = parent.id
        LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
        GROUP BY c.id
        ORDER BY c.parent_id, c.name
    `, (err, categories) => {
        if (err) {
            console.error('카테고리 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '카테고리 목록 조회 중 오류가 발생했습니다.'
            });
        }

        res.json({
            success: true,
            data: { categories }
        });
    });
});

// 카테고리 등록
router.post('/categories', requirePurchaser, (req, res) => {
    const { name, description, parent_id } = req.body;

    if (!name) {
        return res.status(400).json({
            success: false,
            message: '카테고리 이름은 필수 입력 사항입니다.'
        });
    }

    db.run(`
        INSERT INTO categories (name, description, parent_id)
        VALUES (?, ?, ?)
    `, [name, description || null, parent_id || null], function(err) {
        if (err) {
            console.error('카테고리 등록 오류:', err);
            return res.status(500).json({
                success: false,
                message: '카테고리 등록 중 오류가 발생했습니다.'
            });
        }

        res.status(201).json({
            success: true,
            message: '카테고리가 성공적으로 등록되었습니다.',
            data: {
                category_id: this.lastID
            }
        });
    });
});

// 재고 부족 제품 조회
router.get('/low-stock/list', (req, res) => {
    const query = `
        SELECT
            p.id, p.product_code, p.name, p.min_stock_level,
            c.name as category_name,
            s.name as supplier_name,
            COALESCE(SUM(i.quantity - i.reserved_quantity), 0) as available_stock
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN inventory i ON p.id = i.product_id
        WHERE p.is_active = 1
        GROUP BY p.id
        HAVING available_stock <= p.min_stock_level
        ORDER BY (available_stock / p.min_stock_level) ASC
    `;

    db.all(query, (err, products) => {
        if (err) {
            console.error('재고 부족 제품 조회 오류:', err);
            return res.status(500).json({
                success: false,
                message: '재고 부족 제품 조회 중 오류가 발생했습니다.'
            });
        }

        res.json({
            success: true,
            data: { products }
        });
    });
});

module.exports = router;