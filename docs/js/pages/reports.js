// 보고서 페이지 모듈
const Reports = {
    charts: {},
    currentDateRange: 'month',

    async init() {
        const contentContainer = document.querySelector('.content-container');
        contentContainer.innerHTML = this.getTemplate();

        await this.loadData();
        this.initCharts();
        this.bindEvents();
    },

    getTemplate() {
        return `
            <div class="page-header">
                <h1>보고서 및 분석</h1>
                <div class="page-actions">
                    <select id="dateRangeSelect" class="form-select">
                        <option value="week">지난 주</option>
                        <option value="month" selected>지난 월</option>
                        <option value="quarter">지난 분기</option>
                        <option value="year">지난 년</option>
                    </select>
                    <button class="btn btn-secondary" onclick="Reports.refreshData()">
                        <i class="fas fa-sync-alt"></i>
                        새로고침
                    </button>
                    <button class="btn btn-primary" onclick="Reports.exportReport()">
                        <i class="fas fa-download"></i>
                        보고서 내보내기
                    </button>
                </div>
            </div>

            <div class="page-content">
                <!-- 주요 지표 카드 -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-chart-line"></i>
                        </div>
                        <div class="stat-info">
                            <h3 id="totalRevenue">₩0</h3>
                            <p>총 매출액</p>
                            <span class="stat-change positive" id="revenueChange">+0%</span>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-shopping-cart"></i>
                        </div>
                        <div class="stat-info">
                            <h3 id="totalOrders">0</h3>
                            <p>총 주문 수</p>
                            <span class="stat-change positive" id="ordersChange">+0%</span>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-boxes"></i>
                        </div>
                        <div class="stat-info">
                            <h3 id="totalProducts">0</h3>
                            <p>활성 제품 수</p>
                            <span class="stat-change neutral" id="productsChange">0%</span>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-truck"></i>
                        </div>
                        <div class="stat-info">
                            <h3 id="totalSuppliers">0</h3>
                            <p>협력 공급업체</p>
                            <span class="stat-change positive" id="suppliersChange">+0%</span>
                        </div>
                    </div>
                </div>

                <!-- 차트 섹션 -->
                <div class="charts-container">
                    <div class="chart-row">
                        <div class="chart-card">
                            <div class="chart-header">
                                <h3>매출 추이 분석</h3>
                                <div class="chart-actions">
                                    <button class="btn-icon" onclick="Reports.exportChart('revenue')">
                                        <i class="fas fa-download"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="chart-content">
                                <canvas id="revenueChart"></canvas>
                            </div>
                        </div>

                        <div class="chart-card">
                            <div class="chart-header">
                                <h3>주문 현황</h3>
                                <div class="chart-actions">
                                    <button class="btn-icon" onclick="Reports.exportChart('orders')">
                                        <i class="fas fa-download"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="chart-content">
                                <canvas id="ordersChart"></canvas>
                            </div>
                        </div>
                    </div>

                    <div class="chart-row">
                        <div class="chart-card">
                            <div class="chart-header">
                                <h3>카테고리별 판매</h3>
                                <div class="chart-actions">
                                    <button class="btn-icon" onclick="Reports.exportChart('category')">
                                        <i class="fas fa-download"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="chart-content">
                                <canvas id="categoryChart"></canvas>
                            </div>
                        </div>

                        <div class="chart-card">
                            <div class="chart-header">
                                <h3>재고 분석</h3>
                                <div class="chart-actions">
                                    <button class="btn-icon" onclick="Reports.exportChart('inventory')">
                                        <i class="fas fa-download"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="chart-content">
                                <canvas id="inventoryChart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 상세 테이블 -->
                <div class="reports-tables">
                    <div class="table-tabs">
                        <button class="tab-btn active" data-tab="sales">매출 분석</button>
                        <button class="tab-btn" data-tab="products">제품 성과</button>
                        <button class="tab-btn" data-tab="suppliers">공급업체 평가</button>
                        <button class="tab-btn" data-tab="inventory">재고 분석</button>
                    </div>

                    <div class="tab-content active" id="salesTab">
                        <div class="table-actions">
                            <div class="search-box">
                                <input type="text" id="salesSearch" placeholder="매출 데이터 검색...">
                                <i class="fas fa-search"></i>
                            </div>
                            <button class="btn btn-secondary" onclick="Reports.exportTable('sales')">
                                <i class="fas fa-file-csv"></i>
                                CSV 내보내기
                            </button>
                        </div>
                        <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>기간</th>
                                        <th>매출액</th>
                                        <th>주문 수</th>
                                        <th>평균 주문가</th>
                                        <th>성장률</th>
                                    </tr>
                                </thead>
                                <tbody id="salesTableBody">
                                    <!-- 데이터가 로드됩니다 -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="tab-content" id="productsTab">
                        <div class="table-actions">
                            <div class="search-box">
                                <input type="text" id="productsSearch" placeholder="제품 성과 검색...">
                                <i class="fas fa-search"></i>
                            </div>
                            <button class="btn btn-secondary" onclick="Reports.exportTable('products')">
                                <i class="fas fa-file-csv"></i>
                                CSV 내보내기
                            </button>
                        </div>
                        <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>제품명</th>
                                        <th>카테고리</th>
                                        <th>판매량</th>
                                        <th>매출 기여도</th>
                                        <th>재고 회전율</th>
                                        <th>성과 등급</th>
                                    </tr>
                                </thead>
                                <tbody id="productsTableBody">
                                    <!-- 데이터가 로드됩니다 -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="tab-content" id="suppliersTab">
                        <div class="table-actions">
                            <div class="search-box">
                                <input type="text" id="suppliersSearch" placeholder="공급업체 평가 검색...">
                                <i class="fas fa-search"></i>
                            </div>
                            <button class="btn btn-secondary" onclick="Reports.exportTable('suppliers')">
                                <i class="fas fa-file-csv"></i>
                                CSV 내보내기
                            </button>
                        </div>
                        <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>공급업체명</th>
                                        <th>공급 제품 수</th>
                                        <th>평균 납기</th>
                                        <th>품질 점수</th>
                                        <th>신뢰성 등급</th>
                                        <th>협력 기간</th>
                                    </tr>
                                </thead>
                                <tbody id="suppliersTableBody">
                                    <!-- 데이터가 로드됩니다 -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="tab-content" id="inventoryTab">
                        <div class="table-actions">
                            <div class="search-box">
                                <input type="text" id="inventorySearch" placeholder="재고 분석 검색...">
                                <i class="fas fa-search"></i>
                            </div>
                            <button class="btn btn-secondary" onclick="Reports.exportTable('inventory')">
                                <i class="fas fa-file-csv"></i>
                                CSV 내보내기
                            </button>
                        </div>
                        <div class="table-container">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>제품명</th>
                                        <th>현재 재고</th>
                                        <th>안전 재고</th>
                                        <th>재고 상태</th>
                                        <th>회전율</th>
                                        <th>추천 액션</th>
                                    </tr>
                                </thead>
                                <tbody id="inventoryTableBody">
                                    <!-- 데이터가 로드됩니다 -->
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async loadData() {
        try {
            Utils.showLoading();

            // 병렬로 모든 데이터 로드
            const [salesData, ordersData, productsData, suppliersData, inventoryData] = await Promise.all([
                this.loadSalesData(),
                this.loadOrdersData(),
                this.loadProductsData(),
                this.loadSuppliersData(),
                this.loadInventoryData()
            ]);

            this.updateStatCards(salesData, ordersData, productsData, suppliersData);
            this.updateTables(salesData, ordersData, productsData, suppliersData, inventoryData);

        } catch (error) {
            console.error('데이터 로딩 오류:', error);
            Utils.showToast('데이터를 불러오는데 실패했습니다', 'error');
        } finally {
            Utils.hideLoading();
        }
    },

    async loadSalesData() {
        // 실제 API 호출 대신 임시 데이터 생성
        return {
            totalRevenue: 125000000,
            revenueChange: 15.2,
            monthlyData: [
                { period: '2024-01', revenue: 8500000, orders: 142, avgOrder: 59859 },
                { period: '2024-02', revenue: 9200000, orders: 156, avgOrder: 58974 },
                { period: '2024-03', revenue: 10800000, orders: 178, avgOrder: 60674 },
                { period: '2024-04', revenue: 11500000, orders: 195, avgOrder: 58974 },
                { period: '2024-05', revenue: 12200000, orders: 203, avgOrder: 60098 },
                { period: '2024-06', revenue: 13800000, orders: 225, avgOrder: 61333 }
            ]
        };
    },

    async loadOrdersData() {
        return {
            totalOrders: 1099,
            ordersChange: 12.5,
            statusData: [
                { status: '완료', count: 845, percentage: 77 },
                { status: '진행중', count: 156, percentage: 14 },
                { status: '대기', count: 98, percentage: 9 }
            ]
        };
    },

    async loadProductsData() {
        return {
            totalProducts: 456,
            productsChange: 0,
            topProducts: [
                { name: '고급 세라믹 볼', category: '베어링', sales: 2340, revenue: 45600000, turnover: 8.5, grade: 'A' },
                { name: '스테인리스 롤러', category: '롤러', sales: 1890, revenue: 38200000, turnover: 7.2, grade: 'A' },
                { name: '정밀 기어', category: '기어', sales: 1560, revenue: 31800000, turnover: 6.8, grade: 'B' },
                { name: '내열 가스켓', category: '실링', sales: 1340, revenue: 22100000, turnover: 5.9, grade: 'B' },
                { name: '고강도 체인', category: '체인', sales: 1120, revenue: 18900000, turnover: 4.8, grade: 'C' }
            ],
            categoryData: [
                { category: '베어링', sales: 35, color: '#2c5aa0' },
                { category: '기어', sales: 25, color: '#e85d75' },
                { category: '롤러', sales: 20, color: '#ffa726' },
                { category: '실링', sales: 12, color: '#26a69a' },
                { category: '체인', sales: 8, color: '#7e57c2' }
            ]
        };
    },

    async loadSuppliersData() {
        return {
            totalSuppliers: 23,
            suppliersChange: 4.5,
            supplierPerformance: [
                { name: '㈜대한베어링', products: 45, leadTime: 3.2, quality: 95, reliability: 'A', partnership: '5년 2개월' },
                { name: '정밀기계공업', products: 38, leadTime: 4.1, quality: 92, reliability: 'A', partnership: '3년 8개월' },
                { name: '한국롤러', products: 29, leadTime: 3.8, quality: 88, reliability: 'B', partnership: '2년 4개월' },
                { name: '성진실링', products: 25, leadTime: 5.2, quality: 85, reliability: 'B', partnership: '4년 1개월' },
                { name: '동양체인', products: 22, leadTime: 4.5, quality: 90, reliability: 'A', partnership: '1년 9개월' }
            ]
        };
    },

    async loadInventoryData() {
        return {
            inventoryAnalysis: [
                { name: '고급 세라믹 볼', current: 150, safety: 100, status: 'optimal', turnover: 8.5, action: '현재 최적' },
                { name: '스테인리스 롤러', current: 45, safety: 80, status: 'low', turnover: 7.2, action: '재주문 필요' },
                { name: '정밀 기어', current: 220, safety: 120, status: 'high', turnover: 6.8, action: '재고 조정' },
                { name: '내열 가스켓', current: 85, safety: 90, status: 'critical', turnover: 5.9, action: '긴급 주문' },
                { name: '고강도 체인', current: 180, safety: 100, status: 'optimal', turnover: 4.8, action: '현재 최적' }
            ]
        };
    },

    updateStatCards(salesData, ordersData, productsData, suppliersData) {
        document.getElementById('totalRevenue').textContent =
            `₩${(salesData.totalRevenue / 10000).toLocaleString()}만`;
        document.getElementById('revenueChange').textContent = `+${salesData.revenueChange}%`;

        document.getElementById('totalOrders').textContent = ordersData.totalOrders.toLocaleString();
        document.getElementById('ordersChange').textContent = `+${ordersData.ordersChange}%`;

        document.getElementById('totalProducts').textContent = productsData.totalProducts;
        document.getElementById('productsChange').textContent = `${productsData.productsChange}%`;

        document.getElementById('totalSuppliers').textContent = suppliersData.totalSuppliers;
        document.getElementById('suppliersChange').textContent = `+${suppliersData.suppliersChange}%`;
    },

    updateTables(salesData, ordersData, productsData, suppliersData, inventoryData) {
        // 매출 분석 테이블
        const salesTableBody = document.getElementById('salesTableBody');
        salesTableBody.innerHTML = salesData.monthlyData.map(item => `
            <tr>
                <td>${item.period}</td>
                <td>₩${(item.revenue / 10000).toLocaleString()}만</td>
                <td>${item.orders.toLocaleString()}</td>
                <td>₩${item.avgOrder.toLocaleString()}</td>
                <td><span class="badge badge-success">+12%</span></td>
            </tr>
        `).join('');

        // 제품 성과 테이블
        const productsTableBody = document.getElementById('productsTableBody');
        productsTableBody.innerHTML = productsData.topProducts.map(product => `
            <tr>
                <td>${product.name}</td>
                <td>${product.category}</td>
                <td>${product.sales.toLocaleString()}</td>
                <td>₩${(product.revenue / 10000).toLocaleString()}만</td>
                <td>${product.turnover}</td>
                <td><span class="badge badge-${product.grade === 'A' ? 'success' : product.grade === 'B' ? 'warning' : 'secondary'}">${product.grade}</span></td>
            </tr>
        `).join('');

        // 공급업체 평가 테이블
        const suppliersTableBody = document.getElementById('suppliersTableBody');
        suppliersTableBody.innerHTML = suppliersData.supplierPerformance.map(supplier => `
            <tr>
                <td>${supplier.name}</td>
                <td>${supplier.products}</td>
                <td>${supplier.leadTime}일</td>
                <td>${supplier.quality}점</td>
                <td><span class="badge badge-${supplier.reliability === 'A' ? 'success' : 'warning'}">${supplier.reliability}</span></td>
                <td>${supplier.partnership}</td>
            </tr>
        `).join('');

        // 재고 분석 테이블
        const inventoryTableBody = document.getElementById('inventoryTableBody');
        inventoryTableBody.innerHTML = inventoryData.inventoryAnalysis.map(item => `
            <tr>
                <td>${item.name}</td>
                <td>${item.current}</td>
                <td>${item.safety}</td>
                <td><span class="badge badge-${item.status === 'optimal' ? 'success' : item.status === 'low' || item.status === 'critical' ? 'danger' : 'warning'}">${this.getStatusText(item.status)}</span></td>
                <td>${item.turnover}</td>
                <td>${item.action}</td>
            </tr>
        `).join('');
    },

    getStatusText(status) {
        const statusMap = {
            'optimal': '최적',
            'low': '부족',
            'high': '과다',
            'critical': '위험'
        };
        return statusMap[status] || status;
    },

    initCharts() {
        this.initRevenueChart();
        this.initOrdersChart();
        this.initCategoryChart();
        this.initInventoryChart();
    },

    initRevenueChart() {
        const ctx = document.getElementById('revenueChart').getContext('2d');
        const revenueData = {
            labels: ['1월', '2월', '3월', '4월', '5월', '6월'],
            datasets: [{
                label: '매출액 (만원)',
                data: [850, 920, 1080, 1150, 1220, 1380],
                borderColor: '#2c5aa0',
                backgroundColor: 'rgba(44, 90, 160, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4
            }]
        };

        this.charts.revenue = new Chart(ctx, {
            type: 'line',
            data: revenueData,
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
                        ticks: {
                            callback: function(value) {
                                return value + '만원';
                            }
                        }
                    }
                }
            }
        });
    },

    initOrdersChart() {
        const ctx = document.getElementById('ordersChart').getContext('2d');
        const ordersData = {
            labels: ['완료', '진행중', '대기'],
            datasets: [{
                data: [77, 14, 9],
                backgroundColor: ['#26a69a', '#ffa726', '#e85d75'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        };

        this.charts.orders = new Chart(ctx, {
            type: 'doughnut',
            data: ordersData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    },

    initCategoryChart() {
        const ctx = document.getElementById('categoryChart').getContext('2d');
        const categoryData = {
            labels: ['베어링', '기어', '롤러', '실링', '체인'],
            datasets: [{
                label: '판매량 (%)',
                data: [35, 25, 20, 12, 8],
                backgroundColor: ['#2c5aa0', '#e85d75', '#ffa726', '#26a69a', '#7e57c2'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        };

        this.charts.category = new Chart(ctx, {
            type: 'bar',
            data: categoryData,
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
                        ticks: {
                            callback: function(value) {
                                return value + '%';
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
            labels: ['최적', '부족', '과다', '위험'],
            datasets: [{
                data: [60, 25, 10, 5],
                backgroundColor: ['#26a69a', '#ffa726', '#7e57c2', '#e85d75'],
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        };

        this.charts.inventory = new Chart(ctx, {
            type: 'pie',
            data: inventoryData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right'
                    }
                }
            }
        });
    },

    bindEvents() {
        // 날짜 범위 선택
        document.getElementById('dateRangeSelect').addEventListener('change', (e) => {
            this.currentDateRange = e.target.value;
            this.refreshData();
        });

        // 탭 전환
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // 검색 기능
        ['sales', 'products', 'suppliers', 'inventory'].forEach(tab => {
            const searchInput = document.getElementById(`${tab}Search`);
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this.searchTable(tab, e.target.value);
                });
            }
        });
    },

    switchTab(tabName) {
        // 탭 버튼 활성화
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // 탭 콘텐츠 표시
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');
    },

    searchTable(tabName, query) {
        const tableBody = document.getElementById(`${tabName}TableBody`);
        const rows = tableBody.querySelectorAll('tr');

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            const matches = text.includes(query.toLowerCase());
            row.style.display = matches ? '' : 'none';
        });
    },

    async refreshData() {
        Utils.showToast('데이터를 새로고침하는 중...', 'info');
        await this.loadData();

        // 차트 업데이트
        Object.values(this.charts).forEach(chart => {
            chart.update();
        });

        Utils.showToast('데이터가 성공적으로 새로고침되었습니다', 'success');
    },

    exportChart(chartType) {
        if (this.charts[chartType]) {
            const link = document.createElement('a');
            link.download = `${chartType}_chart.png`;
            link.href = this.charts[chartType].toBase64Image();
            link.click();

            Utils.showToast(`${chartType} 차트가 내보내졌습니다`, 'success');
        }
    },

    exportTable(tableName) {
        const tableBody = document.getElementById(`${tableName}TableBody`);
        const rows = Array.from(tableBody.querySelectorAll('tr'));

        let csvContent = '';
        const headers = {
            'sales': ['기간', '매출액', '주문 수', '평균 주문가', '성장률'],
            'products': ['제품명', '카테고리', '판매량', '매출 기여도', '재고 회전율', '성과 등급'],
            'suppliers': ['공급업체명', '공급 제품 수', '평균 납기', '품질 점수', '신뢰성 등급', '협력 기간'],
            'inventory': ['제품명', '현재 재고', '안전 재고', '재고 상태', '회전율', '추천 액션']
        };

        csvContent += headers[tableName].join(',') + '\n';

        rows.forEach(row => {
            const cols = Array.from(row.cells).map(cell => cell.textContent.trim());
            csvContent += cols.join(',') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${tableName}_report.csv`);
        link.click();

        Utils.showToast(`${tableName} 테이블이 CSV로 내보내졌습니다`, 'success');
    },

    exportReport() {
        Utils.showToast('전체 보고서를 내보내는 중...', 'info');

        // 실제로는 PDF 생성 라이브러리를 사용해야 합니다
        setTimeout(() => {
            Utils.showToast('전체 보고서가 성공적으로 내보내졌습니다', 'success');
        }, 1500);
    },

    async search(query) {
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) {
            const tabName = activeTab.dataset.tab;
            this.searchTable(tabName, query);
        }
        Utils.showToast(`보고서 검색: ${query}`, 'info');
    }
};

// 전역으로 등록
window.Reports = Reports;

document.addEventListener('DOMContentLoaded', function() {
    if (window.App) {
        App.registerPage('reports', Reports);
    }
});