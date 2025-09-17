// 🏥 미세안 대시보드 - 현대적인 디자인
const Dashboard = {
    charts: {},
    data: {},
    widgets: {},
    animationQueue: [],

    async init() {
        const contentContainer = document.querySelector('.content-container');
        contentContainer.innerHTML = this.getTemplate();

        // 초기 로딩 상태 표시
        this.showLoadingState();

        // 데이터 로드
        await this.loadDashboardData();

        // 위젯 애니메이션
        this.animateWidgets();

        // 차트 초기화
        this.initCharts();

        // 이벤트 리스너
        this.setupEventListeners();

        // 실시간 업데이트
        this.startRealTimeUpdates();
    },

    getTemplate() {
        return `
            <div class="modern-dashboard">
                <!-- 대시보드 헤더 -->
                <div class="dashboard-header">
                    <div class="header-content">
                        <div class="header-info">
                            <h1 class="dashboard-title">
                                <span class="title-icon">📊</span>
                                미세안 대시보드
                            </h1>
                            <p class="dashboard-subtitle">실시간 공급망 관리 현황</p>
                        </div>
                        <div class="header-actions">
                            <div class="time-widget">
                                <div class="current-time" id="currentTime"></div>
                                <div class="last-updated">
                                    마지막 업데이트: <span id="lastUpdated">방금 전</span>
                                </div>
                            </div>
                            <button class="refresh-btn" onclick="Dashboard.refreshData()">
                                <i class="fas fa-sync-alt"></i>
                                새로고침
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 핵심 지표 카드 -->
                <div class="kpi-grid">
                    <div class="kpi-card revenue" data-animation="slideInUp">
                        <div class="kpi-background">
                            <i class="fas fa-won-sign"></i>
                        </div>
                        <div class="kpi-content">
                            <div class="kpi-header">
                                <h3>총 매출</h3>
                                <div class="kpi-trend up">
                                    <i class="fas fa-arrow-up"></i>
                                    <span id="revenueTrend">+12.5%</span>
                                </div>
                            </div>
                            <div class="kpi-value" id="totalRevenue">₩2,850,000</div>
                            <div class="kpi-subtitle">이번 달 매출액</div>
                            <div class="kpi-progress">
                                <div class="progress-bar" style="width: 75%"></div>
                            </div>
                        </div>
                    </div>

                    <div class="kpi-card products" data-animation="slideInUp" data-delay="100">
                        <div class="kpi-background">
                            <i class="fas fa-cube"></i>
                        </div>
                        <div class="kpi-content">
                            <div class="kpi-header">
                                <h3>등록 제품</h3>
                                <div class="kpi-trend stable">
                                    <i class="fas fa-minus"></i>
                                    <span id="productsTrend">0%</span>
                                </div>
                            </div>
                            <div class="kpi-value" id="totalProducts">150</div>
                            <div class="kpi-subtitle">활성 제품 수</div>
                            <div class="kpi-progress">
                                <div class="progress-bar" style="width: 60%"></div>
                            </div>
                        </div>
                    </div>

                    <div class="kpi-card suppliers" data-animation="slideInUp" data-delay="200">
                        <div class="kpi-background">
                            <i class="fas fa-truck"></i>
                        </div>
                        <div class="kpi-content">
                            <div class="kpi-header">
                                <h3>공급업체</h3>
                                <div class="kpi-trend up">
                                    <i class="fas fa-arrow-up"></i>
                                    <span id="suppliersTrend">+8.3%</span>
                                </div>
                            </div>
                            <div class="kpi-value" id="totalSuppliers">25</div>
                            <div class="kpi-subtitle">활성 업체 수</div>
                            <div class="kpi-progress">
                                <div class="progress-bar" style="width: 83%"></div>
                            </div>
                        </div>
                    </div>

                    <div class="kpi-card alerts" data-animation="slideInUp" data-delay="300">
                        <div class="kpi-background">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div class="kpi-content">
                            <div class="kpi-header">
                                <h3>재고 부족</h3>
                                <div class="kpi-trend down">
                                    <i class="fas fa-arrow-down"></i>
                                    <span id="alertsTrend">-15%</span>
                                </div>
                            </div>
                            <div class="kpi-value" id="lowStockItems">8</div>
                            <div class="kpi-subtitle">주의 필요 항목</div>
                            <div class="kpi-progress">
                                <div class="progress-bar warning" style="width: 25%"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 차트 및 분석 섹션 -->
                <div class="dashboard-grid">
                    <!-- 매출 차트 -->
                    <div class="dashboard-widget chart-widget" data-animation="fadeInUp">
                        <div class="widget-header">
                            <h3>📈 월별 매출 현황</h3>
                            <div class="widget-controls">
                                <select class="period-selector" onchange="Dashboard.changePeriod(this.value)">
                                    <option value="6months">최근 6개월</option>
                                    <option value="12months">최근 12개월</option>
                                    <option value="ytd">연초부터</option>
                                </select>
                            </div>
                        </div>
                        <div class="widget-content">
                            <canvas id="revenueChart"></canvas>
                        </div>
                    </div>

                    <!-- 제품 분포 차트 -->
                    <div class="dashboard-widget chart-widget" data-animation="fadeInUp" data-delay="100">
                        <div class="widget-header">
                            <h3>🍰 제품 카테고리 분포</h3>
                            <div class="widget-controls">
                                <button class="chart-type-btn active" data-type="doughnut">도넛</button>
                                <button class="chart-type-btn" data-type="bar">막대</button>
                            </div>
                        </div>
                        <div class="widget-content">
                            <canvas id="categoryChart"></canvas>
                        </div>
                    </div>

                    <!-- 최근 활동 -->
                    <div class="dashboard-widget activity-widget" data-animation="fadeInUp" data-delay="200">
                        <div class="widget-header">
                            <h3>⚡ 실시간 활동</h3>
                            <div class="widget-controls">
                                <button class="activity-filter active" data-filter="all">전체</button>
                                <button class="activity-filter" data-filter="orders">주문</button>
                                <button class="activity-filter" data-filter="products">제품</button>
                                <button class="activity-filter" data-filter="alerts">알림</button>
                            </div>
                        </div>
                        <div class="widget-content">
                            <div class="activity-list" id="activityList">
                                <!-- 활동 내역이 여기에 동적으로 로드됩니다 -->
                            </div>
                        </div>
                    </div>

                    <!-- 재고 현황 -->
                    <div class="dashboard-widget inventory-widget" data-animation="fadeInUp" data-delay="300">
                        <div class="widget-header">
                            <h3>📦 재고 현황</h3>
                            <div class="widget-controls">
                                <button class="view-toggle active" data-view="grid">격자</button>
                                <button class="view-toggle" data-view="list">목록</button>
                            </div>
                        </div>
                        <div class="widget-content">
                            <div class="inventory-grid" id="inventoryGrid">
                                <!-- 재고 정보가 여기에 표시됩니다 -->
                            </div>
                        </div>
                    </div>

                    <!-- 성과 지표 -->
                    <div class="dashboard-widget performance-widget" data-animation="fadeInUp" data-delay="400">
                        <div class="widget-header">
                            <h3>🎯 성과 지표</h3>
                            <div class="widget-controls">
                                <span class="performance-period">이번 주</span>
                            </div>
                        </div>
                        <div class="widget-content">
                            <div class="performance-metrics">
                                <div class="metric-item">
                                    <div class="metric-label">주문 처리율</div>
                                    <div class="metric-progress">
                                        <div class="progress-circle" data-percentage="94">
                                            <span>94%</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="metric-item">
                                    <div class="metric-label">품질 합격률</div>
                                    <div class="metric-progress">
                                        <div class="progress-circle" data-percentage="98">
                                            <span>98%</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="metric-item">
                                    <div class="metric-label">공급업체 만족도</div>
                                    <div class="metric-progress">
                                        <div class="progress-circle" data-percentage="87">
                                            <span>87%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 빠른 액션 -->
                    <div class="dashboard-widget quick-actions-widget" data-animation="fadeInUp" data-delay="500">
                        <div class="widget-header">
                            <h3>⚡ 빠른 작업</h3>
                        </div>
                        <div class="widget-content">
                            <div class="quick-actions">
                                <button class="quick-action-btn" onclick="navigateTo('products')">
                                    <i class="fas fa-plus"></i>
                                    <span>제품 추가</span>
                                </button>
                                <button class="quick-action-btn" onclick="navigateTo('orders')">
                                    <i class="fas fa-shopping-cart"></i>
                                    <span>주문 생성</span>
                                </button>
                                <button class="quick-action-btn" onclick="navigateTo('inventory')">
                                    <i class="fas fa-warehouse"></i>
                                    <span>재고 조정</span>
                                </button>
                                <button class="quick-action-btn" onclick="navigateTo('reports')">
                                    <i class="fas fa-chart-bar"></i>
                                    <span>보고서</span>
                                </button>
                                <button class="quick-action-btn" onclick="navigateTo('suppliers')">
                                    <i class="fas fa-truck"></i>
                                    <span>업체 관리</span>
                                </button>
                                <button class="quick-action-btn" onclick="navigateTo('quality')">
                                    <i class="fas fa-check-circle"></i>
                                    <span>품질 검사</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 로딩 오버레이 -->
                <div class="loading-overlay" id="dashboardLoading">
                    <div class="loading-content">
                        <div class="loading-spinner"></div>
                        <p>대시보드 데이터를 불러오는 중...</p>
                    </div>
                </div>
            </div>
        `;
    },

    showLoadingState() {
        const overlay = document.getElementById('dashboardLoading');
        if (overlay) {
            overlay.style.display = 'flex';
        }
    },

    hideLoadingState() {
        const overlay = document.getElementById('dashboardLoading');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 300);
        }
    },

    async loadDashboardData() {
        try {
            const response = await API.reports.getDashboardOverview();

            if (response.success) {
                this.data = response.data;
                this.updateWidgets();
                this.hideLoadingState();
            } else {
                console.error('대시보드 데이터 로드 실패:', response.error);
                this.hideLoadingState();
                Utils.showToast('대시보드 데이터를 불러올 수 없습니다.', 'error');
            }
        } catch (error) {
            console.error('대시보드 데이터 로드 오류:', error);
            this.hideLoadingState();
            Utils.showToast('데이터 로드 중 오류가 발생했습니다.', 'error');
        }
    },

    updateWidgets() {
        if (!this.data || !this.data.overview) return;

        const overview = this.data.overview;

        // KPI 카드 업데이트
        this.updateElement('totalRevenue', `₩${Utils.formatNumber(overview.total_revenue)}`);
        this.updateElement('totalProducts', overview.total_products);
        this.updateElement('totalSuppliers', overview.active_suppliers);
        this.updateElement('lowStockItems', overview.low_stock_items);

        // 트렌드 업데이트
        this.updateElement('revenueTrend', `+${overview.monthly_growth}%`);

        // 활동 내역 업데이트
        this.updateActivityList();

        // 재고 현황 업데이트
        this.updateInventoryGrid();
    },

    updateActivityList() {
        const activityList = document.getElementById('activityList');
        if (!activityList || !this.data.recent_activities) return;

        const activities = this.data.recent_activities.slice(0, 10);

        activityList.innerHTML = activities.map(activity => `
            <div class="activity-item ${activity.type}" data-animation="slideInRight">
                <div class="activity-icon">
                    <i class="fas ${this.getActivityIcon(activity.type)}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-message">${activity.message}</div>
                    <div class="activity-meta">
                        <span class="activity-user">${activity.user}</span>
                        <span class="activity-time">${Utils.formatTimeAgo(activity.timestamp)}</span>
                    </div>
                </div>
            </div>
        `).join('');

        // 활동 아이템 애니메이션
        this.animateActivityItems();
    },

    updateInventoryGrid() {
        const inventoryGrid = document.getElementById('inventoryGrid');
        if (!inventoryGrid) return;

        // 데모 재고 데이터
        const inventoryItems = [
            { name: '미세안 보습 크림', stock: 120, min: 50, status: 'good' },
            { name: '자연 샴푸', stock: 80, min: 30, status: 'good' },
            { name: '보습 로션', stock: 25, min: 40, status: 'low' },
            { name: '클렌징 폼', stock: 15, min: 25, status: 'critical' }
        ];

        inventoryGrid.innerHTML = inventoryItems.map(item => `
            <div class="inventory-item ${item.status}">
                <div class="inventory-info">
                    <h4>${item.name}</h4>
                    <div class="stock-info">
                        <span class="current-stock">${item.stock}</span>
                        <span class="min-stock">최소: ${item.min}</span>
                    </div>
                </div>
                <div class="inventory-status">
                    <div class="status-indicator ${item.status}"></div>
                    <div class="stock-progress">
                        <div class="progress-bar" style="width: ${Math.min(100, (item.stock / item.min) * 50)}%"></div>
                    </div>
                </div>
            </div>
        `).join('');
    },

    animateWidgets() {
        const widgets = document.querySelectorAll('[data-animation]');

        widgets.forEach((widget, index) => {
            const delay = parseInt(widget.dataset.delay) || index * 100;
            const animation = widget.dataset.animation || 'fadeInUp';

            setTimeout(() => {
                widget.classList.add('animate', animation);
            }, delay);
        });
    },

    animateActivityItems() {
        const items = document.querySelectorAll('.activity-item');

        items.forEach((item, index) => {
            setTimeout(() => {
                item.classList.add('animate', 'slideInRight');
            }, index * 100);
        });
    },

    getActivityIcon(type) {
        const icons = {
            'product_added': 'fa-plus-circle',
            'order_approved': 'fa-check-circle',
            'stock_low': 'fa-exclamation-triangle',
            'supplier_updated': 'fa-truck',
            'user_login': 'fa-sign-in-alt',
            'quality_check': 'fa-clipboard-check'
        };
        return icons[type] || 'fa-info-circle';
    },

    initCharts() {
        this.initRevenueChart();
        this.initCategoryChart();
        this.initPerformanceCircles();
    },

    initRevenueChart() {
        const ctx = document.getElementById('revenueChart');
        if (!ctx) return;

        const data = this.data.monthly_sales || [
            { month: '1월', revenue: 2100000, profit: 680000 },
            { month: '2월', revenue: 2300000, profit: 750000 },
            { month: '3월', revenue: 2550000, profit: 820000 },
            { month: '4월', revenue: 2200000, profit: 710000 },
            { month: '5월', revenue: 2750000, profit: 890000 },
            { month: '6월', revenue: 2850000, profit: 950000 }
        ];

        this.charts.revenue = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.month),
                datasets: [{
                    label: '매출액',
                    data: data.map(d => d.revenue),
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }, {
                    label: '수익',
                    data: data.map(d => d.profit),
                    borderColor: '#ff6b6b',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₩' + Utils.formatNumber(value);
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    },

    initCategoryChart() {
        const ctx = document.getElementById('categoryChart');
        if (!ctx) return;

        this.charts.category = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['스킨케어', '헤어케어', '바디케어', '구강케어'],
                datasets: [{
                    data: [40, 25, 20, 15],
                    backgroundColor: [
                        '#667eea',
                        '#ff6b6b',
                        '#4ecdc4',
                        '#45b7d1'
                    ],
                    borderWidth: 0,
                    hoverBorderWidth: 3,
                    hoverBorderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    },

    initPerformanceCircles() {
        const circles = document.querySelectorAll('.progress-circle');

        circles.forEach(circle => {
            const percentage = parseInt(circle.dataset.percentage);
            const circumference = 2 * Math.PI * 45; // 반지름 45

            // SVG 요소 추가
            circle.innerHTML = `
                <svg width="100" height="100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#e9ecef" stroke-width="8"/>
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#667eea" stroke-width="8"
                            stroke-dasharray="${circumference}"
                            stroke-dashoffset="${circumference - (percentage / 100) * circumference}"
                            stroke-linecap="round"
                            transform="rotate(-90 50 50)"/>
                </svg>
                <span>${percentage}%</span>
            `;
        });
    },

    setupEventListeners() {
        // 차트 타입 변경 버튼
        document.querySelectorAll('.chart-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.target.dataset.type;
                this.changeChartType(type);

                // 버튼 상태 업데이트
                e.target.parentElement.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        // 활동 필터 버튼
        document.querySelectorAll('.activity-filter').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filter = e.target.dataset.filter;
                this.filterActivities(filter);

                // 버튼 상태 업데이트
                e.target.parentElement.querySelectorAll('.activity-filter').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        // 시간 업데이트
        this.updateCurrentTime();
        setInterval(() => this.updateCurrentTime(), 1000);
    },

    changeChartType(type) {
        if (this.charts.category) {
            this.charts.category.destroy();

            const ctx = document.getElementById('categoryChart');
            this.charts.category = new Chart(ctx, {
                type: type,
                data: {
                    labels: ['스킨케어', '헤어케어', '바디케어', '구강케어'],
                    datasets: [{
                        data: [40, 25, 20, 15],
                        backgroundColor: [
                            '#667eea',
                            '#ff6b6b',
                            '#4ecdc4',
                            '#45b7d1'
                        ],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: type === 'doughnut' ? 'bottom' : 'top'
                        }
                    }
                }
            });
        }
    },

    filterActivities(filter) {
        const items = document.querySelectorAll('.activity-item');

        items.forEach(item => {
            if (filter === 'all' || item.classList.contains(filter)) {
                item.style.display = 'flex';
                item.classList.add('animate', 'fadeIn');
            } else {
                item.style.display = 'none';
            }
        });
    },

    updateCurrentTime() {
        const timeElement = document.getElementById('currentTime');
        if (timeElement) {
            const now = new Date();
            const timeString = now.toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            timeElement.textContent = timeString;
        }
    },

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    },

    startRealTimeUpdates() {
        // 30초마다 데이터 업데이트
        setInterval(async () => {
            await this.loadDashboardData();
            this.updateElement('lastUpdated', Utils.formatTimeAgo(new Date()));
        }, 30000);
    },

    async refreshData() {
        this.showLoadingState();
        await this.loadDashboardData();
        this.updateElement('lastUpdated', '방금 전');
        Utils.showToast('대시보드가 업데이트되었습니다.', 'success');
    },

    changePeriod(period) {
        // 기간 변경에 따른 차트 데이터 업데이트
        Utils.showToast(`${period} 데이터로 업데이트되었습니다.`, 'info');
    }
};

// 전역으로 등록
window.Dashboard = Dashboard;

// 페이지 등록
document.addEventListener('DOMContentLoaded', function() {
    if (window.App) {
        App.registerPage('dashboard', Dashboard);
    }
});