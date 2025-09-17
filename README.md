# 미세안 공급망 관리 시스템

한국의 요양원, 병원, 경로당 등 의료 및 요양 시설을 위한 종합적인 공급망 관리 시스템입니다.

## 🏥 주요 기능

### 제품 관리
- **다층 가격 구조**: 원가, 판매가, 공장수익 분리 관리
- **자동 수익 계산**: 판매가 - 원가 - 공장수익 = 수익
- **카테고리별 제품 분류**
- **공급업체 연동 관리**

### 사용자 관리
- **역할 기반 권한 시스템**
  - 시스템 관리자
  - 본사 관리자
  - 지사 관리자
  - 지점 관리자
  - 협력사
  - 병원/요양원 담당자

### 사이트(거래처) 관리
- **다양한 시설 유형 지원**
  - 요양원
  - 경로당
  - 병원
  - 기타 의료시설

### 수익 배분 시스템
- **다단계 배분 구조**
  - 공장: 32%
  - 본사: 3%
  - 지사: 25%
  - 지점: 2%
  - 전국: 2%
  - 지역: 3%
  - 구역: 5%
  - 병원: 30%

## 🚀 기술 스택

- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Authentication**: JWT 토큰 기반 인증

## 📋 시스템 요구사항

- Node.js 14.0 이상
- npm 6.0 이상

## 🛠️ 설치 및 실행

1. **저장소 클론**
   ```bash
   git clone [repository-url]
   cd miseane
   ```

2. **의존성 설치**
   ```bash
   npm install
   ```

3. **데이터베이스 초기화**
   ```bash
   node database/init.js
   node database/extend_schema.js
   node database/update_products_schema.js
   ```

4. **서버 실행**
   ```bash
   npm start
   ```

5. **접속**
   - 브라우저에서 `http://localhost:3000` 접속
   - 기본 관리자 계정: admin@miseane.com / admin123

## 📁 프로젝트 구조

```
miseane/
├── database/           # 데이터베이스 스키마 및 초기화
├── middleware/         # Express 미들웨어
├── routes/            # API 라우트
├── public/            # 정적 파일 (HTML, CSS, JS)
│   ├── css/           # 스타일시트
│   ├── js/            # 클라이언트 JavaScript
│   └── pages/         # 페이지별 모듈
├── logs/              # 로그 파일
└── app.js             # 메인 애플리케이션
```

## 🔐 보안 기능

- JWT 토큰 기반 인증
- 역할 기반 접근 제어 (RBAC)
- 비밀번호 해싱 (bcrypt)
- SQL 인젝션 방지
- CORS 보안 설정

## 📊 주요 데이터베이스 테이블

- `users` - 사용자 정보
- `roles` - 역할 정의
- `products` - 제품 정보 (가격 구조 포함)
- `categories` - 제품 카테고리
- `suppliers` - 공급업체
- `sites` - 거래처 정보
- `distribution_rules` - 수익 배분 규칙
- `revenue_transactions` - 수익 트랜잭션

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 라이센스

이 프로젝트는 미세안에서 개발된 상용 소프트웨어입니다.

## 📞 연락처

- 이메일: support@miseane.com
- 웹사이트: https://plugon.co.kr

---

**© 2024 (주)미세안. All rights reserved.**