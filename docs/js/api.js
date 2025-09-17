// API 통신 모듈 (GitHub Pages 데모 버전)
const DEMO_MODE = true; // GitHub Pages에서는 항상 데모 모드

const API = {
    baseURL: DEMO_MODE ? '' : '/api',

    // 기본 설정
    config: {
        timeout: 30000,
        retries: 3
    },

    // 데모 모드 요청 처리
    async demoRequest(endpoint, options = {}) {
        // 시뮬레이션을 위한 약간의 지연
        await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));

        const method = options.method || 'GET';
        const data = options.body || {};

        // 로그인 처리
        if (endpoint === '/auth/login') {
            const users = Storage.load('users', DemoData.users);
            const user = users.find(u =>
                u.email === data.email && u.password === data.password
            );

            if (user) {
                const token = 'demo_token_' + Date.now();
                Storage.save('auth_token', token);
                Storage.save('current_user', user);
                return {
                    success: true,
                    data: {
                        token,
                        user: { ...user, password: undefined }
                    }
                };
            } else {
                return { success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' };
            }
        }

        // 토큰 검증
        if (endpoint === '/auth/verify') {
            const token = Storage.load('auth_token');
            const user = Storage.load('current_user');
            if (token && user) {
                return { success: true, data: { user: { ...user, password: undefined } } };
            } else {
                return { success: false, error: '인증이 필요합니다.' };
            }
        }

        // 프로필 조회
        if (endpoint === '/auth/profile') {
            const user = Storage.load('current_user');
            if (user) {
                return { success: true, data: { ...user, password: undefined } };
            } else {
                return { success: false, error: '사용자 정보를 찾을 수 없습니다.' };
            }
        }

        // 제품 목록
        if (endpoint === '/products') {
            const products = Storage.load('products', DemoData.products);
            return {
                success: true,
                data: {
                    products,
                    pagination: {
                        current_page: 1,
                        total_pages: 1,
                        total_items: products.length,
                        limit: 10
                    }
                }
            };
        }

        // 제품 카테고리
        if (endpoint === '/products/categories') {
            const categories = Storage.load('categories', DemoData.categories);
            return { success: true, data: categories };
        }

        // 공급업체 목록
        if (endpoint === '/suppliers') {
            const suppliers = Storage.load('suppliers', DemoData.suppliers);
            return {
                success: true,
                data: { suppliers }
            };
        }

        // 대시보드 데이터
        if (endpoint === '/reports/dashboard') {
            const dashboard = Storage.load('dashboard', DemoData.dashboard);
            return { success: true, data: dashboard };
        }

        // 알림 데이터
        if (endpoint === '/notifications') {
            const notifications = Storage.load('notifications', DemoData.notifications);
            return { success: true, data: notifications };
        }

        // 알림 개수
        if (endpoint === '/notifications/unread/count') {
            const notifications = Storage.load('notifications', DemoData.notifications);
            const unreadCount = notifications.filter(n => !n.is_read).length;
            return { success: true, data: { count: unreadCount } };
        }

        // 기본 성공 응답
        return { success: true, data: {} };
    },

    // HTTP 요청 메서드
    async request(endpoint, options = {}) {
        // 데모 모드에서는 데모 요청 처리
        if (DEMO_MODE) {
            return this.demoRequest(endpoint, options);
        }

        const url = `${this.baseURL}${endpoint}`;
        const token = Auth.getToken();

        const config = {
            method: options.method || 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        // 인증 토큰 추가
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // 요청 본문 JSON 변환
        if (config.body && typeof config.body === 'object') {
            config.body = JSON.stringify(config.body);
        }

        try {
            const response = await fetch(url, config);

            // 401 에러시 로그아웃 처리
            if (response.status === 401) {
                Auth.logout();
                return { success: false, error: '인증이 만료되었습니다. 다시 로그인해주세요.' };
            }

            const data = await response.json();
            console.log('API Response:', { url, status: response.status, data });

            if (response.ok) {
                return { success: true, data };
            } else {
                return { success: false, error: data.message || '요청 처리 중 오류가 발생했습니다.' };
            }
        } catch (error) {
            console.error('API Request Error:', error);
            return { success: false, error: '서버와의 통신 중 오류가 발생했습니다.' };
        }
    },

    // GET 요청
    async get(endpoint, params = {}) {
        const query = new URLSearchParams(params).toString();
        const url = query ? `${endpoint}?${query}` : endpoint;
        return this.request(url, { method: 'GET' });
    },

    // POST 요청
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: data
        });
    },

    // PUT 요청
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: data
        });
    },

    // DELETE 요청
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    },

    // 인증 API
    auth: {
        async login(credentials) {
            return API.post('/auth/login', credentials);
        },

        async register(userData) {
            return API.post('/auth/register', userData);
        },

        async verifyToken() {
            return API.get('/auth/verify');
        },

        async changePassword(passwordData) {
            return API.post('/auth/change-password', passwordData);
        },

        async getProfile() {
            return API.get('/auth/profile');
        },

        async updateProfile(profileData) {
            return API.put('/auth/profile', profileData);
        }
    },

    // 공급업체 API
    suppliers: {
        async getAll(params = {}) {
            return API.get('/suppliers', params);
        },

        async getById(id) {
            return API.get(`/suppliers/${id}`);
        },

        async create(supplierData) {
            return API.post('/suppliers', supplierData);
        },

        async update(id, supplierData) {
            return API.put(`/suppliers/${id}`, supplierData);
        },

        async delete(id) {
            return API.delete(`/suppliers/${id}`);
        },

        async getProducts(id) {
            return API.get(`/suppliers/${id}/products`);
        }
    },

    // 제품 API
    products: {
        async getAll(params = {}) {
            return API.get('/products', params);
        },

        async getById(id) {
            return API.get(`/products/${id}`);
        },

        async create(productData) {
            return API.post('/products', productData);
        },

        async update(id, productData) {
            return API.put(`/products/${id}`, productData);
        },

        async delete(id) {
            return API.delete(`/products/${id}`);
        },

        async getCategories() {
            return API.get('/products/categories');
        },

        async getLowStock() {
            return API.get('/products/low-stock');
        }
    },

    // 재고 API
    inventory: {
        async getAll(params = {}) {
            return API.get('/inventory', params);
        },

        async getByLocation(location) {
            return API.get(`/inventory/location/${location}`);
        },

        async updateStock(data) {
            return API.post('/inventory/update-stock', data);
        },

        async getMovements(productId, params = {}) {
            return API.get(`/inventory/movements/${productId}`, params);
        },

        async adjustStock(adjustmentData) {
            return API.post('/inventory/adjust', adjustmentData);
        }
    },

    // 주문 API
    orders: {
        async getAll(params = {}) {
            return API.get('/orders', params);
        },

        async getById(id) {
            return API.get(`/orders/${id}`);
        },

        async create(orderData) {
            return API.post('/orders', orderData);
        },

        async update(id, orderData) {
            return API.put(`/orders/${id}`, orderData);
        },

        async delete(id) {
            return API.delete(`/orders/${id}`);
        },

        async approve(id) {
            return API.post(`/orders/${id}/approve`);
        },

        async reject(id, reason) {
            return API.post(`/orders/${id}/reject`, { reason });
        },

        async getItems(id) {
            return API.get(`/orders/${id}/items`);
        }
    },

    // 배송 API
    shipments: {
        async getAll(params = {}) {
            return API.get('/shipments', params);
        },

        async getById(id) {
            return API.get(`/shipments/${id}`);
        },

        async create(shipmentData) {
            return API.post('/shipments', shipmentData);
        },

        async update(id, shipmentData) {
            return API.put(`/shipments/${id}`, shipmentData);
        },

        async receive(id, receiveData) {
            return API.post(`/shipments/${id}/receive`, receiveData);
        },

        async getItems(id) {
            return API.get(`/shipments/${id}/items`);
        }
    },

    // 품질검사 API
    quality: {
        async getAll(params = {}) {
            return API.get('/quality', params);
        },

        async getById(id) {
            return API.get(`/quality/${id}`);
        },

        async create(qualityData) {
            return API.post('/quality', qualityData);
        },

        async update(id, qualityData) {
            return API.put(`/quality/${id}`, qualityData);
        },

        async approve(id) {
            return API.post(`/quality/${id}/approve`);
        },

        async reject(id, reason) {
            return API.post(`/quality/${id}/reject`, { reason });
        }
    },

    // 알림 API
    notifications: {
        async getAll(params = {}) {
            return API.get('/notifications', params);
        },

        async markAsRead(id) {
            return API.post(`/notifications/${id}/read`);
        },

        async markAllAsRead() {
            return API.post('/notifications/read-all');
        },

        async delete(id) {
            return API.delete(`/notifications/${id}`);
        },

        async getUnreadCount() {
            return API.get('/notifications/unread/count');
        }
    },

    // 보고서 API
    reports: {
        async getDashboardOverview() {
            return API.get('/reports/dashboard');
        },

        async getInventoryReport(params = {}) {
            return API.get('/reports/inventory', params);
        },

        async getPurchaseReport(params = {}) {
            return API.get('/reports/purchase', params);
        },

        async getQualityReport(params = {}) {
            return API.get('/reports/quality', params);
        },

        async getSupplierPerformance(params = {}) {
            return API.get('/reports/supplier-performance', params);
        },

        async exportReport(type, params = {}) {
            const response = await fetch(`${this.baseURL}/reports/export/${type}?${new URLSearchParams(params)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${Auth.getToken()}`
                }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `${type}_report_${Utils.formatDate(new Date(), 'YYYY-MM-DD')}.xlsx`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                return { success: true };
            } else {
                return { success: false, error: '보고서 내보내기에 실패했습니다.' };
            }
        }
    },

    // 사용자 API (관리자용)
    users: {
        async getAll(params = {}) {
            return API.get('/users', params);
        },

        async getById(id) {
            return API.get(`/users/${id}`);
        },

        async create(userData) {
            return API.post('/users', userData);
        },

        async update(id, userData) {
            return API.put(`/users/${id}`, userData);
        },

        async delete(id) {
            return API.delete(`/users/${id}`);
        },

        async resetPassword(id) {
            return API.post(`/users/${id}/reset-password`);
        }
    }
};

// 파일 업로드 헬퍼
API.uploadFile = async function(endpoint, file, additionalData = {}) {
    const token = Auth.getToken();
    const formData = new FormData();

    formData.append('file', file);

    // 추가 데이터 추가
    Object.keys(additionalData).forEach(key => {
        formData.append(key, additionalData[key]);
    });

    try {
        const response = await fetch(`${this.baseURL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (response.status === 401) {
            Auth.logout();
            return { success: false, error: '인증이 만료되었습니다. 다시 로그인해주세요.' };
        }

        const data = await response.json();

        if (response.ok) {
            return { success: true, data };
        } else {
            return { success: false, error: data.message || '파일 업로드 중 오류가 발생했습니다.' };
        }
    } catch (error) {
        console.error('File Upload Error:', error);
        return { success: false, error: '파일 업로드 중 오류가 발생했습니다.' };
    }
};