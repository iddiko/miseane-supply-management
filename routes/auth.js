const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../database/init');
const {
    generateToken,
    authenticateToken,
    validateEmail,
    validatePassword
} = require('../middleware/auth');

const router = express.Router();

// 권한 확인 미들웨어
const checkPermission = (resource, action) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: '인증이 필요합니다' });
        }

        // 슈퍼어드민은 모든 권한 허용
        if (req.user.role === 'superadmin') {
            return next();
        }

        const permissionName = `${resource}_${action}`;

        // 사용자의 권한 확인
        db.get(`
            SELECT p.name
            FROM permissions p
            JOIN role_permissions rp ON p.id = rp.permission_id
            JOIN roles r ON rp.role_id = r.id
            JOIN users u ON u.role_id = r.id
            WHERE u.id = ? AND p.name = ?
        `, [req.user.userId, permissionName], (err, permission) => {
            if (err) {
                console.error('Permission check error:', err);
                return res.status(500).json({ success: false, message: '권한 확인 중 오류가 발생했습니다' });
            }

            if (!permission) {
                return res.status(403).json({ success: false, message: '권한이 없습니다' });
            }

            next();
        });
    };
};

// 로그인
router.post('/login', (req, res) => {
    const { username, email, password } = req.body;

    if (!password) {
        return res.status(400).json({
            success: false,
            message: '비밀번호를 입력해주세요.'
        });
    }

    if (!username && !email) {
        return res.status(400).json({
            success: false,
            message: '아이디 또는 이메일을 입력해주세요.'
        });
    }

    // 사용자 조회 (역할 정보 포함)
    const query = email ?
        `SELECT u.*, r.name as role_name, r.display_name as role_display_name
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE u.email = ? AND u.is_active = 1` :
        `SELECT u.*, r.name as role_name, r.display_name as role_display_name
         FROM users u
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE u.username = ? AND u.is_active = 1`;

    db.get(query, [email || username], async (err, user) => {
        if (err) {
            console.error('로그인 오류:', err);
            return res.status(500).json({
                success: false,
                message: '로그인 처리 중 오류가 발생했습니다.'
            });
        }

        if (!user) {
            return res.status(401).json({
                success: false,
                message: '사용자를 찾을 수 없습니다.'
            });
        }

        // 비밀번호 확인
        try {
            const isValidPassword = await bcrypt.compare(password, user.password);

            if (!isValidPassword) {
                return res.status(401).json({
                    success: false,
                    message: '비밀번호가 올바르지 않습니다.'
                });
            }

            // 사용자 권한 조회
            const permissions = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT p.name, p.resource, p.action, p.display_name
                    FROM permissions p
                    JOIN role_permissions rp ON p.id = rp.permission_id
                    WHERE rp.role_id = ?
                `, [user.role_id || 0], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });

            // JWT 토큰 생성 (확장된 정보 포함)
            const token = generateToken({
                ...user,
                role: user.role_name || user.role,
                permissions: permissions.map(p => p.name)
            });

            // 마지막 로그인 시간 업데이트
            db.run(
                'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [user.id]
            );

            // 로그인 감사 로그
            db.run(`
                INSERT INTO audit_logs (user_id, action_type, table_name, record_id, after_data, ip_address, timestamp)
                VALUES (?, 'login', 'users', ?, ?, ?, datetime('now'))
            `, [user.id, user.id, JSON.stringify({ login: true }), req.ip || 'unknown']);

            const responseData = {
                success: true,
                message: '로그인되었습니다.',
                data: {
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        full_name: user.full_name,
                        role: user.role_name || user.role,
                        role_display: user.role_display_name,
                        department: user.department,
                        permissions: permissions
                    }
                }
            };

            res.json(responseData);

        } catch (error) {
            console.error('비밀번호 검증 오류:', error);
            res.status(500).json({
                success: false,
                message: '로그인 처리 중 오류가 발생했습니다.'
            });
        }
    });
});

// 회원가입 (관리자만 가능)
router.post('/register', authenticateToken, (req, res) => {
    // 관리자 권한 확인
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: '사용자 등록은 관리자만 가능합니다.'
        });
    }

    const {
        username,
        email,
        password,
        full_name,
        role,
        department,
        phone
    } = req.body;

    // 입력 검증
    if (!username || !email || !password || !full_name || !role) {
        return res.status(400).json({
            success: false,
            message: '필수 정보를 모두 입력해주세요.'
        });
    }

    // 이메일 형식 검증
    if (!validateEmail(email)) {
        return res.status(400).json({
            success: false,
            message: '올바른 이메일 형식이 아닙니다.'
        });
    }

    // 비밀번호 강도 검증
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
        return res.status(400).json({
            success: false,
            message: '비밀번호가 보안 요구사항을 만족하지 않습니다.',
            errors: passwordValidation.errors
        });
    }

    // 역할 유효성 검사
    const validRoles = ['admin', 'purchaser', 'warehouse', 'quality'];
    if (!validRoles.includes(role)) {
        return res.status(400).json({
            success: false,
            message: '유효하지 않은 역할입니다.'
        });
    }

    // 중복 검사
    db.get(
        'SELECT id FROM users WHERE username = ? OR email = ?',
        [username, email],
        async (err, existingUser) => {
            if (err) {
                console.error('중복 검사 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '사용자 등록 중 오류가 발생했습니다.'
                });
            }

            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: '이미 사용 중인 아이디 또는 이메일입니다.'
                });
            }

            // 비밀번호 해시화
            try {
                const hashedPassword = await bcrypt.hash(password, 12);

                // 사용자 생성
                db.run(`
                    INSERT INTO users (
                        username, email, password, full_name,
                        role, department, phone
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    username, email, hashedPassword, full_name,
                    role, department || null, phone || null
                ], function(err) {
                    if (err) {
                        console.error('사용자 생성 오류:', err);
                        return res.status(500).json({
                            success: false,
                            message: '사용자 등록 중 오류가 발생했습니다.'
                        });
                    }

                    res.status(201).json({
                        success: true,
                        message: '사용자가 성공적으로 등록되었습니다.',
                        data: {
                            userId: this.lastID
                        }
                    });
                });

            } catch (error) {
                console.error('비밀번호 해시 오류:', error);
                res.status(500).json({
                    success: false,
                    message: '사용자 등록 중 오류가 발생했습니다.'
                });
            }
        }
    );
});

