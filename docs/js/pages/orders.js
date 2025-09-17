// 구매 주문 관리 페이지 모듈
const Orders = {
    // 현재 데이터
    currentData: [],
    currentPage: 1,
    totalPages: 1,
    pageSize: 10,
    sortColumn: 'created_at',
    sortDirection: 'desc',

    // 초기화
    async init() {
        const contentContainer = document.querySelector('.content-container');
        contentContainer.innerHTML = this.getTemplate();

        // 통계 데이터 로드
        await this.loadStatistics();

        // 데이터 로드
        await this.loadOrders();

        // 이벤트 리스너 설정
        this.setupEventListeners();
    },

    // 템플릿 반환
    getTemplate() {
        return `
            <div class="page-header">
                <div>
                    <h1 class="dashboard-title">구매 주문 관리</h1>
                    <p class="dashboard-subtitle">공급업체로부터의 구매 주문을 효율적으로 관리합니다</p>
                </div>
                <div class="page-actions">
                    <button class="btn btn-secondary" onclick="Orders.exportData()">
                        <i class="fas fa-download"></i> 주문 내역 내보내기
                    </button>
                    <button class="btn btn-primary" onclick="Orders.showCreateModal()">
                        <i class="fas fa-plus"></i> 새 주문 생성
                    </button>
                </div>
            </div>

            <!-- 주문 통계 카드 -->
            <div class="stats-grid" style="margin-bottom: 2rem;">
                <div class="stat-card orders">
                    <div class="stat-header">
                        <div class="stat-title">전체 주문</div>
                        <div class="stat-icon">
                            <i class="fas fa-shopping-cart"></i>
                        </div>
                    </div>
                    <div class="stat-value" id="totalOrders">-</div>
                    <div class="stat-change neutral">
                        <i class="fas fa-equals"></i>
                        <span>총 주문 건수</span>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-title">승인 대기</div>
                        <div class="stat-icon" style="background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%);">
                            <i class="fas fa-clock"></i>
                        </div>
                    </div>
                    <div class="stat-value" id="pendingOrders">-</div>
                    <div class="stat-change neutral">
                        <i class="fas fa-hourglass-half"></i>
                        <span>검토 필요</span>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-title">이번 달 주문액</div>
                        <div class="stat-icon" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%);">
                            <i class="fas fa-won-sign"></i>
                        </div>
                    </div>
                    <div class="stat-value" id="monthlyAmount">-</div>
                    <div class="stat-change positive">
                        <i class="fas fa-arrow-up"></i>
                        <span>만원</span>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-title">배송 중</div>
                        <div class="stat-icon" style="background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%);">
                            <i class="fas fa-truck"></i>
                        </div>
                    </div>
                    <div class="stat-value" id="shippingOrders">-</div>
                    <div class="stat-change neutral">
                        <i class="fas fa-shipping-fast"></i>
                        <span>배송 진행</span>
                    </div>
                </div>
            </div>

            <!-- 빠른 액션 -->
            <div class="quick-actions-grid" style="margin-bottom: 2rem;">
                <div class="quick-action-card" onclick="Orders.showPendingOrders()">
                    <div class="quick-action-icon" style="background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%);">
                        <i class="fas fa-exclamation-circle"></i>
                    </div>
                    <div class="quick-action-content">
                        <h3>승인 대기 주문</h3>
                        <p>승인이 필요한 주문들을 확인하고 처리하세요</p>
                    </div>
                    <div class="quick-action-arrow">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>

                <div class="quick-action-card" onclick="Orders.showUrgentOrders()">
                    <div class="quick-action-icon" style="background: linear-gradient(135deg, #dc3545 0%, #fd7e14 100%);">
                        <i class="fas fa-bolt"></i>
                    </div>
                    <div class="quick-action-content">
                        <h3>긴급 주문</h3>
                        <p>재고 부족으로 인한 긴급 주문을 확인하세요</p>
                    </div>
                    <div class="quick-action-arrow">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>

                <div class="quick-action-card" onclick="Orders.showRecentOrders()">
                    <div class="quick-action-icon" style="background: linear-gradient(135deg, #17a2b8 0%, #20c997 100%);">
                        <i class="fas fa-history"></i>
                    </div>
                    <div class="quick-action-content">
                        <h3>최근 주문 현황</h3>
                        <p>최근 생성되고 처리된 주문들을 확인하세요</p>
                    </div>
                    <div class="quick-action-arrow">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h2>주문 목록</h2>
                    <div class="card-header-actions">
                        <div class="search-container">
                            <div class="search-box">
                                <i class="fas fa-search"></i>
                                <input type="text" id="orderSearch" placeholder="주문번호, 공급업체명으로 검색...">
                                <button type="button" class="clear-search" onclick="Orders.clearSearch()">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                        <div class="filter-container">
                            <select id="statusFilter" class="filter-select">
                                <option value="">전체 상태</option>
                                <option value="pending">승인 대기</option>
                                <option value="approved">승인됨</option>
                                <option value="shipped">배송 중</option>
                                <option value="delivered">배송 완료</option>
                                <option value="cancelled">취소</option>
                            </select>
                            <select id="supplierFilter" class="filter-select">
                                <option value="">전체 공급업체</option>
                            </select>
                            <select id="priorityFilter" class="filter-select">
                                <option value="">전체 우선순위</option>
                                <option value="urgent">긴급</option>
                                <option value="high">높음</option>
                                <option value="normal">보통</option>
                                <option value="low">낮음</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table" id="ordersTable">
                            <thead>
                                <tr>
                                    <th class="sortable" onclick="Orders.sortTable('order_number')">
                                        <span>주문 정보</span>
                                        <i class="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th class="sortable" onclick="Orders.sortTable('supplier_name')">
                                        <span>공급업체</span>
                                        <i class="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th class="sortable" onclick="Orders.sortTable('total_amount')">
                                        <span>주문 금액</span>
                                        <i class="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th class="sortable" onclick="Orders.sortTable('status')">
                                        <span>상태</span>
                                        <i class="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th>우선순위</th>
                                    <th class="sortable" onclick="Orders.sortTable('created_at')">
                                        <span>주문일</span>
                                        <i class="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th style="width: 160px;">작업</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td colspan="7" class="text-center py-4">
                                        <div class="loading-spinner">
                                            <i class="fas fa-spinner fa-spin"></i>
                                            <span>주문 데이터를 불러오는 중...</span>
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
        const searchInput = document.getElementById('orderSearch');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce(() => {
                this.searchOrders();
            }, 300));
        }

        // 필터 변경
        const statusFilter = document.getElementById('statusFilter');
        const supplierFilter = document.getElementById('supplierFilter');
        const priorityFilter = document.getElementById('priorityFilter');

        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.loadOrders());
        }

        if (supplierFilter) {
            supplierFilter.addEventListener('change', () => this.loadOrders());
        }

        if (priorityFilter) {
            priorityFilter.addEventListener('change', () => this.loadOrders());
        }
    },

    // 주문 목록 로드
    async loadOrders(page = 1) {
        try {
            const searchQuery = document.getElementById('orderSearch')?.value || '';
            const statusFilter = document.getElementById('statusFilter')?.value || '';
            const supplierFilter = document.getElementById('supplierFilter')?.value || '';
            const priorityFilter = document.getElementById('priorityFilter')?.value || '';

            const params = {
                page,
                limit: this.pageSize,
                search: searchQuery,
                status: statusFilter,
                supplier_id: supplierFilter,
                priority: priorityFilter,
                sort: this.sortColumn,
                order: this.sortDirection
            };

            const response = await API.orders.getAll(params);

            if (response.success) {
                this.currentData = response.data.orders || [];
                this.currentPage = response.data.pagination?.current_page || 1;
                this.totalPages = response.data.pagination?.total_pages || 1;

                this.renderTable();
                this.updatePagination();
            } else {
                Utils.showToast(response.error || '주문 정보를 불러올 수 없습니다.', 'error');
                this.renderEmptyTable();
            }
        } catch (error) {
            console.error('주문 로드 오류:', error);
            Utils.showToast('주문 정보를 불러오는 중 오류가 발생했습니다.', 'error');
            this.renderEmptyTable();
        }
    },

    // 테이블 렌더링
    renderTable() {
        const tbody = document.querySelector('#ordersTable tbody');
        if (!tbody) return;

        if (this.currentData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5">
                        <div class="empty-state">
                            <i class="fas fa-shopping-cart fa-3x text-muted mb-3"></i>
                            <h3 class="text-muted">주문이 없습니다</h3>
                            <p class="text-muted">새로운 구매 주문을 생성하거나 검색 조건을 변경해보세요.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.currentData.map(order => {
            const statusInfo = this.getOrderStatusInfo(order.status);
            const priorityInfo = this.getPriorityInfo(order.priority);

            return `
                <tr class="order-row" data-order-id="${order.id}">
                    <td>
                        <div class="order-info-cell">
                            <div class="order-avatar ${statusInfo.avatarClass}">
                                <i class="${statusInfo.icon}"></i>
                            </div>
                            <div class="order-details">
                                <div class="order-number">${order.order_number || 'ORD-' + order.id?.toString().padStart(6, '0')}</div>
                                <div class="order-meta text-muted">${order.item_count || 0}개 품목</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="supplier-info">
                            <div class="supplier-name">${order.supplier_name || '-'}</div>
                            <div class="supplier-contact text-muted">${order.supplier_contact || '-'}</div>
                        </div>
                    </td>
                    <td>
                        <div class="amount-info">
                            <div class="amount-main">${(order.total_amount || 0).toLocaleString()}원</div>
                            <div class="amount-tax text-muted">부가세 ${((order.total_amount || 0) * 0.1).toLocaleString()}원</div>
                        </div>
                    </td>
                    <td>
                        <span class="order-status-badge ${statusInfo.class}">
                            <i class="${statusInfo.icon}"></i>
                            ${statusInfo.text}
                        </span>
                    </td>
                    <td>
                        <span class="priority-badge ${priorityInfo.class}">
                            <i class="${priorityInfo.icon}"></i>
                            ${priorityInfo.text}
                        </span>
                    </td>
                    <td>
                        <div class="date-info">
                            <div>${Utils.formatDate(order.created_at, 'MM-DD')}</div>
                            <div class="text-muted">${Utils.formatDate(order.created_at, 'HH:mm')}</div>
                        </div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-outline" onclick="Orders.showDetailModal(${order.id})" title="상세보기">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${order.status === 'pending' ?
                                `<button class="btn btn-sm btn-outline btn-success" onclick="Orders.approveOrder(${order.id})" title="승인">
                                    <i class="fas fa-check"></i>
                                </button>` : ''}
                            <button class="btn btn-sm btn-outline" onclick="Orders.showEditModal(${order.id})" title="수정">
                                <i class="fas fa-edit"></i>
                            </button>
                            ${order.status === 'pending' ?
                                `<button class="btn btn-sm btn-outline btn-danger" onclick="Orders.cancelOrder(${order.id})" title="취소">
                                    <i class="fas fa-times"></i>
                                </button>` : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    // 주문 상태 정보 반환
    getOrderStatusInfo(status) {
        const statusMap = {
            'pending': {
                class: 'status-pending',
                icon: 'fas fa-clock',
                text: '승인 대기',
                avatarClass: 'pending'
            },
            'approved': {
                class: 'status-approved',
                icon: 'fas fa-check-circle',
                text: '승인됨',
                avatarClass: 'approved'
            },
            'shipped': {
                class: 'status-shipped',
                icon: 'fas fa-truck',
                text: '배송 중',
                avatarClass: 'shipped'
            },
            'delivered': {
                class: 'status-delivered',
                icon: 'fas fa-check-double',
                text: '배송 완료',
                avatarClass: 'delivered'
            },
            'cancelled': {
                class: 'status-cancelled',
                icon: 'fas fa-times-circle',
                text: '취소',
                avatarClass: 'cancelled'
            }
        };

        return statusMap[status] || {
            class: 'status-unknown',
            icon: 'fas fa-question-circle',
            text: '알 수 없음',
            avatarClass: 'unknown'
        };
    },

    // 우선순위 정보 반환
    getPriorityInfo(priority) {
        const priorityMap = {
            'urgent': {
                class: 'priority-urgent',
                icon: 'fas fa-exclamation-triangle',
                text: '긴급'
            },
            'high': {
                class: 'priority-high',
                icon: 'fas fa-arrow-up',
                text: '높음'
            },
            'normal': {
                class: 'priority-normal',
                icon: 'fas fa-minus',
                text: '보통'
            },
            'low': {
                class: 'priority-low',
                icon: 'fas fa-arrow-down',
                text: '낮음'
            }
        };

        return priorityMap[priority] || {
            class: 'priority-normal',
            icon: 'fas fa-minus',
            text: '보통'
        };
    },

    // 빈 테이블 렌더링
    renderEmptyTable() {
        const tbody = document.querySelector('#ordersTable tbody');
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
                this.loadOrders(page);
            });
        }
    },

    // 검색
    async searchOrders() {
        await this.loadOrders(1);
    },

    // 검색 기능 (전역 검색에서 호출)
    async search(query) {
        const searchInput = document.getElementById('orderSearch');
        if (searchInput) {
            searchInput.value = query;
            await this.searchOrders();
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
        this.loadOrders(this.currentPage);
    },

    // 정렬 아이콘 업데이트
    updateSortIcons() {
        document.querySelectorAll('.sort-icon').forEach(icon => {
            icon.className = 'fas fa-sort sort-icon';
        });

        const activeHeader = document.querySelector(`[onclick="Orders.sortTable('${this.sortColumn}')"] .sort-icon`);
        if (activeHeader) {
            activeHeader.className = `fas fa-sort-${this.sortDirection === 'asc' ? 'up' : 'down'} sort-icon`;
        }
    },

    // 검색 클리어
    clearSearch() {
        const searchInput = document.getElementById('orderSearch');
        if (searchInput) {
            searchInput.value = '';
            this.loadOrders(1);
        }
    },

    // 통계 데이터 로드
    async loadStatistics() {
        try {
            const response = await API.orders.getAll({ stats: true });

            if (response.success) {
                const stats = response.data.statistics || {};

                // 전체 주문 수
                const totalElement = document.getElementById('totalOrders');
                if (totalElement) {
                    totalElement.textContent = (stats.total_orders || 0).toLocaleString();
                }

                // 승인 대기 주문
                const pendingElement = document.getElementById('pendingOrders');
                if (pendingElement) {
                    pendingElement.textContent = (stats.pending_orders || 0).toLocaleString();
                }

                // 이번 달 주문액
                const monthlyElement = document.getElementById('monthlyAmount');
                if (monthlyElement) {
                    const amount = stats.monthly_amount || 0;
                    monthlyElement.textContent = Math.round(amount / 10000).toLocaleString();
                }

                // 배송 중 주문
                const shippingElement = document.getElementById('shippingOrders');
                if (shippingElement) {
                    shippingElement.textContent = (stats.shipping_orders || 0).toLocaleString();
                }
            }
        } catch (error) {
            console.error('통계 로드 오류:', error);
        }
    },

    // 공급업체 목록 로드
    async loadSuppliers() {
        try {
            const response = await API.suppliers.getAll({ limit: 1000 });

            if (response.success) {
                const suppliers = response.data.suppliers || [];
                const select = document.getElementById('supplierFilter');

                if (select) {
                    const currentValue = select.value;
                    select.innerHTML = '<option value="">전체 공급업체</option>' +
                        suppliers.map(supplier =>
                            `<option value="${supplier.id}">${supplier.company_name}</option>`
                        ).join('');
                    select.value = currentValue;
                }
            }
        } catch (error) {
            console.error('공급업체 목록 로드 오류:', error);
        }
    },

    // 새 주문 생성 모달
    async showCreateModal() {
        const content = `
            <form id="orderCreateForm">
                <div class="order-create-container">
                    <!-- 기본 정보 -->
                    <div class="form-section">
                        <h3>주문 기본 정보</h3>
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="supplierId">공급업체 *</label>
                                <select id="supplierId" name="supplier_id" required>
                                    <option value="">공급업체를 선택하세요</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="priority">우선순위</label>
                                <select id="priority" name="priority">
                                    <option value="normal">보통</option>
                                    <option value="high">높음</option>
                                    <option value="urgent">긴급</option>
                                    <option value="low">낮음</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="expectedDate">납기 예정일</label>
                                <input type="date" id="expectedDate" name="expected_delivery_date">
                            </div>
                            <div class="form-group">
                                <label for="orderNotes">주문 메모</label>
                                <textarea id="orderNotes" name="notes" rows="2" placeholder="주문에 대한 특이사항을 입력하세요"></textarea>
                            </div>
                        </div>
                    </div>

                    <!-- 주문 품목 -->
                    <div class="form-section">
                        <div class="section-header">
                            <h3>주문 품목</h3>
                            <button type="button" class="btn btn-sm btn-primary" onclick="Orders.addOrderItem()">
                                <i class="fas fa-plus"></i> 품목 추가
                            </button>
                        </div>

                        <div class="order-items-container">
                            <div class="order-items-header">
                                <div class="item-col-product">제품</div>
                                <div class="item-col-quantity">수량</div>
                                <div class="item-col-price">단가</div>
                                <div class="item-col-total">합계</div>
                                <div class="item-col-actions">작업</div>
                            </div>
                            <div id="orderItemsList" class="order-items-list">
                                <!-- 주문 품목들이 여기에 추가됩니다 -->
                            </div>
                        </div>

                        <div class="order-summary">
                            <div class="summary-row">
                                <span>소계:</span>
                                <span id="orderSubtotal">0원</span>
                            </div>
                            <div class="summary-row">
                                <span>부가세 (10%):</span>
                                <span id="orderTax">0원</span>
                            </div>
                            <div class="summary-row total">
                                <span>총 주문 금액:</span>
                                <span id="orderTotal">0원</span>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        `;

        Utils.openModal('새 주문 생성', content, {
            size: 'extra-large',
            footerContent: `
                <button class="btn btn-secondary" onclick="Utils.closeModal()">취소</button>
                <button class="btn btn-primary" onclick="Orders.createOrder()">주문 생성</button>
            `
        });

        // 공급업체 목록 로드
        await this.loadSuppliersForOrder();

        // 첫 번째 품목 추가
        this.addOrderItem();
    },

    // 주문용 공급업체 목록 로드
    async loadSuppliersForOrder() {
        try {
            const response = await API.suppliers.getAll({ limit: 1000, is_active: true });

            if (response.success) {
                const suppliers = response.data.suppliers || [];
                const select = document.getElementById('supplierId');

                if (select) {
                    select.innerHTML = '<option value="">공급업체를 선택하세요</option>' +
                        suppliers.map(supplier =>
                            `<option value="${supplier.id}">${supplier.company_name}</option>`
                        ).join('');
                }
            }
        } catch (error) {
            console.error('공급업체 목록 로드 오류:', error);
        }
    },

    // 주문 품목 추가
    addOrderItem() {
        const itemsList = document.getElementById('orderItemsList');
        if (!itemsList) return;

        const itemId = 'item_' + Date.now();
        const itemHtml = `
            <div class="order-item" data-item-id="${itemId}">
                <div class="item-col-product">
                    <select class="product-select" name="products[]" onchange="Orders.updateItemPrice(this)">
                        <option value="">제품을 선택하세요</option>
                    </select>
                </div>
                <div class="item-col-quantity">
                    <input type="number" class="quantity-input" name="quantities[]" min="1" value="1" onchange="Orders.calculateItemTotal('${itemId}')">
                </div>
                <div class="item-col-price">
                    <input type="number" class="price-input" name="prices[]" min="0" step="0.01" readonly>
                </div>
                <div class="item-col-total">
                    <span class="item-total">0원</span>
                </div>
                <div class="item-col-actions">
                    <button type="button" class="btn btn-sm btn-outline btn-danger" onclick="Orders.removeOrderItem('${itemId}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;

        itemsList.insertAdjacentHTML('beforeend', itemHtml);

        // 새 품목의 제품 목록 로드
        this.loadProductsForItem(itemsList.lastElementChild.querySelector('.product-select'));

        // 주문 총액 계산
        this.calculateOrderTotal();
    },

    // 주문 품목 제거
    removeOrderItem(itemId) {
        const item = document.querySelector(`[data-item-id="${itemId}"]`);
        if (item) {
            item.remove();
            this.calculateOrderTotal();
        }
    },

    // 품목용 제품 목록 로드
    async loadProductsForItem(selectElement) {
        try {
            const response = await API.products.getAll({ limit: 1000, is_active: true });

            if (response.success) {
                const products = response.data.products || [];
                selectElement.innerHTML = '<option value="">제품을 선택하세요</option>' +
                    products.map(product =>
                        `<option value="${product.id}" data-price="${product.unit_price || 0}">${product.name} (${product.product_code})</option>`
                    ).join('');
            }
        } catch (error) {
            console.error('제품 목록 로드 오류:', error);
        }
    },

    // 품목 단가 업데이트
    updateItemPrice(selectElement) {
        const selectedOption = selectElement.options[selectElement.selectedIndex];
        const price = selectedOption.dataset.price || 0;
        const priceInput = selectElement.closest('.order-item').querySelector('.price-input');

        if (priceInput) {
            priceInput.value = price;
            this.calculateItemTotal(selectElement.closest('.order-item').dataset.itemId);
        }
    },

    // 품목 합계 계산
    calculateItemTotal(itemId) {
        const item = document.querySelector(`[data-item-id="${itemId}"]`);
        if (!item) return;

        const quantity = parseFloat(item.querySelector('.quantity-input').value) || 0;
        const price = parseFloat(item.querySelector('.price-input').value) || 0;
        const total = quantity * price;

        const totalElement = item.querySelector('.item-total');
        if (totalElement) {
            totalElement.textContent = total.toLocaleString() + '원';
        }

        this.calculateOrderTotal();
    },

    // 주문 총액 계산
    calculateOrderTotal() {
        const items = document.querySelectorAll('.order-item');
        let subtotal = 0;

        items.forEach(item => {
            const quantity = parseFloat(item.querySelector('.quantity-input').value) || 0;
            const price = parseFloat(item.querySelector('.price-input').value) || 0;
            subtotal += quantity * price;
        });

        const tax = subtotal * 0.1;
        const total = subtotal + tax;

        document.getElementById('orderSubtotal').textContent = subtotal.toLocaleString() + '원';
        document.getElementById('orderTax').textContent = tax.toLocaleString() + '원';
        document.getElementById('orderTotal').textContent = total.toLocaleString() + '원';
    },

    // 주문 생성
    async createOrder() {
        const form = document.getElementById('orderCreateForm');
        if (!form) return;

        // 폼 데이터 수집
        const formData = new FormData(form);
        const orderData = {
            supplier_id: formData.get('supplier_id'),
            priority: formData.get('priority') || 'normal',
            expected_delivery_date: formData.get('expected_delivery_date'),
            notes: formData.get('notes'),
            items: []
        };

        // 주문 품목 데이터 수집
        const items = document.querySelectorAll('.order-item');
        for (let item of items) {
            const productSelect = item.querySelector('.product-select');
            const quantityInput = item.querySelector('.quantity-input');
            const priceInput = item.querySelector('.price-input');

            if (productSelect.value && quantityInput.value && priceInput.value) {
                orderData.items.push({
                    product_id: productSelect.value,
                    quantity: parseFloat(quantityInput.value),
                    unit_price: parseFloat(priceInput.value)
                });
            }
        }

        // 검증
        if (!orderData.supplier_id) {
            Utils.showToast('공급업체를 선택해주세요.', 'warning');
            return;
        }

        if (orderData.items.length === 0) {
            Utils.showToast('최소 1개 이상의 주문 품목을 추가해주세요.', 'warning');
            return;
        }

        try {
            Utils.showLoading('주문을 생성하는 중...');

            const response = await API.orders.create(orderData);

            Utils.hideLoading();

            if (response.success) {
                Utils.closeModal();
                Utils.showToast('주문이 성공적으로 생성되었습니다.', 'success');

                // 데이터 새로고침
                await this.loadStatistics();
                await this.loadOrders(this.currentPage);
            } else {
                Utils.showToast(response.error || '주문 생성에 실패했습니다.', 'error');
            }
        } catch (error) {
            Utils.hideLoading();
            Utils.showToast('주문 생성 중 오류가 발생했습니다.', 'error');
        }
    },

    // 주문 상세 정보 모달
    async showDetailModal(id) {
        const order = this.currentData.find(order => order.id === id);
        if (!order) {
            Utils.showToast('주문 정보를 찾을 수 없습니다.', 'error');
            return;
        }

        try {
            Utils.showLoading('주문 상세 정보 로딩 중...');

            const response = await API.orders.getById(id);

            Utils.hideLoading();

            if (response.success) {
                const orderDetail = response.data.order || response.data;
                this.renderDetailModal(orderDetail);
            } else {
                Utils.showToast(response.error || '주문 상세 정보를 불러올 수 없습니다.', 'error');
            }
        } catch (error) {
            Utils.hideLoading();
            Utils.showToast('주문 상세 정보를 불러오는 중 오류가 발생했습니다.', 'error');
        }
    },

    // 상세 정보 모달 렌더링
    renderDetailModal(order) {
        const statusInfo = this.getOrderStatusInfo(order.status);
        const priorityInfo = this.getPriorityInfo(order.priority);

        const content = `
            <div class="order-detail-container">
                <div class="order-header">
                    <div class="order-avatar-large ${statusInfo.avatarClass}">
                        <i class="${statusInfo.icon}"></i>
                    </div>
                    <div class="order-title">
                        <h2>${order.order_number || 'ORD-' + order.id?.toString().padStart(6, '0')}</h2>
                        <p class="order-supplier">${order.supplier_name || '-'}</p>
                    </div>
                    <div class="order-status-info">
                        <span class="order-status-badge ${statusInfo.class}">
                            <i class="${statusInfo.icon}"></i>
                            ${statusInfo.text}
                        </span>
                        <span class="priority-badge ${priorityInfo.class}">
                            <i class="${priorityInfo.icon}"></i>
                            ${priorityInfo.text}
                        </span>
                    </div>
                </div>

                <div class="detail-tabs">
                    <div class="tab-headers">
                        <button class="tab-header active" onclick="Orders.switchTab(event, 'order-info')">주문 정보</button>
                        <button class="tab-header" onclick="Orders.switchTab(event, 'order-items')">주문 품목</button>
                        <button class="tab-header" onclick="Orders.switchTab(event, 'order-history')">진행 상황</button>
                    </div>

                    <div class="tab-content active" id="order-info">
                        <div class="detail-grid">
                            <div class="detail-group">
                                <label><i class="fas fa-hashtag"></i> 주문번호</label>
                                <div class="detail-value">${order.order_number || 'ORD-' + order.id?.toString().padStart(6, '0')}</div>
                            </div>
                            <div class="detail-group">
                                <label><i class="fas fa-building"></i> 공급업체</label>
                                <div class="detail-value">${order.supplier_name || '-'}</div>
                            </div>
                            <div class="detail-group">
                                <label><i class="fas fa-won-sign"></i> 주문 금액</label>
                                <div class="detail-value">${(order.total_amount || 0).toLocaleString()}원</div>
                            </div>
                            <div class="detail-group">
                                <label><i class="fas fa-calendar-alt"></i> 주문일</label>
                                <div class="detail-value">${Utils.formatDate(order.created_at, 'YYYY-MM-DD HH:mm')}</div>
                            </div>
                            <div class="detail-group">
                                <label><i class="fas fa-calendar-check"></i> 납기 예정일</label>
                                <div class="detail-value">${order.expected_delivery_date ? Utils.formatDate(order.expected_delivery_date, 'YYYY-MM-DD') : '미설정'}</div>
                            </div>
                            <div class="detail-group">
                                <label><i class="fas fa-user"></i> 담당자</label>
                                <div class="detail-value">${order.created_by_name || '-'}</div>
                            </div>
                        </div>

                        ${order.notes ? `
                            <div class="order-notes">
                                <label><i class="fas fa-sticky-note"></i> 주문 메모</label>
                                <div class="notes-content">${order.notes}</div>
                            </div>
                        ` : ''}
                    </div>

                    <div class="tab-content" id="order-items">
                        <div class="items-placeholder">
                            <i class="fas fa-box fa-2x text-muted"></i>
                            <p class="text-muted">주문 품목을 로드하는 중...</p>
                        </div>
                    </div>

                    <div class="tab-content" id="order-history">
                        <div class="history-placeholder">
                            <i class="fas fa-history fa-2x text-muted"></i>
                            <p class="text-muted">진행 상황을 로드하는 중...</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        Utils.openModal('주문 상세 정보', content, {
            size: 'large',
            footerContent: `
                <button class="btn btn-secondary" onclick="Utils.closeModal()">닫기</button>
                ${order.status === 'pending' ?
                    `<button class="btn btn-success" onclick="Orders.approveOrder(${order.id}); Utils.closeModal();">승인</button>` : ''}
                <button class="btn btn-primary" onclick="Orders.showEditModal(${order.id}); Utils.closeModal();">수정</button>
            `
        });

        // 주문 품목과 진행 상황 로드
        setTimeout(() => {
            this.loadOrderItems(order.id);
            this.loadOrderHistory(order.id);
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

    // 주문 품목 로드
    async loadOrderItems(orderId) {
        try {
            const response = await API.orders.getItems(orderId);

            if (response.success) {
                const items = response.data.items || [];
                const itemsContainer = document.getElementById('order-items');

                if (itemsContainer) {
                    if (items.length === 0) {
                        itemsContainer.innerHTML = `
                            <div class="items-empty">
                                <i class="fas fa-inbox fa-2x text-muted"></i>
                                <p class="text-muted">주문 품목이 없습니다</p>
                            </div>
                        `;
                    } else {
                        itemsContainer.innerHTML = `
                            <div class="order-items-table">
                                <div class="items-header">
                                    <div class="item-product">제품</div>
                                    <div class="item-quantity">수량</div>
                                    <div class="item-price">단가</div>
                                    <div class="item-total">합계</div>
                                </div>
                                <div class="items-body">
                                    ${items.map(item => `
                                        <div class="item-row">
                                            <div class="item-product">
                                                <div class="product-name">${item.product_name || '-'}</div>
                                                <div class="product-code text-muted">${item.product_code || '-'}</div>
                                            </div>
                                            <div class="item-quantity">
                                                <span class="quantity-value">${(item.quantity || 0).toLocaleString()}</span>
                                                <span class="quantity-unit">${item.unit || 'EA'}</span>
                                            </div>
                                            <div class="item-price">
                                                ${(item.unit_price || 0).toLocaleString()}원
                                            </div>
                                            <div class="item-total">
                                                <strong>${((item.quantity || 0) * (item.unit_price || 0)).toLocaleString()}원</strong>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `;
                    }
                }
            }
        } catch (error) {
            console.error('주문 품목 로드 오류:', error);
            const itemsContainer = document.getElementById('order-items');
            if (itemsContainer) {
                itemsContainer.innerHTML = `
                    <div class="items-error">
                        <i class="fas fa-exclamation-triangle fa-2x text-muted"></i>
                        <p class="text-muted">주문 품목을 불러올 수 없습니다</p>
                    </div>
                `;
            }
        }
    },

    // 주문 진행 상황 로드
    async loadOrderHistory(orderId) {
        // 임시 데이터로 진행 상황 표시
        const historyContainer = document.getElementById('order-history');
        if (historyContainer) {
            const sampleHistory = [
                {
                    status: '주문 생성',
                    timestamp: '2024-01-15 09:30',
                    user: '구매담당자',
                    description: '새 구매 주문이 생성되었습니다.'
                },
                {
                    status: '승인 대기',
                    timestamp: '2024-01-15 09:31',
                    user: '시스템',
                    description: '주문이 승인 대기 상태로 변경되었습니다.'
                }
            ];

            historyContainer.innerHTML = `
                <div class="order-timeline">
                    ${sampleHistory.map(history => `
                        <div class="timeline-item">
                            <div class="timeline-marker"></div>
                            <div class="timeline-content">
                                <div class="timeline-header">
                                    <strong>${history.status}</strong>
                                    <span class="timeline-time">${history.timestamp}</span>
                                </div>
                                <div class="timeline-description">${history.description}</div>
                                <div class="timeline-user text-muted">담당자: ${history.user}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    },

    // 주문 승인
    async approveOrder(id) {
        Utils.confirm('이 주문을 승인하시겠습니까?', async () => {
            try {
                Utils.showLoading('주문을 승인하는 중...');

                const response = await API.orders.approve(id);

                Utils.hideLoading();

                if (response.success) {
                    Utils.showToast('주문이 승인되었습니다.', 'success');

                    // 데이터 새로고침
                    await this.loadStatistics();
                    await this.loadOrders(this.currentPage);
                } else {
                    Utils.showToast(response.error || '주문 승인에 실패했습니다.', 'error');
                }
            } catch (error) {
                Utils.hideLoading();
                Utils.showToast('주문 승인 중 오류가 발생했습니다.', 'error');
            }
        });
    },

    // 주문 취소
    async cancelOrder(id) {
        Utils.prompt('주문 취소 사유를 입력해주세요:', async (reason) => {
            if (!reason.trim()) {
                Utils.showToast('취소 사유를 입력해주세요.', 'warning');
                return;
            }

            try {
                Utils.showLoading('주문을 취소하는 중...');

                const response = await API.orders.reject(id, reason);

                Utils.hideLoading();

                if (response.success) {
                    Utils.showToast('주문이 취소되었습니다.', 'success');

                    // 데이터 새로고침
                    await this.loadStatistics();
                    await this.loadOrders(this.currentPage);
                } else {
                    Utils.showToast(response.error || '주문 취소에 실패했습니다.', 'error');
                }
            } catch (error) {
                Utils.hideLoading();
                Utils.showToast('주문 취소 중 오류가 발생했습니다.', 'error');
            }
        });
    },

    // 수정 모달 표시
    showEditModal(id) {
        Utils.showToast('주문 수정 기능은 곧 추가될 예정입니다.', 'info');
    },

    // 승인 대기 주문 표시
    showPendingOrders() {
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.value = 'pending';
            this.loadOrders(1);
        }
        Utils.showToast('승인 대기 주문을 필터링했습니다.', 'info');
    },

    // 긴급 주문 표시
    showUrgentOrders() {
        const priorityFilter = document.getElementById('priorityFilter');
        if (priorityFilter) {
            priorityFilter.value = 'urgent';
            this.loadOrders(1);
        }
        Utils.showToast('긴급 주문을 필터링했습니다.', 'info');
    },

    // 최근 주문 표시
    showRecentOrders() {
        // 정렬을 최신순으로 설정
        this.sortColumn = 'created_at';
        this.sortDirection = 'desc';
        this.updateSortIcons();
        this.loadOrders(1);
        Utils.showToast('최근 주문순으로 정렬했습니다.', 'info');
    },

    // 데이터 내보내기
    async exportData() {
        try {
            Utils.showLoading('주문 내역 내보내는 중...');

            const response = await API.orders.getAll({ export: true });

            if (response.success) {
                const data = response.data.orders || [];
                Utils.exportToCSV(data, 'orders', [
                    { key: 'order_number', label: '주문번호' },
                    { key: 'supplier_name', label: '공급업체' },
                    { key: 'total_amount', label: '주문금액', format: (value) => (value || 0).toLocaleString() + '원' },
                    { key: 'status', label: '상태', format: (value) => this.getOrderStatusInfo(value).text },
                    { key: 'priority', label: '우선순위', format: (value) => this.getPriorityInfo(value).text },
                    { key: 'created_at', label: '주문일', format: (value) => Utils.formatDate(value, 'YYYY-MM-DD') },
                    { key: 'expected_delivery_date', label: '납기예정일', format: (value) => value ? Utils.formatDate(value, 'YYYY-MM-DD') : '미설정' }
                ]);
                Utils.showToast('주문 내역이 성공적으로 내보내졌습니다.', 'success');
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
window.Orders = Orders;

// 페이지 모듈 등록
document.addEventListener('DOMContentLoaded', function() {
    if (window.App) {
        App.registerPage('orders', Orders);
    }

    // 페이지 초기화 시 공급업체 목록 로드
    setTimeout(() => {
        if (Orders.loadSuppliers) {
            Orders.loadSuppliers();
        }
    }, 1000);
});