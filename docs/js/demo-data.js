// GitHub Pages용 데모 데이터
const DemoData = {
    // 사용자 데이터
    users: [
        {
            id: 1,
            email: 'admin@miseane.com',
            password: 'admin123!@#',
            full_name: '시스템 관리자',
            role: 'superadmin',
            department: '시스템팀',
            is_active: 1
        },
        {
            id: 2,
            email: 'manager@miseane.com',
            password: 'manager123',
            full_name: '본사 관리자',
            role: 'hq_admin',
            department: '운영팀',
            is_active: 1
        }
    ],

    // 공급업체 데이터
    suppliers: [
        {
            id: 1,
            name: '한국화장품공업(주)',
            company_name: '한국화장품공업(주)',
            contact_person: '김영희',
            contact_phone: '02-1234-5678',
            contact_email: 'contact@kcosmetics.com',
            address: '서울시 강남구 테헤란로 123',
            business_type: '제조업',
            is_active: 1,
            created_at: '2024-01-15'
        },
        {
            id: 2,
            name: '자연의선물(주)',
            company_name: '자연의선물(주)',
            contact_person: '박민수',
            contact_phone: '031-987-6543',
            contact_email: 'info@naturalgift.com',
            address: '경기도 성남시 분당구 판교로 456',
            business_type: '유통업',
            is_active: 1,
            created_at: '2024-01-20'
        }
    ],

    // 카테고리 데이터
    categories: [
        { id: 1, name: '스킨케어', description: '기초화장품' },
        { id: 2, name: '헤어케어', description: '모발 관리 제품' },
        { id: 3, name: '바디케어', description: '신체 관리 제품' },
        { id: 4, name: '구강케어', description: '구강 위생 제품' }
    ],

    // 제품 데이터
    products: [
        {
            id: 1,
            product_code: 'SKIN-001',
            name: '미세안 보습 크림',
            description: '민감성 피부를 위한 저자극 보습 크림',
            category_id: 1,
            category_name: '스킨케어',
            supplier_id: 1,
            supplier_name: '한국화장품공업(주)',
            unit: '개',
            cost_price: 8000,
            sale_price: 15000,
            factory_profit: 2000,
            calculated_profit: 5000,
            min_stock_level: 50,
            max_stock_level: 500,
            available_stock: 120,
            is_active: 1,
            created_at: '2024-01-15',
            created_by_name: '시스템 관리자'
        },
        {
            id: 2,
            product_code: 'HAIR-002',
            name: '자연 샴푸',
            description: '천연 성분의 순한 샴푸',
            category_id: 2,
            category_name: '헤어케어',
            supplier_id: 2,
            supplier_name: '자연의선물(주)',
            unit: '병',
            cost_price: 6000,
            sale_price: 12000,
            factory_profit: 1500,
            calculated_profit: 4500,
            min_stock_level: 30,
            max_stock_level: 300,
            available_stock: 80,
            is_active: 1,
            created_at: '2024-01-20',
            created_by_name: '본사 관리자'
        },
        {
            id: 3,
            product_code: 'BODY-003',
            name: '보습 로션',
            description: '건성 피부용 보습 로션',
            category_id: 3,
            category_name: '바디케어',
            supplier_id: 1,
            supplier_name: '한국화장품공업(주)',
            unit: '개',
            cost_price: 7000,
            sale_price: 13000,
            factory_profit: 1800,
            calculated_profit: 4200,
            min_stock_level: 40,
            max_stock_level: 400,
            available_stock: 25, // 재고 부족 상태
            is_active: 1,
            created_at: '2024-02-01',
            created_by_name: '시스템 관리자'
        }
    ],

    // 대시보드 통계 데이터
    dashboard: {
        overview: {
            total_products: 150,
            active_suppliers: 25,
            pending_orders: 12,
            low_stock_items: 8,
            total_revenue: 2850000,
            total_profit: 950000,
            monthly_growth: 12.5
        },
        recent_activities: [
            {
                id: 1,
                type: 'product_added',
                message: '새 제품 "미세안 보습 크림"이 등록되었습니다.',
                timestamp: '2024-09-18 09:30:00',
                user: '시스템 관리자'
            },
            {
                id: 2,
                type: 'order_approved',
                message: '주문 #ORD-001이 승인되었습니다.',
                timestamp: '2024-09-18 08:45:00',
                user: '본사 관리자'
            },
            {
                id: 3,
                type: 'stock_low',
                message: '보습 로션의 재고가 부족합니다.',
                timestamp: '2024-09-18 07:20:00',
                user: '시스템'
            }
        ],
        monthly_sales: [
            { month: '1월', revenue: 2100000, profit: 680000 },
            { month: '2월', revenue: 2300000, profit: 750000 },
            { month: '3월', revenue: 2550000, profit: 820000 },
            { month: '4월', revenue: 2200000, profit: 710000 },
            { month: '5월', revenue: 2750000, profit: 890000 },
            { month: '6월', revenue: 2850000, profit: 950000 }
        ]
    },

    // 알림 데이터
    notifications: [
        {
            id: 1,
            type: 'warning',
            title: '재고 부족 알림',
            message: '보습 로션의 재고가 최소 수준 이하입니다.',
            is_read: false,
            created_at: '2024-09-18 07:20:00'
        },
        {
            id: 2,
            type: 'info',
            title: '새 주문 접수',
            message: '새로운 구매 주문이 접수되었습니다.',
            is_read: false,
            created_at: '2024-09-18 06:15:00'
        },
        {
            id: 3,
            type: 'success',
            title: '시스템 업데이트',
            message: '시스템이 성공적으로 업데이트되었습니다.',
            is_read: true,
            created_at: '2024-09-17 23:30:00'
        }
    ],

    // 주문 데이터
    orders: [
        {
            id: 1,
            order_number: 'ORD-2024-001',
            supplier_name: '한국화장품공업(주)',
            total_amount: 450000,
            status: 'pending',
            created_at: '2024-09-18 08:30:00',
            items_count: 3
        },
        {
            id: 2,
            order_number: 'ORD-2024-002',
            supplier_name: '자연의선물(주)',
            total_amount: 280000,
            status: 'approved',
            created_at: '2024-09-17 14:20:00',
            items_count: 2
        }
    ]
};

// 로컬스토리지에서 데이터 로드/저장
const Storage = {
    save(key, data) {
        localStorage.setItem(`miseane_${key}`, JSON.stringify(data));
    },

    load(key, defaultData = null) {
        const stored = localStorage.getItem(`miseane_${key}`);
        return stored ? JSON.parse(stored) : defaultData;
    },

    clear() {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('miseane_')) {
                localStorage.removeItem(key);
            }
        });
    }
};

// 초기 데모 데이터 로드
if (!Storage.load('initialized')) {
    Object.keys(DemoData).forEach(key => {
        Storage.save(key, DemoData[key]);
    });
    Storage.save('initialized', true);
}