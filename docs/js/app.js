// 메인 애플리케이션 관리자
const App = {
    // 현재 페이지
    currentPage: 'dashboard',

    // 페이지 모듈들
    pages: {},

    // 초기화
    init: function() {
        this.setupEventListeners();
        this.setupSearch();
        this.setupNotifications();
        Utils.hideLoading();
    },

    // 이벤트 리스너 설정
    setupEventListeners: function() {
        // 전역 검색
        const globalSearch = document.getElementById('globalSearch');
        if (globalSearch) {
            globalSearch.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performGlobalSearch(e.target.value);
                }
            });
        }

        // 검색 버튼
        const searchBtn = document.querySelector('.search-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const searchInput = document.getElementById('globalSearch');
                if (searchInput) {
                    this.performGlobalSearch(searchInput.value);
                }
            });
        }

        // 알림 버튼
        const notificationBtn = document.getElementById('notificationBtn');
        if (notificationBtn) {
            notificationBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleNotificationPanel();
            });
        }

        // 사이드바 메뉴 아이템들
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const onclick = item.getAttribute('onclick');
                if (onclick && onclick.includes('navigateTo')) {
                    const page = onclick.match(/navigateTo\('([^']*)'\)/);
                    if (page && page[1]) {
                        this.navigateTo(page[1]);
                    }
                }
            });
        });
    },

    // 검색 기능 설정
    setupSearch: function() {
        this.searchDebounced = Utils.debounce(this.performGlobalSearch.bind(this), 300);
    },

    // 알림 기능 설정
    setupNotifications: function() {
        // 5분마다 알림 개수 업데이트
        setInterval(() => {
            if (Auth.isAuthenticated()) {
                Auth.updateNotificationCount();
            }
        }, 5 * 60 * 1000);

        // 30초마다 새 알림 확인 (개발 환경에서만)
        if (window.location.hostname === 'localhost') {
            setInterval(() => {
                if (Auth.isAuthenticated()) {
                    this.checkNewNotifications();
                }
            }, 30 * 1000);
        }
    },

    // 페이지 네비게이션
    navigateTo: function(page) {
        // 권한 확인
        if (!this.hasPagePermission(page)) {
            Utils.showToast('해당 페이지에 접근할 권한이 없습니다.', 'warning');
            return;
        }

        // 현재 활성 메뉴 제거
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });

        // 새 메뉴 활성화
        const menuItem = document.querySelector(`[onclick="navigateTo('${page}')"]`);
        if (menuItem) {
            menuItem.classList.add('active');
        }

        // 페이지 로드
        this.loadPage(page);
        this.currentPage = page;
    },

    // 페이지 권한 확인
    hasPagePermission: function(page) {
        const user = Auth.getCurrentUser();
        if (!user) return false;

        // 관리자는 모든 페이지 접근 가능
        if (user.role === 'admin' || user.role === 'superadmin') return true;

        // 페이지별 권한 확인
        const permissions = {
            dashboard: ['admin', 'superadmin', 'hq_admin', 'regional_admin', 'branch_admin', 'partner', 'hospital_user'],
            suppliers: ['admin', 'superadmin', 'hq_admin', 'partner'],
            products: ['admin', 'superadmin', 'hq_admin', 'partner'],
            inventory: ['admin', 'superadmin', 'hq_admin', 'regional_admin', 'hospital_user'],
            orders: ['admin', 'superadmin', 'hq_admin', 'hospital_user'],
            shipments: ['admin', 'superadmin', 'hq_admin', 'regional_admin'],
            quality: ['admin', 'superadmin', 'auditor'],
            reports: ['admin', 'superadmin', 'hq_admin', 'auditor'],
            users: ['admin', 'superadmin'],
            settings: ['admin', 'superadmin']
        };

        const allowedRoles = permissions[page];
        return allowedRoles && allowedRoles.includes(user.role);
    },

    // 페이지 로드
    async loadPage(pageName) {
        const contentContainer = document.querySelector('.content-container');
        if (!contentContainer) return;

        try {
            Utils.showLoading(`${this.getPageTitle(pageName)} 로딩 중...`);

            console.log(`페이지 로딩 시도: ${pageName}`);
            console.log('등록된 페이지들:', Object.keys(this.pages));

            // 페이지 모듈이 있으면 초기화
            if (this.pages[pageName] && typeof this.pages[pageName].init === 'function') {
                console.log(`${pageName} 페이지 모듈 초기화 중...`);
                await this.pages[pageName].init();
            } else {
                console.log(`${pageName} 페이지 모듈을 찾을 수 없음. 기본 페이지 로드`);
                // 기본 페이지 로드
                await this.loadDefaultPage(pageName);
            }

            Utils.hideLoading();
        } catch (error) {
            console.error(`페이지 로드 오류 [${pageName}]:`, error);
            Utils.hideLoading();
            Utils.showToast('페이지 로드 중 오류가 발생했습니다.', 'error');
        }
    },

    // 기본 페이지 로드
    async loadDefaultPage(pageName) {
        const contentContainer = document.querySelector('.content-container');
        const pageTitle = this.getPageTitle(pageName);

        contentContainer.innerHTML = `
            <div class="page-header">
                <h1>${pageTitle}</h1>
                <div class="page-actions">
                    <!-- 페이지별 액션 버튼들이 여기에 추가됩니다 -->
                </div>
            </div>
            <div class="page-content">
                <div class="card">
                    <div class="card-header">
                        <h3>${pageTitle}</h3>
                    </div>
                    <div class="card-content">
                        <p>${pageTitle} 페이지가 준비 중입니다.</p>
                        <p>곧 업데이트될 예정입니다.</p>
                    </div>
                </div>
            </div>
        `;
    },

    // 페이지 제목 반환
    getPageTitle: function(pageName) {
        const titles = {
            dashboard: '대시보드',
            suppliers: '공급업체 관리',
            products: '제품 관리',
            inventory: '재고 관리',
            orders: '구매 주문',
            shipments: '배송 관리',
            quality: '품질 검사',
            reports: '보고서',
            users: '사용자 관리',
            settings: '시스템 설정'
        };

        return titles[pageName] || pageName;
    },

    // 전역 검색 수행
    async performGlobalSearch(query) {
        if (!query || query.trim().length < 2) {
            return;
        }

        try {
            Utils.showLoading('검색 중...');

            // 현재 페이지에 검색 기능이 있으면 사용
            if (this.pages[this.currentPage] &&
                typeof this.pages[this.currentPage].search === 'function') {
                await this.pages[this.currentPage].search(query.trim());
            } else {
                Utils.showToast('현재 페이지에서는 검색을 지원하지 않습니다.', 'info');
            }

            Utils.hideLoading();
        } catch (error) {
            console.error('검색 오류:', error);
            Utils.hideLoading();
            Utils.showToast('검색 중 오류가 발생했습니다.', 'error');
        }
    },

    // 알림 패널 토글
    toggleNotificationPanel: function() {
        const panel = document.getElementById('notificationPanel');
        if (!panel) return;

        const isOpen = panel.classList.contains('active');

        if (isOpen) {
            this.closeNotificationPanel();
        } else {
            this.openNotificationPanel();
        }
    },

    // 알림 패널 열기
    async openNotificationPanel() {
        const panel = document.getElementById('notificationPanel');
        const content = document.getElementById('notificationContent');

        if (!panel || !content) return;

        panel.classList.add('active');

        try {
            Utils.showLoading('알림 로딩 중...');

            const response = await API.notifications.getAll({ limit: 10 });

            if (response.success) {
                this.renderNotifications(response.data.notifications || []);
            } else {
                content.innerHTML = '<p class="no-data">알림을 불러올 수 없습니다.</p>';
            }

            Utils.hideLoading();
        } catch (error) {
            console.error('알림 로드 오류:', error);
            content.innerHTML = '<p class="no-data">알림을 불러올 수 없습니다.</p>';
            Utils.hideLoading();
        }
    },

    // 알림 패널 닫기
    closeNotificationPanel: function() {
        const panel = document.getElementById('notificationPanel');
        if (panel) {
            panel.classList.remove('active');
        }
    },

    // 알림 렌더링
    renderNotifications: function(notifications) {
        const content = document.getElementById('notificationContent');
        if (!content) return;

        if (notifications.length === 0) {
            content.innerHTML = '<p class="no-data">새 알림이 없습니다.</p>';
            return;
        }

        content.innerHTML = notifications.map(notification => `
            <div class="notification-item ${notification.is_read ? '' : 'unread'}" data-id="${notification.id}">
                <div class="notification-icon">
                    <i class="fas fa-${this.getNotificationIcon(notification.type)}"></i>
                </div>
                <div class="notification-content">
                    <div class="notification-title">${notification.title}</div>
                    <div class="notification-message">${notification.message}</div>
                    <div class="notification-time">${Utils.formatDate(notification.created_at, 'YYYY-MM-DD HH:mm')}</div>
                </div>
                <div class="notification-actions">
                    ${!notification.is_read ? `
                        <button class="btn-icon" onclick="App.markNotificationAsRead(${notification.id})" title="읽음 처리">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                    <button class="btn-icon" onclick="App.deleteNotification(${notification.id})" title="삭제">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    },

    // 알림 아이콘 반환
    getNotificationIcon: function(type) {
        const icons = {
            system: 'cog',
            warning: 'exclamation-triangle',
            info: 'info-circle',
            success: 'check-circle',
            inventory: 'warehouse',
            order: 'shopping-cart',
            quality: 'check-circle'
        };
        return icons[type] || 'bell';
    },

    // 알림 읽음 처리
    async markNotificationAsRead(id) {
        try {
            const response = await API.notifications.markAsRead(id);
            if (response.success) {
                const item = document.querySelector(`[data-id="${id}"]`);
                if (item) {
                    item.classList.remove('unread');
                    item.querySelector('.notification-actions').innerHTML = `
                        <button class="btn-icon" onclick="App.deleteNotification(${id})" title="삭제">
                            <i class="fas fa-trash"></i>
                        </button>
                    `;
                }
                Auth.updateNotificationCount();
            }
        } catch (error) {
            console.error('알림 읽음 처리 오류:', error);
        }
    },

    // 알림 삭제
    async deleteNotification(id) {
        try {
            const response = await API.notifications.delete(id);
            if (response.success) {
                const item = document.querySelector(`[data-id="${id}"]`);
                if (item) {
                    item.remove();
                }
                Auth.updateNotificationCount();
            }
        } catch (error) {
            console.error('알림 삭제 오류:', error);
        }
    },

    // 새 알림 확인
    async checkNewNotifications() {
        try {
            const response = await API.notifications.getUnreadCount();
            if (response.success) {
                const currentCount = parseInt(document.getElementById('notificationBadge').textContent) || 0;
                const newCount = response.data.count || 0;

                if (newCount > currentCount) {
                    // 새 알림이 있음
                    Utils.showToast('새 알림이 있습니다.', 'info');
                    Auth.updateNotificationCount();
                }
            }
        } catch (error) {
            // 무시 (백그라운드 작업)
        }
    },

    // 페이지 모듈 등록
    registerPage: function(name, pageModule) {
        console.log(`페이지 모듈 등록: ${name}`);
        this.pages[name] = pageModule;
    },

    // 모든 페이지 모듈들을 강제로 등록
    forceRegisterAllPages: function() {
        console.log('모든 페이지 모듈 강제 등록 시작...');

        // 전역에서 페이지 모듈들을 찾아서 등록
        if (window.Dashboard) {
            this.pages['dashboard'] = window.Dashboard;
            console.log('Dashboard 모듈 등록됨');
        }

        if (window.Suppliers) {
            this.pages['suppliers'] = window.Suppliers;
            console.log('Suppliers 모듈 등록됨');
        }

        if (window.Products) {
            this.pages['products'] = window.Products;
            console.log('Products 모듈 등록됨');
        }

        if (window.Inventory) {
            this.pages['inventory'] = window.Inventory;
            console.log('Inventory 모듈 등록됨');
        }

        if (window.Orders) {
            this.pages['orders'] = window.Orders;
            console.log('Orders 모듈 등록됨');
        }

        if (window.Shipments) {
            this.pages['shipments'] = window.Shipments;
            console.log('Shipments 모듈 등록됨');
        }

        if (window.Quality) {
            this.pages['quality'] = window.Quality;
            console.log('Quality 모듈 등록됨');
        }

        if (window.Reports) {
            this.pages['reports'] = window.Reports;
            console.log('Reports 모듈 등록됨');
        }

        if (window.Users) {
            this.pages['users'] = window.Users;
            console.log('Users 모듈 등록됨');
        }

        if (window.Settings) {
            this.pages['settings'] = window.Settings;
            console.log('Settings 모듈 등록됨');
        }

        console.log('강제 등록 완료. 등록된 페이지들:', Object.keys(this.pages));
    }
};

// 전역 네비게이션 함수
function navigateTo(page) {
    App.navigateTo(page);
}

// 알림 패널 닫기 함수
function closeNotificationPanel() {
    App.closeNotificationPanel();
}

// 애플리케이션 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOMContentLoaded - starting initialization');

    // 로딩 화면 먼저 숨기기
    Utils.hideLoading();

    // 페이지 모듈들이 로드될 시간을 기다림
    setTimeout(() => {
        console.log('App 초기화 중...');

        // 페이지 모듈들을 강제로 등록
        App.forceRegisterAllPages();

        // Auth 모듈 먼저 초기화
        Auth.init();

        // 인증 상태 확인 후 적절한 화면 표시
        if (Auth.isAuthenticated()) {
            console.log('User is authenticated, verifying token...');
            Auth.verifyToken().then(isValid => {
                if (isValid) {
                    console.log('Token verified, showing main app');
                    Auth.showMainApp();
                    App.init();
                } else {
                    console.log('Token invalid, showing login screen');
                    Auth.showLoginScreen();
                }
            });
        } else {
            console.log('User is not authenticated, showing login screen');
            Auth.showLoginScreen();
        }
    }, 100); // 100ms 대기
});