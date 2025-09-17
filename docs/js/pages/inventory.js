// 재고 관리 페이지 모듈
const Inventory = {
    // 현재 데이터
    currentData: [],
    currentPage: 1,
    totalPages: 1,
    pageSize: 15,
    sortColumn: 'updated_at',
    sortDirection: 'desc',

    // 초기화
    async init() {
        const contentContainer = document.querySelector('.content-container');
        contentContainer.innerHTML = this.getTemplate();

        // 통계 데이터 로드
        await this.loadStatistics();

        // 데이터 로드
        await this.loadInventory();

        // 이벤트 리스너 설정
        this.setupEventListeners();
    },

    // 템플릿 반환
    getTemplate() {
        return `
            <div class="page-header">
                <div>
                    <h1 class="dashboard-title">재고 관리</h1>
                    <p class="dashboard-subtitle">실시간 재고 현황을 모니터링하고 관리합니다</p>
                </div>
                <div class="page-actions">
                    <button class="btn btn-secondary" onclick="Inventory.exportData()">
                        <i class="fas fa-download"></i> 재고 현황 내보내기
                    </button>
                    <button class="btn btn-primary" onclick="Inventory.showAdjustmentModal()">
                        <i class="fas fa-adjust"></i> 재고 조정
                    </button>
                </div>
            </div>

            <!-- 재고 통계 카드 -->
            <div class="stats-grid" style="margin-bottom: 2rem;">
                <div class="stat-card inventory">
                    <div class="stat-header">
                        <div class="stat-title">총 재고 품목</div>
                        <div class="stat-icon">
                            <i class="fas fa-cubes"></i>
                        </div>
                    </div>
                    <div class="stat-value" id="totalItems">-</div>
                    <div class="stat-change neutral">
                        <i class="fas fa-equals"></i>
                        <span>전체 관리 품목</span>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-title">재고 부족</div>
                        <div class="stat-icon" style="background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%);">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                    </div>
                    <div class="stat-value" id="lowStockItems">-</div>
                    <div class="stat-change negative">
                        <i class="fas fa-arrow-down"></i>
                        <span id="lowStockPercentage">긴급 처리 필요</span>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-title">총 재고 가치</div>
                        <div class="stat-icon" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%);">
                            <i class="fas fa-won-sign"></i>
                        </div>
                    </div>
                    <div class="stat-value" id="totalValue">-</div>
                    <div class="stat-change positive">
                        <i class="fas fa-arrow-up"></i>
                        <span>원</span>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-title">이동 예약</div>
                        <div class="stat-icon" style="background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%);">
                            <i class="fas fa-truck-loading"></i>
                        </div>
                    </div>
                    <div class="stat-value" id="reservedItems">-</div>
                    <div class="stat-change neutral">
                        <i class="fas fa-clock"></i>
                        <span>대기 중</span>
                    </div>
                </div>
            </div>

            <!-- 빠른 액션 -->
            <div class="quick-actions-grid" style="margin-bottom: 2rem;">
                <div class="quick-action-card" onclick="Inventory.showLowStockItems()">
                    <div class="quick-action-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="quick-action-content">
                        <h3>재고 부족 알림</h3>
                        <p>안전 재고 미만인 제품들을 확인하세요</p>
                    </div>
                    <div class="quick-action-arrow">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>

                <div class="quick-action-card" onclick="Inventory.showStockMovements()">
                    <div class="quick-action-icon">
                        <i class="fas fa-exchange-alt"></i>
                    </div>
                    <div class="quick-action-content">
                        <h3>재고 이동 기록</h3>
                        <p>최근 재고 입출고 내역을 조회하세요</p>
                    </div>
                    <div class="quick-action-arrow">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>

                <div class="quick-action-card" onclick="Inventory.showLocationManagement()">
                    <div class="quick-action-icon">
                        <i class="fas fa-map-marker-alt"></i>
                    </div>
                    <div class="quick-action-content">
                        <h3>위치 관리</h3>
                        <p>창고별 재고 위치를 관리하세요</p>
                    </div>
                    <div class="quick-action-arrow">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h2>재고 현황</h2>
                    <div class="card-header-actions">
                        <div class="search-container">
                            <div class="search-box">
                                <i class="fas fa-search"></i>
                                <input type="text" id="inventorySearch" placeholder="제품명, 제품코드로 검색...">
                                <button type="button" class="clear-search" onclick="Inventory.clearSearch()">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                        <div class="filter-container">
                            <select id="locationFilter" class="filter-select">
                                <option value="">전체 위치</option>
                                <option value="warehouse_a">창고 A</option>
                                <option value="warehouse_b">창고 B</option>
                                <option value="warehouse_c">창고 C</option>
                            </select>
                            <select id="statusFilter" class="filter-select">
                                <option value="">전체 상태</option>
                                <option value="normal">정상</option>
                                <option value="low">재고 부족</option>
                                <option value="out">품절</option>
                                <option value="overstocked">과재고</option>
                            </select>
                            <select id="categoryFilter" class="filter-select">
                                <option value="">전체 카테고리</option>
                                <option value="1">일반의약품</option>
                                <option value="2">건강기능식품</option>
                                <option value="3">의료기기</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table" id="inventoryTable">
                            <thead>
                                <tr>
                                    <th class="sortable" onclick="Inventory.sortTable('product_name')">
                                        <span>제품 정보</span>
                                        <i class="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th class="sortable" onclick="Inventory.sortTable('location')">
                                        <span>위치</span>
                                        <i class="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th class="sortable" onclick="Inventory.sortTable('quantity')">
                                        <span>현재 재고</span>
                                        <i class="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th class="sortable" onclick="Inventory.sortTable('reserved_quantity')">
                                        <span>예약 재고</span>
                                        <i class="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th>재고 상태</th>
                                    <th class="sortable" onclick="Inventory.sortTable('updated_at')">
                                        <span>최종 업데이트</span>
                                        <i class="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th style="width: 140px;">작업</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td colspan="7" class="text-center py-4">
                                        <div class="loading-spinner">
                                            <i class="fas fa-spinner fa-spin"></i>
                                            <span>재고 데이터를 불러오는 중...</span>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div class="table-footer">
                        <div class="table-info">
                            <span id="paginationInfo" class="text-muted">-</span>
                        </div>
                        <div class="pagination-container">
                            <div class="pagination" id="pagination">
                                <!-- 페이지네이션이 여기에 생성됩니다 -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // 이벤트 리스너 설정
    setupEventListeners() {
        // 검색 입력 필드
        const searchInput = document.getElementById('inventorySearch');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce(() => {
                this.searchInventory();
            }, 300));
        }

        // 필터 변경
        const locationFilter = document.getElementById('locationFilter');
        const statusFilter = document.getElementById('statusFilter');
        const categoryFilter = document.getElementById('categoryFilter');

        if (locationFilter) {
            locationFilter.addEventListener('change', () => this.loadInventory());
        }

        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.loadInventory());
        }

        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => this.loadInventory());
        }
    },

    // 재고 목록 로드
    async loadInventory(page = 1) {
        try {
            const searchQuery = document.getElementById('inventorySearch')?.value || '';
            const locationFilter = document.getElementById('locationFilter')?.value || '';
            const statusFilter = document.getElementById('statusFilter')?.value || '';
            const categoryFilter = document.getElementById('categoryFilter')?.value || '';

            const params = {
                page,
                limit: this.pageSize,
                search: searchQuery,
                location: locationFilter,
                status: statusFilter,
                category: categoryFilter,
                sort: this.sortColumn,
                order: this.sortDirection
            };

            const response = await API.inventory.getAll(params);

            if (response.success) {
                this.currentData = response.data.inventory || [];
                this.currentPage = response.data.pagination?.current_page || 1;
                this.totalPages = response.data.pagination?.total_pages || 1;

                this.renderTable();
                this.updatePagination();
            } else {
                Utils.showToast(response.error || '재고 정보를 불러올 수 없습니다.', 'error');
                this.renderEmptyTable();
            }
        } catch (error) {
            console.error('재고 로드 오류:', error);
            Utils.showToast('재고 정보를 불러오는 중 오류가 발생했습니다.', 'error');
            this.renderEmptyTable();
        }
    },

    // 테이블 렌더링
    renderTable() {
        const tbody = document.querySelector('#inventoryTable tbody');
        if (!tbody) return;

        if (this.currentData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5">
                        <div class="empty-state">
                            <i class="fas fa-boxes fa-3x text-muted mb-3"></i>
                            <h3 class="text-muted">재고 정보가 없습니다</h3>
                            <p class="text-muted">검색 조건을 변경하거나 새로운 재고를 추가해보세요.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.currentData.map(item => {
            const stockStatus = this.getStockStatus(item);
            const availableStock = (item.quantity || 0) - (item.reserved_quantity || 0);

            return `
                <tr class="inventory-row" data-item-id="${item.id}">
                    <td>
                        <div class="product-info-cell">
                            <div class="product-avatar">
                                <i class="fas fa-box"></i>
                            </div>
                            <div class="product-details">
                                <div class="product-name">${item.product_name || '-'}</div>
                                <div class="product-code text-muted">${item.product_code || '-'}</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="location-info">
                            <div class="location-primary">
                                <i class="fas fa-map-marker-alt text-muted me-1"></i>
                                ${this.getLocationName(item.location) || '-'}
                            </div>
                            ${item.shelf ? `<div class="location-detail text-muted">선반: ${item.shelf}</div>` : ''}
                        </div>
                    </td>
                    <td>
                        <div class="stock-quantity">
                            <div class="quantity-main">${(item.quantity || 0).toLocaleString()}</div>
                            <div class="quantity-unit text-muted">${item.unit || 'EA'}</div>
                        </div>
                    </td>
                    <td>
                        <div class="reserved-quantity">
                            <div class="quantity-main">${(item.reserved_quantity || 0).toLocaleString()}</div>
                            <div class="available-stock text-muted">
                                가용: ${availableStock.toLocaleString()}
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="stock-status-badge ${stockStatus.class}">
                            <i class="${stockStatus.icon}"></i>
                            ${stockStatus.text}
                        </span>
                        ${stockStatus.critical ? '<div class="status-alert">긴급</div>' : ''}
                    </td>
                    <td>
                        <span class="text-muted">${Utils.formatDate(item.updated_at, 'MM-DD HH:mm')}</span>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-outline" onclick="Inventory.showDetailModal(${item.id})" title="상세보기">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-sm btn-outline" onclick="Inventory.showAdjustmentModal(${item.id})" title="재고 조정">
                                <i class="fas fa-adjust"></i>
                            </button>
                            <button class="btn btn-sm btn-outline" onclick="Inventory.showMovementHistory(${item.id})" title="이동 기록">
                                <i class="fas fa-history"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    // 재고 상태 계산
    getStockStatus(item) {
        const currentStock = item.quantity || 0;
        const minLevel = item.min_stock_level || 0;
        const maxLevel = item.max_stock_level || 1000;

        if (currentStock === 0) {
            return {
                class: 'status-out-of-stock',
                icon: 'fas fa-times-circle',
                text: '품절',
                critical: true
            };
        }

        if (currentStock < minLevel) {
            return {
                class: 'status-low-stock',
                icon: 'fas fa-exclamation-triangle',
                text: '재고 부족',
                critical: true
            };
        }

        if (currentStock > maxLevel) {
            return {
                class: 'status-overstock',
                icon: 'fas fa-arrow-up',
                text: '과재고',
                critical: false
            };
        }

        return {
            class: 'status-normal',
            icon: 'fas fa-check-circle',
            text: '정상',
            critical: false
        };
    },

    // 위치명 변환
    getLocationName(location) {
        const locationMap = {
            'warehouse_a': '창고 A',
            'warehouse_b': '창고 B',
            'warehouse_c': '창고 C',
            'production': '생산실',
            'quality': '품질검사실'
        };
        return locationMap[location] || location;
    },

    // 빈 테이블 렌더링
    renderEmptyTable() {
        const tbody = document.querySelector('#inventoryTable tbody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5">
                        <div class="empty-state">
                            <i class="fas fa-exclamation-triangle fa-3x text-muted mb-3"></i>
                            <h3 class="text-muted">데이터를 불러올 수 없습니다</h3>
                            <p class="text-muted">잠시 후 다시 시도해주세요.</p>
                        </div>
                    </td>
                </tr>
            `;
        }
    },

    // 페이지네이션 업데이트
    updatePagination() {
        const paginationInfo = document.getElementById('paginationInfo');
        const paginationContainer = document.getElementById('pagination');

        if (paginationInfo) {
            const start = (this.currentPage - 1) * this.pageSize + 1;
            const end = Math.min(this.currentPage * this.pageSize, this.currentData.length);
            const total = this.currentData.length;
            paginationInfo.textContent = `${start}-${end} / 총 ${total}개`;
        }

        if (paginationContainer) {
            Utils.createPagination(paginationContainer, this.totalPages, this.currentPage, (page) => {
                this.loadInventory(page);
            });
        }
    },

    // 검색
    async searchInventory() {
        await this.loadInventory(1);
    },

    // 검색 기능 (전역 검색에서 호출)
    async search(query) {
        const searchInput = document.getElementById('inventorySearch');
        if (searchInput) {
            searchInput.value = query;
            await this.searchInventory();
        }
    },

    // 테이블 정렬
    sortTable(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'asc';
        }

        // 정렬 아이콘 업데이트
        this.updateSortIcons();

        // 데이터 다시 로드
        this.loadInventory(this.currentPage);
    },

    // 정렬 아이콘 업데이트
    updateSortIcons() {
        document.querySelectorAll('.sort-icon').forEach(icon => {
            icon.className = 'fas fa-sort sort-icon';
        });

        const activeHeader = document.querySelector(`[onclick="Inventory.sortTable('${this.sortColumn}')"] .sort-icon`);
        if (activeHeader) {
            activeHeader.className = `fas fa-sort-${this.sortDirection === 'asc' ? 'up' : 'down'} sort-icon`;
        }
    },

    // 검색 클리어
    clearSearch() {
        const searchInput = document.getElementById('inventorySearch');
        if (searchInput) {
            searchInput.value = '';
            this.loadInventory(1);
        }
    },

    // 통계 데이터 로드
    async loadStatistics() {
        try {
            const response = await API.inventory.getAll({ stats: true });

            if (response.success) {
                const stats = response.data.statistics || {};

                // 총 품목 수
                const totalElement = document.getElementById('totalItems');
                if (totalElement) {
                    totalElement.textContent = (stats.total_items || 0).toLocaleString();
                }

                // 재고 부족 품목
                const lowStockElement = document.getElementById('lowStockItems');
                const lowStockPercentageElement = document.getElementById('lowStockPercentage');
                if (lowStockElement && lowStockPercentageElement) {
                    const lowStockCount = stats.low_stock_count || 0;
                    const total = stats.total_items || 0;
                    const percentage = total > 0 ? Math.round((lowStockCount / total) * 100) : 0;

                    lowStockElement.textContent = lowStockCount.toLocaleString();
                    lowStockPercentageElement.textContent = `${percentage}% 주의필요`;
                }

                // 총 재고 가치
                const totalValueElement = document.getElementById('totalValue');
                if (totalValueElement) {
                    const value = stats.total_value || 0;
                    totalValueElement.textContent = `${Math.round(value / 10000).toLocaleString()}만`;
                }

                // 예약 재고
                const reservedElement = document.getElementById('reservedItems');
                if (reservedElement) {
                    reservedElement.textContent = (stats.reserved_items || 0).toLocaleString();
                }
            }
        } catch (error) {
            console.error('통계 로드 오류:', error);
        }
    },

    // 재고 조정 모달
    async showAdjustmentModal(itemId = null) {
        let selectedItem = null;

        if (itemId) {
            // 특정 품목에 대한 조정
            selectedItem = this.currentData.find(item => item.id === itemId);
            if (!selectedItem) {
                Utils.showToast('품목을 찾을 수 없습니다.', 'error');
                return;
            }
        }

        const content = `
            <form id="adjustmentForm">
                <div class="form-grid">
                    ${!selectedItem ? `
                        <div class="form-group form-col-full">
                            <label for="productSelect">제품 선택 *</label>
                            <select id="productSelect" name="product_id" required>
                                <option value="">제품을 선택하세요</option>
                            </select>
                        </div>
                    ` : `
                        <input type="hidden" name="product_id" value="${selectedItem.product_id}">
                        <div class="form-group form-col-full">
                            <label>제품</label>
                            <div class="selected-product">
                                <strong>${selectedItem.product_name}</strong>
                                <span class="text-muted">(${selectedItem.product_code})</span>
                            </div>
                        </div>
                    `}

                    <div class="form-group">
                        <label for="adjustmentType">조정 유형 *</label>
                        <select id="adjustmentType" name="adjustment_type" required>
                            <option value="">선택하세요</option>
                            <option value="increase">재고 증가</option>
                            <option value="decrease">재고 감소</option>
                            <option value="set">재고 설정</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="quantity">수량 *</label>
                        <input type="number" id="quantity" name="quantity" min="0" step="1" required>
                        ${selectedItem ? `<small class="form-text">현재 재고: ${selectedItem.quantity || 0} ${selectedItem.unit || 'EA'}</small>` : ''}
                    </div>

                    <div class="form-group">
                        <label for="location">위치</label>
                        <select id="location" name="location">
                            <option value="warehouse_a">창고 A</option>
                            <option value="warehouse_b">창고 B</option>
                            <option value="warehouse_c">창고 C</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="reason">사유 *</label>
                        <select id="reason" name="reason" required>
                            <option value="">선택하세요</option>
                            <option value="purchase">구매 입고</option>
                            <option value="production">생산 입고</option>
                            <option value="return">반품 입고</option>
                            <option value="sale">판매 출고</option>
                            <option value="damage">손상/폐기</option>
                            <option value="transfer">재고 이동</option>
                            <option value="correction">재고 정정</option>
                            <option value="other">기타</option>
                        </select>
                    </div>

                    <div class="form-group form-col-full">
                        <label for="notes">비고</label>
                        <textarea id="notes" name="notes" rows="3" placeholder="조정 사유나 추가 설명을 입력하세요"></textarea>
                    </div>
                </div>
            </form>
        `;

        Utils.openModal('재고 조정', content, {
            size: 'medium',
            footerContent: `
                <button class="btn btn-secondary" onclick="Utils.closeModal()">취소</button>
                <button class="btn btn-primary" onclick="Inventory.processAdjustment()">조정 실행</button>
            `
        });

        // 제품 목록 로드 (전체 조정일 경우)
        if (!selectedItem) {
            await this.loadProductsForSelection();
        }
    },

    // 제품 선택 목록 로드
    async loadProductsForSelection() {
        try {
            const response = await API.products.getAll({ limit: 1000 });

            if (response.success) {
                const products = response.data.products || [];
                const select = document.getElementById('productSelect');

                if (select) {
                    select.innerHTML = '<option value="">제품을 선택하세요</option>' +
                        products.map(product =>
                            `<option value="${product.id}">${product.name} (${product.product_code})</option>`
                        ).join('');
                }
            }
        } catch (error) {
            console.error('제품 목록 로드 오류:', error);
        }
    },

    // 재고 조정 처리
    async processAdjustment() {
        const form = document.getElementById('adjustmentForm');
        if (!form) return;

        const formData = new FormData(form);
        const adjustmentData = Object.fromEntries(formData.entries());

        // 폼 검증
        if (!adjustmentData.product_id || !adjustmentData.adjustment_type ||
            !adjustmentData.quantity || !adjustmentData.reason) {
            Utils.showToast('모든 필수 필드를 입력해주세요.', 'warning');
            return;
        }

        try {
            Utils.showLoading('재고 조정 중...');

            const response = await API.inventory.adjustStock(adjustmentData);

            Utils.hideLoading();

            if (response.success) {
                Utils.closeModal();
                Utils.showToast('재고가 성공적으로 조정되었습니다.', 'success');

                // 데이터 새로고침
                await this.loadStatistics();
                await this.loadInventory(this.currentPage);
            } else {
                Utils.showToast(response.error || '재고 조정에 실패했습니다.', 'error');
            }
        } catch (error) {
            Utils.hideLoading();
            Utils.showToast('재고 조정 중 오류가 발생했습니다.', 'error');
        }
    },

    // 상세 정보 모달
    async showDetailModal(id) {
        const item = this.currentData.find(item => item.id === id);
        if (!item) {
            Utils.showToast('재고 정보를 찾을 수 없습니다.', 'error');
            return;
        }

        const stockStatus = this.getStockStatus(item);
        const availableStock = (item.quantity || 0) - (item.reserved_quantity || 0);

        const content = `
            <div class="inventory-detail-container">
                <div class="inventory-header">
                    <div class="inventory-avatar-large">
                        <i class="fas fa-box"></i>
                    </div>
                    <div class="inventory-title">
                        <h2>${item.product_name || '-'}</h2>
                        <p class="product-code">${item.product_code || '-'}</p>
                    </div>
                    <div class="inventory-status">
                        <span class="stock-status-badge ${stockStatus.class}">
                            <i class="${stockStatus.icon}"></i>
                            ${stockStatus.text}
                        </span>
                    </div>
                </div>

                <div class="detail-tabs">
                    <div class="tab-headers">
                        <button class="tab-header active" onclick="Inventory.switchTab(event, 'stock')">재고 현황</button>
                        <button class="tab-header" onclick="Inventory.switchTab(event, 'location')">위치 정보</button>
                        <button class="tab-header" onclick="Inventory.switchTab(event, 'history')">이동 기록</button>
                    </div>

                    <div class="tab-content active" id="stock">
                        <div class="stock-overview-grid">
                            <div class="stock-card">
                                <div class="stock-card-header">
                                    <i class="fas fa-cubes"></i>
                                    <span>현재 재고</span>
                                </div>
                                <div class="stock-card-value">${(item.quantity || 0).toLocaleString()}</div>
                                <div class="stock-card-unit">${item.unit || 'EA'}</div>
                            </div>
                            <div class="stock-card">
                                <div class="stock-card-header">
                                    <i class="fas fa-lock"></i>
                                    <span>예약 재고</span>
                                </div>
                                <div class="stock-card-value">${(item.reserved_quantity || 0).toLocaleString()}</div>
                                <div class="stock-card-unit">${item.unit || 'EA'}</div>
                            </div>
                            <div class="stock-card">
                                <div class="stock-card-header">
                                    <i class="fas fa-check"></i>
                                    <span>가용 재고</span>
                                </div>
                                <div class="stock-card-value">${availableStock.toLocaleString()}</div>
                                <div class="stock-card-unit">${item.unit || 'EA'}</div>
                            </div>
                        </div>

                        <div class="stock-levels">
                            <div class="level-item">
                                <label>최소 재고 수준</label>
                                <div class="level-value">${(item.min_stock_level || 0).toLocaleString()} ${item.unit || 'EA'}</div>
                                <div class="level-bar">
                                    <div class="level-progress" style="width: ${Math.min((item.quantity || 0) / (item.min_stock_level || 1) * 100, 100)}%"></div>
                                </div>
                            </div>
                            <div class="level-item">
                                <label>최대 재고 수준</label>
                                <div class="level-value">${(item.max_stock_level || 0).toLocaleString()} ${item.unit || 'EA'}</div>
                                <div class="level-bar">
                                    <div class="level-progress" style="width: ${Math.min((item.quantity || 0) / (item.max_stock_level || 1) * 100, 100)}%"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="tab-content" id="location">
                        <div class="location-details">
                            <div class="detail-grid">
                                <div class="detail-group">
                                    <label><i class="fas fa-warehouse"></i> 창고</label>
                                    <div class="detail-value">${this.getLocationName(item.location) || '-'}</div>
                                </div>
                                <div class="detail-group">
                                    <label><i class="fas fa-layer-group"></i> 선반</label>
                                    <div class="detail-value">${item.shelf || '-'}</div>
                                </div>
                                <div class="detail-group">
                                    <label><i class="fas fa-thermometer-half"></i> 보관 조건</label>
                                    <div class="detail-value">${item.storage_conditions || '상온 보관'}</div>
                                </div>
                                <div class="detail-group">
                                    <label><i class="fas fa-clock"></i> 마지막 업데이트</label>
                                    <div class="detail-value">${Utils.formatDate(item.updated_at, 'YYYY-MM-DD HH:mm')}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="tab-content" id="history">
                        <div class="history-placeholder">
                            <i class="fas fa-history fa-2x text-muted"></i>
                            <p class="text-muted">이동 기록을 로드하는 중...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        Utils.openModal('재고 상세 정보', content, {
            size: 'large',
            footerContent: `
                <button class="btn btn-secondary" onclick="Utils.closeModal()">닫기</button>
                <button class="btn btn-primary" onclick="Inventory.showAdjustmentModal(${item.id}); Utils.closeModal();">재고 조정</button>
            `
        });

        // 이동 기록 로드
        setTimeout(() => {
            this.loadMovementHistory(id);
        }, 500);
    },

    // 탭 전환
    switchTab(event, tabId) {
        // 모든 탭 헤더에서 active 제거
        document.querySelectorAll('.tab-header').forEach(header => {
            header.classList.remove('active');
        });

        // 모든 탭 컨텐츠에서 active 제거
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // 클릭된 탭 헤더에 active 추가
        event.target.classList.add('active');

        // 해당 탭 컨텐츠에 active 추가
        document.getElementById(tabId).classList.add('active');
    },

    // 이동 기록 로드
    async loadMovementHistory(itemId) {
        try {
            const response = await API.inventory.getMovements(itemId, { limit: 20 });

            if (response.success) {
                const movements = response.data.movements || [];
                const historyContainer = document.getElementById('history');

                if (historyContainer) {
                    if (movements.length === 0) {
                        historyContainer.innerHTML = `
                            <div class="history-empty">
                                <i class="fas fa-inbox fa-2x text-muted"></i>
                                <p class="text-muted">이동 기록이 없습니다</p>
                            </div>
                        `;
                    } else {
                        historyContainer.innerHTML = `
                            <div class="movement-list">
                                ${movements.map(movement => `
                                    <div class="movement-item">
                                        <div class="movement-icon ${movement.type === 'in' ? 'in' : 'out'}">
                                            <i class="fas fa-${movement.type === 'in' ? 'arrow-down' : 'arrow-up'}"></i>
                                        </div>
                                        <div class="movement-details">
                                            <div class="movement-description">
                                                ${movement.description || '-'}
                                            </div>
                                            <div class="movement-meta">
                                                <span class="movement-quantity ${movement.type === 'in' ? 'positive' : 'negative'}">
                                                    ${movement.type === 'in' ? '+' : '-'}${Math.abs(movement.quantity || 0).toLocaleString()}
                                                </span>
                                                <span class="movement-time">${Utils.formatDate(movement.created_at, 'MM-DD HH:mm')}</span>
                                                <span class="movement-user">${movement.user_name || '시스템'}</span>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        `;
                    }
                }
            }
        } catch (error) {
            console.error('이동 기록 로드 오류:', error);
            const historyContainer = document.getElementById('history');
            if (historyContainer) {
                historyContainer.innerHTML = `
                    <div class="history-error">
                        <i class="fas fa-exclamation-triangle fa-2x text-muted"></i>
                        <p class="text-muted">이동 기록을 불러올 수 없습니다</p>
                    </div>
                `;
            }
        }
    },

    // 재고 부족 품목 표시
    showLowStockItems() {
        // 현재 데이터에서 재고 부족 품목만 필터링
        const lowStockItems = this.currentData.filter(item => {
            const currentStock = item.quantity || 0;
            const minLevel = item.min_stock_level || 0;
            return currentStock <= minLevel;
        });

        if (lowStockItems.length === 0) {
            Utils.showToast('현재 재고 부족 품목이 없습니다.', 'info');
            return;
        }

        // 상태 필터를 재고 부족으로 설정하고 검색
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.value = 'low';
            this.loadInventory(1);
        }

        Utils.showToast(`${lowStockItems.length}개의 재고 부족 품목이 있습니다.`, 'warning');
    },

    // 재고 이동 기록 표시
    showStockMovements() {
        Utils.showToast('재고 이동 기록 기능은 곧 추가될 예정입니다.', 'info');
    },

    // 위치 관리 표시
    showLocationManagement() {
        Utils.showToast('위치 관리 기능은 곧 추가될 예정입니다.', 'info');
    },

    // 이동 기록 표시
    showMovementHistory(id) {
        this.showDetailModal(id);
        // 모달이 열린 후 기록 탭으로 전환
        setTimeout(() => {
            const historyTab = document.querySelector('[onclick="Inventory.switchTab(event, \'history\')"]');
            if (historyTab) {
                historyTab.click();
            }
        }, 100);
    },

    // 데이터 내보내기
    async exportData() {
        try {
            Utils.showLoading('재고 현황 내보내는 중...');

            const response = await API.inventory.getAll({ export: true });

            if (response.success) {
                const data = response.data.inventory || [];
                Utils.exportToCSV(data, 'inventory', [
                    { key: 'product_name', label: '제품명' },
                    { key: 'product_code', label: '제품코드' },
                    { key: 'location', label: '위치', format: (value) => this.getLocationName(value) },
                    { key: 'quantity', label: '현재재고' },
                    { key: 'reserved_quantity', label: '예약재고' },
                    { key: 'unit', label: '단위' },
                    { key: 'min_stock_level', label: '최소재고' },
                    { key: 'max_stock_level', label: '최대재고' },
                    { key: 'updated_at', label: '최종업데이트', format: (value) => Utils.formatDate(value, 'YYYY-MM-DD HH:mm') }
                ]);
                Utils.showToast('재고 현황이 성공적으로 내보내졌습니다.', 'success');
            } else {
                Utils.showToast(response.error || '데이터 내보내기에 실패했습니다.', 'error');
            }

            Utils.hideLoading();
        } catch (error) {
            Utils.hideLoading();
            Utils.showToast('데이터 내보내기 중 오류가 발생했습니다.', 'error');
        }
    }
};

// 전역으로 등록
window.Inventory = Inventory;

// 페이지 모듈 등록
document.addEventListener('DOMContentLoaded', function() {
    if (window.App) {
        App.registerPage('inventory', Inventory);
    }
});