// 토큰 검증
router.get('/verify', authenticateToken, (req, res) => {
    res.json({
        success: true,
        message: '유효한 토큰입니다.',
        data: {
            user: req.user
        }
    });
});

// 프로필 조회
router.get('/profile', authenticateToken, (req, res) => {
    db.get(
        'SELECT id, username, email, full_name, role, department, phone, created_at FROM users WHERE id = ?',
        [req.user.userId],
        (err, user) => {
            if (err) {
                console.error('프로필 조회 오류:', err);
                return res.status(500).json({
                    success: false,
                    message: '프로필 조회 중 오류가 발생했습니다.'
                });
            }

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: '사용자를 찾을 수 없습니다.'
                });
            }

            res.json({
                success: true,
                data: { user }
            });
        }
    );
});

// 비밀번호 변경
router.put('/change-password', authenticateToken, (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({
            success: false,
            message: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요.'
        });
    }

    // 새 비밀번호 유효성 검사
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
        return res.status(400).json({
            success: false,
            message: '새 비밀번호가 보안 요구사항을 만족하지 않습니다.',
            errors: passwordValidation.errors
        });
    }

    // 현재 비밀번호 확인
    db.get('SELECT password FROM users WHERE id = ?', [req.user.userId], async (err, user) => {
        if (err) {
            console.error('비밀번호 변경 오류:', err);
            return res.status(500).json({
                success: false,
                message: '비밀번호 변경 중 오류가 발생했습니다.'
            });
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                message: '사용자를 찾을 수 없습니다.'
            });
        }

        try {
            const isValidCurrentPassword = await bcrypt.compare(currentPassword, user.password);

            if (!isValidCurrentPassword) {
                return res.status(401).json({
                    success: false,
                    message: '현재 비밀번호가 올바르지 않습니다.'
                });
            }

            // 새 비밀번호 해시화
            const hashedNewPassword = await bcrypt.hash(newPassword, 12);

            // 비밀번호 업데이트
            db.run(
                'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [hashedNewPassword, req.user.userId],
                function(err) {
                    if (err) {
                        console.error('비밀번호 업데이트 오류:', err);
                        return res.status(500).json({
                            success: false,
                            message: '비밀번호 변경 중 오류가 발생했습니다.'
                        });
                    }

                    res.json({
                        success: true,
                        message: '비밀번호가 성공적으로 변경되었습니다.'
                    });
                }
            );

        } catch (error) {
            console.error('비밀번호 검증 오류:', error);
            res.status(500).json({
                success: false,
                message: '비밀번호 변경 중 오류가 발생했습니다.'
            });
        }
    });
});

// 역할 목록 조회
router.get('/roles', authenticateToken, checkPermission('user', 'read'), (req, res) => {
    db.all(`
        SELECT id, name, display_name, description, is_active, created_at
        FROM roles
        WHERE is_active = 1
        ORDER BY display_name
    `, (err, roles) => {
        if (err) {
            console.error('Get roles error:', err);
            return res.status(500).json({ success: false, message: '역할 목록 조회 중 오류가 발생했습니다' });
        }

        res.json({ success: true, data: roles });
    });
});

