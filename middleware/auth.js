const jwt = require('jsonwebtoken');
const { db } = require('../database/init');

const JWT_SECRET = process.env.JWT_SECRET || 'miseane_supply_secret_key_2024';

// JWT 토큰 생성
const generateToken = (user) => {
    return jwt.sign(
        {
            userId: user.id,
            username: user.username,
            email: user.email,
            role: user.role
        },
        JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

// JWT 토큰 검증
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: '액세스 토큰이 필요합니다.'
        });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({
                success: false,
                message: '유효하지 않은 토큰입니다.'
            });
        }

        // 사용자 정보를 요청 객체에 추가
        req.user = decoded;
        next();
    });
};

// 역할 기반 권한 확인
const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: '인증이 필요합니다.'
            });
        }

        const userRoles = Array.isArray(roles) ? roles : [roles];

        if (!userRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: '권한이 부족합니다.'
            });
        }

        next();
    };
};

// 관리자 권한 확인
const requireAdmin = requireRole(['admin', 'superadmin']);

// 구매 권한 확인 (구매담당자 + 관리자)
const requirePurchaser = requireRole(['admin', 'superadmin', 'hq_admin', 'purchaser']);

// 창고 권한 확인 (창고담당자 + 관리자)
const requireWarehouse = requireRole(['admin', 'superadmin', 'hq_admin', 'warehouse']);

// 품질 권한 확인 (품질관리자 + 관리자)
const requireQuality = requireRole(['admin', 'superadmin', 'auditor', 'quality']);

// 이메일 유효성 검사
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// 비밀번호 유효성 검사
const validatePassword = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    const errors = [];
    if (password.length < minLength) errors.push('비밀번호는 최소 8자리 이상이어야 합니다.');
    if (!hasUpperCase) errors.push('대문자를 포함해야 합니다.');
    if (!hasLowerCase) errors.push('소문자를 포함해야 합니다.');
    if (!hasNumbers) errors.push('숫자를 포함해야 합니다.');
    if (!hasSpecialChar) errors.push('특수문자를 포함해야 합니다.');

    return {
        isValid: errors.length === 0,
        errors
    };
};

module.exports = {
    generateToken,
    authenticateToken,
    requireRole,
    requireAdmin,
    requirePurchaser,
    requireWarehouse,
    requireQuality,
    validateEmail,
    validatePassword
};