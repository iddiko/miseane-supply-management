const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
// require('dotenv').config(); // Not needed for this simple setup

// Database is already initialized separately

const app = express();
const PORT = process.env.PORT || 3000;

// 보안 미들웨어
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com"]
        }
    }
}));

// CORS 설정
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15분
    max: 100 // 최대 100 요청
});
app.use('/api/', limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'public')));

// API 라우트
const { router: authRouter } = require('./routes/auth');
app.use('/api/auth', authRouter);
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/products', require('./routes/products'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/shipments', require('./routes/shipments'));
app.use('/api/quality', require('./routes/quality'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/reports', require('./routes/reports'));

// 새로운 B2B 시스템 라우트
app.use('/api/sites', require('./routes/sites'));
app.use('/api/revenue', require('./routes/revenue'));
app.use('/api/distribution', require('./routes/distribution'));

// 가격 이력 관리
const { router: priceHistoryRouter } = require('./routes/price-history');
app.use('/api/price-history', priceHistoryRouter);

// 메인 페이지
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 에러 핸들링
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: '요청한 리소스를 찾을 수 없습니다.'
    });
});

// 글로벌 에러 핸들링
app.use((err, req, res, next) => {
    console.error(err.stack);

    res.status(err.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === 'production'
            ? '서버 내부 오류가 발생했습니다.'
            : err.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

app.listen(PORT, () => {
    console.log('\n🚀 미세안 제품공급 관리 시스템이 시작되었습니다!');
    console.log(`📡 서버 주소: http://localhost:${PORT}`);
    console.log(`🌍 환경: ${process.env.NODE_ENV || 'development'}`);
    console.log('📊 시스템 상태: 정상 운영 중\n');
});

module.exports = app;