// 권한 목록 조회
router.get('/permissions', authenticateToken, checkPermission('user', 'read'), (req, res) => {
    db.all(`
        SELECT id, name, display_name, description, resource, action, created_at
        FROM permissions
        ORDER BY resource, action
    `, (err, permissions) => {
        if (err) {
            console.error('Get permissions error:', err);
            return res.status(500).json({ success: false, message: '권한 목록 조회 중 오류가 발생했습니다' });
        }

        res.json({ success: true, data: permissions });
    });
});

// 역할별 권한 조회
router.get('/roles/:roleId/permissions', authenticateToken, checkPermission('user', 'read'), (req, res) => {
    const { roleId } = req.params;

    db.all(`
        SELECT p.id, p.name, p.display_name, p.description, p.resource, p.action,
               CASE WHEN rp.role_id IS NOT NULL THEN 1 ELSE 0 END as granted
        FROM permissions p
        LEFT JOIN role_permissions rp ON p.id = rp.permission_id AND rp.role_id = ?
        ORDER BY p.resource, p.action
    `, [roleId], (err, permissions) => {
        if (err) {
            console.error('Get role permissions error:', err);
            return res.status(500).json({ success: false, message: '역할 권한 조회 중 오류가 발생했습니다' });
        }

        res.json({ success: true, data: permissions });
    });
});

// 역할에 권한 할당/해제
router.post('/roles/:roleId/permissions', authenticateToken, checkPermission('user', 'update'), (req, res) => {
    const { roleId } = req.params;
    const { permissionId, granted } = req.body;

    if (granted) {
        // 권한 할당
        db.run(`
            INSERT OR IGNORE INTO role_permissions (role_id, permission_id, granted_at)
            VALUES (?, ?, datetime('now'))
        `, [roleId, permissionId], function(err) {
            if (err) {
                console.error('Grant permission error:', err);
                return res.status(500).json({ success: false, message: '권한 할당 중 오류가 발생했습니다' });
            }

            // 감사 로그
            db.run(`
                INSERT INTO audit_logs (user_id, action_type, table_name, record_id, after_data, ip_address, timestamp)
                VALUES (?, 'permission_grant', 'role_permissions', ?, ?, ?, datetime('now'))
            `, [req.user.userId, roleId, JSON.stringify({ roleId, permissionId, granted }), req.ip || 'unknown']);

            res.json({ success: true, message: '권한이 성공적으로 할당되었습니다' });
        });
    } else {
        // 권한 해제
        db.run(`
            DELETE FROM role_permissions
            WHERE role_id = ? AND permission_id = ?
        `, [roleId, permissionId], function(err) {
            if (err) {
                console.error('Revoke permission error:', err);
                return res.status(500).json({ success: false, message: '권한 해제 중 오류가 발생했습니다' });
            }

            // 감사 로그
            db.run(`
                INSERT INTO audit_logs (user_id, action_type, table_name, record_id, after_data, ip_address, timestamp)
                VALUES (?, 'permission_revoke', 'role_permissions', ?, ?, ?, datetime('now'))
            `, [req.user.userId, roleId, JSON.stringify({ roleId, permissionId, granted }), req.ip || 'unknown']);

            res.json({ success: true, message: '권한이 성공적으로 해제되었습니다' });
        });
    }
});

// 현재 사용자 정보 조회 (권한 포함)
router.get('/me', authenticateToken, (req, res) => {
    db.get(`
        SELECT u.*, r.name as role_name, r.display_name as role_display_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.id = ?
    `, [req.user.userId], (err, user) => {
        if (err) {
            console.error('Get user info error:', err);
            return res.status(500).json({ success: false, message: '사용자 정보 조회 중 오류가 발생했습니다' });
        }

        if (!user) {
            return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다' });
        }

        db.all(`
            SELECT p.name, p.resource, p.action, p.display_name
            FROM permissions p
            JOIN role_permissions rp ON p.id = rp.permission_id
            WHERE rp.role_id = ?
        `, [user.role_id || 0], (err, permissions) => {
            if (err) {
                console.error('Get user permissions error:', err);
                permissions = [];
            }

            res.json({
                success: true,
                data: {
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        full_name: user.full_name,
                        role: user.role_name || user.role,
                        role_display: user.role_display_name,
                        department: user.department,
                        permissions: permissions
                    }
                }
            });
        });
    });
});

// 로그아웃
router.post('/logout', authenticateToken, (req, res) => {
    // 로그아웃 감사 로그
    db.run(`
        INSERT INTO audit_logs (user_id, action_type, table_name, record_id, after_data, ip_address, timestamp)
        VALUES (?, 'logout', 'users', ?, ?, ?, datetime('now'))
    `, [req.user.userId, req.user.userId, JSON.stringify({ logout: true }), req.ip || 'unknown']);

    res.json({ success: true, message: '로그아웃되었습니다' });
});

// checkPermission 미들웨어도 내보내기
module.exports = { router, checkPermission };