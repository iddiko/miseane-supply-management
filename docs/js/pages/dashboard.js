// 대시보드 페이지 모듈
const Dashboard = {
    charts: {},
    data: {},

    async init() {
        const contentContainer = document.querySelector('.content-container');
        contentContainer.innerHTML = this.getTemplate();

        // 데이터 로드 및 차트 초기화
        await this.loadDashboardData();
        this.initCharts();
        this.setupEventListeners();
        this.startAutoRefresh();
    },

    getTemplate() {
        return `
            <div class="dashboard">
                <!-- 대시보드 헤더 -->
                <div class="page-header">
                    <h1>
                        <i class="fas fa-chart-pie"></i>
                        대시보드
                    </h1>
                    <div class="page-actions">
                        <div class="last-updated">
                            <i class="fas fa-clock"></i>
                            <span id="lastUpdated">방금 전</span>
                        </div>
                        <button class="btn btn-primary" onclick="Dashboard.refreshData()">
                            <i class="fas fa-sync"></i>
                            새로고침
                        </button>
                    </div>
                </div>

                <!-- 주요 지표 카드 -->
                <div class="dashboard-stats">
                    <div class="stat-card primary">
                        <div class="stat-icon">
                            <i class="fas fa-box"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-value" id="totalProducts">-</div>
                            <div class="stat-label">총 제품 수</div>
                            <div class="stat-change positive" id="productsChange">+0</div>
                        </div>
                    </div>

                    <div class="stat-card success">
                        <div class="stat-icon">
                            <i class="fas fa-truck"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-value" id="totalSuppliers">-</div>
                            <div class="stat-label">공급업체</div>
                            <div class="stat-change positive" id="suppliersChange">+0</div>
                        </div>
                    </div>

                    <div class="stat-card warning">
                        <div class="stat-icon">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-value" id="lowStockCount">-</div>
                            <div class="stat-label">부족 재고</div>
                            <div class="stat-change negative" id="lowStockChange">0</div>
                        </div>
                    </div>

                    <div class="stat-card info">
                        <div class="stat-icon">
                            <i class="fas fa-shopping-cart"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-value" id="todayOrders">-</div>
                            <div class="stat-label">오늘 주문</div>
                            <div class="stat-change positive" id="ordersChange">+0</div>
                        </div>
                    </div>

                    <div class="stat-card danger">
                        <div class="stat-icon">
                            <i class="fas fa-won-sign"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-value" id="monthlyValue">-</div>
                            <div class="stat-label">이달 주문액</div>
                            <div class="stat-change positive" id="valueChange">+0%</div>
                        </div>
                    </div>
                </div>

                <!-- 차트 섹션 -->
                <div class="dashboard-charts">
                    <div class="chart-row">
                        <!-- 매출 추이 차트 -->
                        <div class="chart-card large">
                            <div class="card-header">
                                <h3>
                                    <i class="fas fa-chart-line"></i>
                                    월별 매출 추이
                                </h3>
                                <div class="card-actions">
                                    <select id="salesPeriod" onchange="Dashboard.updateSalesChart()">
                                        <option value="6">최근 6개월</option>
                                        <option value="12" selected>최근 12개월</option>
                                        <option value="24">최근 24개월</option>
                                    </select>
                                </div>
                            </div>
                            <div class="chart-container">
                                <canvas id="salesChart"></canvas>
                            </div>
                        </div>

                        <!-- 카테고리별 제품 분포 -->
                        <div class="chart-card">
                            <div class="card-header">
                                <h3>
                                    <i class="fas fa-chart-pie"></i>
                                    카테고리별 제품 분포
                                </h3>
                            </div>
                            <div class="chart-container">
                                <canvas id="categoryChart"></canvas>
                            </div>
                        </div>
                    </div>

                    <div class="chart-row">
                        <!-- 재고 현황 차트 -->
                        <div class="chart-card">
                            <div class="card-header">
                                <h3>
                                    <i class="fas fa-chart-bar"></i>
                                    재고 현황
                                </h3>
                            </div>
                            <div class="chart-container">
                                <canvas id="inventoryChart"></canvas>
                            </div>
                        </div>

                        <!-- 주문 상태 차트 -->
                        <div class="chart-card">
                            <div class="card-header">
                                <h3>
                                    <i class="fas fa-chart-doughnut"></i>
                                    주문 상태 분포
                                </h3>
                            </div>
                            <div class="chart-container">
                                <canvas id="orderStatusChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 하단 정보 섹션 -->
                <div class="dashboard-info">
                    <div class="info-row">
                        <!-- 최근 활동 -->
                        <div class="info-card">
                            <div class="card-header">
                                <h3>
                                    <i class="fas fa-clock"></i>
                                    최근 활동
                                </h3>
                                <a href="#" onclick="navigateTo('notifications')">모두 보기</a>
                            </div>
                            <div class="activity-list" id="recentActivities">
                                <div class="loading-placeholder">데이터를 불러오는 중...</div>
                            </div>
                        </div>

                        <!-- 부족 재고 알림 -->
                        <div class="info-card">
                            <div class="card-header">
                                <h3>
                                    <i class="fas fa-exclamation-triangle"></i>
                                    재고 부족 알림
                                </h3>
                                <a href="#" onclick="navigateTo('inventory')">재고 관리</a>
                            </div>
                            <div class="stock-alerts" id="stockAlerts">
                                <div class="loading-placeholder">데이터를 불러오는 중...</div>
                            </div>
                        </div>

                        <!-- 시스템 상태 -->
                        <div class="info-card">
                            <div class="card-header">
                                <h3>
                                    <i class="fas fa-server"></i>
                                    시스템 상태
                                </h3>
                            </div>
                            <div class="system-status">
                                <div class="status-item">
                                    <div class="status-indicator online"></div>
                                    <span>데이터베이스</span>
                                    <div class="status-value">정상</div>
                                </div>
                                <div class="status-item">
                                    <div class="status-indicator online"></div>
                                    <span>API 서버</span>
                                    <div class="status-value">정상</div>
                                </div>
                                <div class="status-item">
                                    <div class="status-indicator online"></div>
                                    <span>알림 시스템</span>
                                    <div class="status-value">정상</div>
                                </div>
                                <div class="status-item">
                                    <div class="status-indicator"></div>
                                    <span>마지막 백업</span>
                                    <div class="status-value">2시간 전</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async loadDashboardData() {
        try {
            Utils.showLoading('대시보드 데이터를 불러오는 중...');

            // 통계 데이터 로드
            const statsResponse = await API.reports.getDashboardStats();
            if (statsResponse.success) {
                this.data.stats = statsResponse.data;
                this.updateStatCards();
            }

            // 최근 활동 로드
            const activitiesResponse = await API.reports.getRecentActivities();
            if (activitiesResponse.success) {
                this.data.activities = activitiesResponse.data;
                this.updateRecentActivities();
            }

            // 재고 알림 로드
            const stockAlertsResponse = await API.reports.getLowStockAlerts();
            if (stockAlertsResponse.success) {
                this.data.stockAlerts = stockAlertsResponse.data;
                this.updateStockAlerts();
            }

            Utils.hideLoading();
            this.updateLastUpdated();

        } catch (error) {
            Utils.hideLoading();
            console.error('대시보드 데이터 로드 오류:', error);
            Utils.showToast('대시보드 데이터 로드 중 오류가 발생했습니다.', 'error');
        }
    },

    updateStatCards() {
        if (!this.data.stats) return;

        const stats = this.data.stats;

        document.getElementById('totalProducts').textContent = Utils.formatNumber(stats.totalProducts || 0);
        document.getElementById('totalSuppliers').textContent = Utils.formatNumber(stats.totalSuppliers || 0);
        document.getElementById('lowStockCount').textContent = Utils.formatNumber(stats.lowStockCount || 0);
        document.getElementById('todayOrders').textContent = Utils.formatNumber(stats.todayOrders || 0);
        document.getElementById('monthlyValue').textContent = Utils.formatCurrency(stats.monthlyOrderValue || 0);

        // 변화량 표시 (임시 데이터)
        document.getElementById('productsChange').textContent = '+2';
        document.getElementById('suppliersChange').textContent = '+0';
        document.getElementById('lowStockChange').textContent = stats.lowStockCount > 0 ? '-' + stats.lowStockCount : '0';
        document.getElementById('ordersChange').textContent = '+' + (stats.todayOrders || 0);
        document.getElementById('valueChange').textContent = '+12%';
    },

    initCharts() {
        this.initSalesChart();
        this.initCategoryChart();
        this.initInventoryChart();
        this.initOrderStatusChart();
    },

    initSalesChart() {
        const ctx = document.getElementById('salesChart').getContext('2d');

        // 샘플 데이터 (실제로는 API에서 가져와야 함)
        const salesData = {
            labels: ['7월', '8월', '9월', '10월', '11월', '12월', '1월', '2월', '3월', '4월', '5월', '6월'],
            datasets: [{
                label: '매출액 (만원)',
                data: [1200, 1900, 3000, 5000, 2000, 3000, 4500, 3200, 2800, 4100, 3600, 4800],
                borderColor: '#2c5aa0',
                backgroundColor: 'rgba(44, 90, 160, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        };

        this.charts.sales = new Chart(ctx, {
            type: 'line',
            data: salesData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0,0,0,0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    },

    initCategoryChart() {
        const ctx = document.getElementById('categoryChart').getContext('2d');

        const categoryData = {
            labels: ['스킨케어', '헤어케어', '메이크업', '원료', '포장재'],
            datasets: [{
                data: [35, 25, 20, 15, 5],
                backgroundColor: [
                    '#2c5aa0',
                    '#4a90e2',
                    '#28a745',
                    '#ffc107',
                    '#dc3545'
                ],
                borderWidth: 0
            }]
        };

        this.charts.category = new Chart(ctx, {
            type: 'doughnut',
            data: categoryData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        });
    },

    initInventoryChart() {
        const ctx = document.getElementById('inventoryChart').getContext('2d');

        const inventoryData = {
            labels: ['정상', '부족', '과잉', '만료 임박'],
            datasets: [{
                label: '재고 현황',
                data: [65, 15, 12, 8],
                backgroundColor: [
                    '#28a745',
                    '#ffc107',
                    '#17a2b8',
                    '#dc3545'
                ],
                borderWidth: 1
            }]
        };

        this.charts.inventory = new Chart(ctx, {
            type: 'bar',
            data: inventoryData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    },

    initOrderStatusChart() {
        const ctx = document.getElementById('orderStatusChart').getContext('2d');

        const orderData = {
            labels: ['대기중', '승인됨', '배송중', '완료', '취소'],
            datasets: [{
                data: [20, 35, 25, 15, 5],
                backgroundColor: [
                    '#ffc107',
                    '#17a2b8',
                    '#2c5aa0',
                    '#28a745',
                    '#dc3545'
                ],
                borderWidth: 0
            }]
        };

        this.charts.orderStatus = new Chart(ctx, {
            type: 'doughnut',
            data: orderData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: {
                                size: 11
                            }
                        }
                    }
                }
            }
        });
    },

    updateRecentActivities() {
        const container = document.getElementById('recentActivities');
        if (!this.data.activities || this.data.activities.length === 0) {
            container.innerHTML = '<div class="no-data">최근 활동이 없습니다.</div>';
            return;
        }

        const html = this.data.activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon">
                    <i class="fas ${this.getActivityIcon(activity.type)}"></i>
                </div>
                <div class="activity-info">
                    <div class="activity-message">${activity.message}</div>
                    <div class="activity-time">${Utils.formatDate(activity.created_at, 'YYYY-MM-DD HH:mm')}</div>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    },

    updateStockAlerts() {
        const container = document.getElementById('stockAlerts');
        if (!this.data.stockAlerts || this.data.stockAlerts.length === 0) {
            container.innerHTML = '<div class="no-data">재고 부족 상품이 없습니다.</div>';
            return;
        }

        const html = this.data.stockAlerts.map(alert => `
            <div class="stock-alert-item">
                <div class="alert-icon">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <div class="alert-info">
                    <div class="product-name">${alert.product_name}</div>
                    <div class="stock-info">
                        현재: ${alert.current_stock} / 최소: ${alert.min_stock}
                    </div>
                </div>
                <div class="alert-action">
                    <button class="btn btn-sm btn-warning" onclick="navigateTo('orders')">
                        주문
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    },

    getActivityIcon(type) {
        const icons = {
            'order': 'fa-shopping-cart',
            'inventory': 'fa-box',
            'supplier': 'fa-truck',
            'quality': 'fa-check-circle',
            'shipment': 'fa-shipping-fast',
            'default': 'fa-info-circle'
        };
        return icons[type] || icons.default;
    },

    setupEventListeners() {
        // 차트 크기 조정
        window.addEventListener('resize', () => {
            Object.values(this.charts).forEach(chart => {
                if (chart) chart.resize();
            });
        });
    },

    startAutoRefresh() {
        // 5분마다 자동 새로고침
        setInterval(() => {
            this.refreshData();
        }, 5 * 60 * 1000);
    },

    async refreshData() {
        await this.loadDashboardData();
        Utils.showToast('대시보드가 업데이트되었습니다.', 'success');
    },

    updateSalesChart() {
        const period = document.getElementById('salesPeriod').value;
        // 기간에 따른 차트 데이터 업데이트 로직
        Utils.showToast(`${period}개월 데이터로 업데이트되었습니다.`, 'info');
    },

    updateLastUpdated() {
        document.getElementById('lastUpdated').textContent = '방금 전';
    },

    async search(query) {
        Utils.showToast(`대시보드 검색: ${query}`, 'info');
    }
};

// 전역으로 등록
window.Dashboard = Dashboard;

document.addEventListener('DOMContentLoaded', function() {
    if (window.App) {
        App.registerPage('dashboard', Dashboard);
    }
});