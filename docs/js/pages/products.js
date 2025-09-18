// 제품 관리 페이지 모듈
const Products = {
    currentData: [],
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    currentFilters: {
        search: '',
        category_id: '',
        supplier_id: '',
        is_active: '1'
    },

    async init() {
        const contentContainer = document.querySelector('.content-container');
        contentContainer.innerHTML = this.getTemplate();

        // 저장된 설정 복원
        const savedViewMode = localStorage.getItem('productsViewMode') || 'table';
        const savedPageSize = localStorage.getItem('productsPageSize') || '10';
        this.pageSize = parseInt(savedPageSize);

        // 초기 데이터 로드
        await this.loadCategories();
        await this.loadSuppliers();
        await this.loadProducts();

        // 이벤트 리스너 설정
        this.setupEventListeners();

        // 뷰 모드 설정
        this.setViewMode(savedViewMode);

        // 애니메이션 효과
        this.animateElements();
    },

    // 애니메이션 효과
    animateElements() {
        const statCards = document.querySelectorAll('.stat-card');
        statCards.forEach((card, index) => {
            setTimeout(() => {
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px)';
                card.style.transition = 'all 0.3s ease';

                setTimeout(() => {
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }, 100);
            }, index * 100);
        });
    },

    getTemplate() {
        return `
            <div class="page-header">
                <div class="header-content">
                    <div class="header-title">
                        <h1><i class="fas fa-box"></i> 제품 관리</h1>
                        <p class="header-subtitle">제품 정보와 가격을 효율적으로 관리하세요</p>
                    </div>
                    <div class="header-actions">
                        <div class="action-group">
                            <button class="btn btn-primary" onclick="Products.showAddModal()">
                                <i class="fas fa-plus"></i>
                                <span>제품 추가</span>
                            </button>
                            <button class="btn btn-secondary" onclick="Products.exportData()">
                                <i class="fas fa-download"></i>
                                <span>내보내기</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="page-content">
                <!-- 빠른 통계 카드 -->
                <div class="quick-stats" id="productStats">
                    <div class="stat-card stat-card-primary">
                        <div class="stat-icon">
                            <i class="fas fa-box"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-value" id="totalProducts">0</div>
                            <div class="stat-label">총 제품 수</div>
                        </div>
                    </div>
                    <div class="stat-card stat-card-success">
                        <div class="stat-icon">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-value" id="activeProducts">0</div>
                            <div class="stat-label">활성 제품</div>
                        </div>
                    </div>
                    <div class="stat-card stat-card-warning">
                        <div class="stat-icon">
                            <i class="fas fa-exclamation-triangle"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-value" id="lowStockProducts">0</div>
                            <div class="stat-label">재고 부족</div>
                        </div>
                    </div>
                    <div class="stat-card stat-card-info">
                        <div class="stat-icon">
                            <i class="fas fa-won-sign"></i>
                        </div>
                        <div class="stat-info">
                            <div class="stat-value" id="avgProfit">0%</div>
                            <div class="stat-label">평균 수익률</div>
                        </div>
                    </div>
                </div>

                <!-- 고급 필터 섹션 -->
                <div class="filter-panel">
                    <div class="filter-header">
                        <h3><i class="fas fa-filter"></i> 검색 및 필터</h3>
                        <button class="btn btn-link" onclick="Products.toggleAdvancedFilters()" id="advancedFilterToggle">
                            <i class="fas fa-chevron-down"></i> 고급 검색
                        </button>
                    </div>
                    <div class="filter-content">
                        <div class="basic-filters">
                            <div class="search-group">
                                <div class="search-box">
                                    <input type="text" id="searchInput" placeholder="제품명, 제품코드로 검색...">
                                    <button class="search-btn" onclick="Products.applyFilters()">
                                        <i class="fas fa-search"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="filter-group">
                                <select id="categoryFilter" class="form-select">
                                    <option value="">모든 카테고리</option>
                                </select>
                                <select id="supplierFilter" class="form-select">
                                    <option value="">모든 공급업체</option>
                                </select>
                                <select id="statusFilter" class="form-select">
                                    <option value="">모든 상태</option>
                                    <option value="1" selected>활성</option>
                                    <option value="0">비활성</option>
                                </select>
                            </div>
                        </div>
                        <div class="advanced-filters" id="advancedFilters" style="display: none;">
                            <div class="filter-row">
                                <div class="filter-item">
                                    <label>가격 범위</label>
                                    <div class="range-inputs">
                                        <input type="number" id="minPrice" placeholder="최소가">
                                        <span>~</span>
                                        <input type="number" id="maxPrice" placeholder="최대가">
                                    </div>
                                </div>
                                <div class="filter-item">
                                    <label>재고 수준</label>
                                    <select id="stockLevelFilter">
                                        <option value="">모든 수준</option>
                                        <option value="low">재고 부족</option>
                                        <option value="normal">정상</option>
                                        <option value="high">과재고</option>
                                    </select>
                                </div>
                            </div>
                            <div class="filter-actions">
                                <button class="btn btn-primary" onclick="Products.applyFilters()">
                                    <i class="fas fa-search"></i> 검색
                                </button>
                                <button class="btn btn-secondary" onclick="Products.resetFilters()">
                                    <i class="fas fa-undo"></i> 초기화
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 제품 목록 -->
                <div class="data-panel">
                    <div class="panel-header">
                        <div class="panel-title">
                            <h3><i class="fas fa-list"></i> 제품 목록</h3>
                            <span class="result-count" id="totalCount">총 0개</span>
                        </div>
                        <div class="panel-actions">
                            <div class="view-toggle">
                                <button class="view-btn active" onclick="Products.setViewMode('table')" data-view="table">
                                    <i class="fas fa-table"></i>
                                </button>
                                <button class="view-btn" onclick="Products.setViewMode('card')" data-view="card">
                                    <i class="fas fa-th-large"></i>
                                </button>
                            </div>
                            <div class="sort-controls">
                                <select id="sortBy" onchange="Products.applySorting()">
                                    <option value="name">이름순</option>
                                    <option value="created_at">등록일순</option>
                                    <option value="sale_price">가격순</option>
                                    <option value="available_stock">재고순</option>
                                </select>
                                <button class="sort-direction" onclick="Products.toggleSortDirection()" id="sortDirection">
                                    <i class="fas fa-sort-alpha-down"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="panel-content">
                        <!-- 테이블 뷰 -->
                        <div class="table-view" id="tableView">
                            <div class="modern-table">
                                <table class="products-table" id="productsTable">
                                    <thead>
                                        <tr>
                                            <th class="sortable" onclick="Products.sortBy('product_code')">
                                                제품코드 <i class="fas fa-sort"></i>
                                            </th>
                                            <th class="sortable" onclick="Products.sortBy('name')">
                                                제품명 <i class="fas fa-sort"></i>
                                            </th>
                                            <th>카테고리</th>
                                            <th>공급업체</th>
                                            <th>단위</th>
                                            <th class="sortable" onclick="Products.sortBy('sale_price')">
                                                가격정보 <i class="fas fa-sort"></i>
                                            </th>
                                            <th class="sortable" onclick="Products.sortBy('available_stock')">
                                                재고 <i class="fas fa-sort"></i>
                                            </th>
                                            <th>상태</th>
                                            <th class="sortable" onclick="Products.sortBy('created_at')">
                                                등록일 <i class="fas fa-sort"></i>
                                            </th>
                                            <th class="actions-col">작업</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr class="loading-row">
                                            <td colspan="10">
                                                <div class="loading-content">
                                                    <i class="fas fa-spinner fa-spin"></i>
                                                    <span>로딩 중...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <!-- 카드 뷰 -->
                        <div class="card-view" id="cardView" style="display: none;">
                            <div class="products-grid" id="productsGrid">
                                <!-- 카드들이 여기에 동적으로 생성됩니다 -->
                            </div>
                        </div>

                        <!-- 페이지네이션 -->
                        <div class="pagination-container">
                            <div class="pagination-info" id="paginationInfo">
                                <!-- 페이지 정보가 여기에 표시됩니다 -->
                            </div>
                            <div class="pagination" id="pagination">
                                <!-- 페이지네이션이 여기에 동적으로 생성됩니다 -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    setupEventListeners() {
        // 검색 입력 이벤트
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.currentFilters.search = e.target.value;
                    this.currentPage = 1;
                    this.loadProducts();
                }, 500);
            });
        }
    },

    async loadCategories() {
        try {
            const response = await API.get('/products/categories');
            if (response.success) {
                const categorySelect = document.getElementById('categoryFilter');
                if (categorySelect) {
                    response.data.forEach(category => {
                        const option = document.createElement('option');
                        option.value = category.id;
                        option.textContent = category.name;
                        categorySelect.appendChild(option);
                    });
                }
            }
        } catch (error) {
            console.error('카테고리 로드 오류:', error);
        }
    },

    async loadSuppliers() {
        try {
            const response = await API.suppliers.getAll();
            if (response.success) {
                const supplierSelect = document.getElementById('supplierFilter');
                if (supplierSelect) {
                    const suppliers = response.data.suppliers || response.data;
                    suppliers.forEach(supplier => {
                        const option = document.createElement('option');
                        option.value = supplier.id;
                        option.textContent = supplier.name;
                        supplierSelect.appendChild(option);
                    });
                }
            }
        } catch (error) {
            console.error('공급업체 로드 오류:', error);
        }
    },

    async loadProducts() {
        try {
            Utils.showLoading('제품 목록을 불러오는 중...');

            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.pageSize,
                search: this.currentFilters.search,
                category_id: this.currentFilters.category_id,
                supplier_id: this.currentFilters.supplier_id,
                is_active: this.currentFilters.is_active
            });

            const response = await API.products.getAll(params.toString());
            Utils.hideLoading();

            if (response.success) {
                this.currentData = response.data.products || response.data;
                this.renderTable();

                if (response.data.pagination) {
                    this.totalPages = response.data.pagination.totalPages;
                    this.updatePagination(response.data.pagination);
                }

                // 총 개수 업데이트
                const totalCount = response.data.pagination?.total || this.currentData.length;
                document.getElementById('totalCount').textContent = `총 ${totalCount}개`;
            } else {
                Utils.showToast(response.error || '제품 목록 조회에 실패했습니다.', 'error');
            }
        } catch (error) {
            Utils.hideLoading();
            console.error('제품 데이터 로드 오류:', error);
            Utils.showToast('제품 데이터 로드 중 오류가 발생했습니다.', 'error');
        }
    },

    renderTable() {
        const tbody = document.querySelector('#productsTable tbody');
        if (!tbody) return;

        // 통계 업데이트
        this.updateStats();

        if (this.currentData.length === 0) {
            tbody.innerHTML = `
                <tr class="no-data-row">
                    <td colspan="10">
                        <div class="no-data-content">
                            <i class="fas fa-box-open"></i>
                            <h4>등록된 제품이 없습니다</h4>
                            <p>새로운 제품을 추가해 보세요.</p>
                            <button class="btn btn-primary" onclick="Products.showAddModal()">
                                <i class="fas fa-plus"></i> 제품 추가
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.currentData.map(product => {
            const profitPercent = product.sale_price > 0 ?
                ((product.calculated_profit / product.sale_price) * 100).toFixed(1) : 0;

            return `
                <tr class="product-row" data-id="${product.id}">
                    <td>
                        <div class="product-code">
                            <strong>${product.product_code}</strong>
                        </div>
                    </td>
                    <td>
                        <div class="product-info">
                            <div class="product-name">${product.name}</div>
                            ${product.description ? `<div class="product-desc">${product.description}</div>` : ''}
                        </div>
                    </td>
                    <td>
                        <span class="category-badge">${product.category_name || '-'}</span>
                    </td>
                    <td>
                        <div class="supplier-info">${product.supplier_name || '-'}</div>
                    </td>
                    <td>
                        <span class="unit-badge">${product.unit}</span>
                    </td>
                    <td>
                        <div class="price-details">
                            <div class="sale-price">₩${Utils.formatNumber(product.sale_price || 0)}</div>
                            <div class="cost-info">
                                <span class="cost-price">원가: ₩${Utils.formatNumber(product.cost_price || 0)}</span>
                            </div>
                            <div class="profit-info">
                                <span class="profit-amount ${product.calculated_profit >= 0 ? 'positive' : 'negative'}">
                                    수익: ₩${Utils.formatNumber(product.calculated_profit || 0)} (${profitPercent}%)
                                </span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="stock-info">
                            <span class="stock-level ${this.getStockStatusClass(product)}">
                                ${Utils.formatNumber(product.available_stock || 0)}
                            </span>
                            <div class="stock-indicator ${this.getStockStatusClass(product)}">
                                ${this.getStockStatusText(product)}
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="status-container">
                            <span class="status-badge ${product.is_active ? 'active' : 'inactive'}">
                                <i class="fas ${product.is_active ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                                ${product.is_active ? '활성' : '비활성'}
                            </span>
                        </div>
                    </td>
                    <td>
                        <div class="date-info">
                            <div class="date">${Utils.formatDate(product.created_at)}</div>
                            <div class="creator">${product.created_by_name || '시스템'}</div>
                        </div>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn view-btn" onclick="Products.showDetailsModal(${product.id})" title="상세보기">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="action-btn edit-btn" onclick="Products.showEditModal(${product.id})" title="수정">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn delete-btn" onclick="Products.deleteProduct(${product.id})" title="삭제">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // 카드 뷰도 업데이트
        this.renderCards();
    },

    getStockStatusClass(product) {
        const stock = product.available_stock || 0;
        if (stock <= product.min_stock_level) return 'stock-low';
        if (stock >= product.max_stock_level) return 'stock-high';
        return 'stock-normal';
    },

    updatePagination(pagination) {
        const paginationEl = document.getElementById('pagination');
        if (!paginationEl || !pagination) return;

        const { currentPage, totalPages, total } = pagination;
        this.currentPage = currentPage;
        this.totalPages = totalPages;

        let html = '';

        // 이전 버튼
        html += `<button class="btn btn-sm ${currentPage <= 1 ? 'disabled' : ''}"
                 onclick="Products.goToPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>
                 <i class="fas fa-chevron-left"></i></button>`;

        // 페이지 번호들
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);

        if (startPage > 1) {
            html += `<button class="btn btn-sm" onclick="Products.goToPage(1)">1</button>`;
            if (startPage > 2) html += `<span class="pagination-ellipsis">...</span>`;
        }

        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="btn btn-sm ${i === currentPage ? 'active' : ''}"
                     onclick="Products.goToPage(${i})">${i}</button>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += `<span class="pagination-ellipsis">...</span>`;
            html += `<button class="btn btn-sm" onclick="Products.goToPage(${totalPages})">${totalPages}</button>`;
        }

        // 다음 버튼
        html += `<button class="btn btn-sm ${currentPage >= totalPages ? 'disabled' : ''}"
                 onclick="Products.goToPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>
                 <i class="fas fa-chevron-right"></i></button>`;

        paginationEl.innerHTML = html;
    },

    goToPage(page) {
        if (page < 1 || page > this.totalPages || page === this.currentPage) return;
        this.currentPage = page;
        this.loadProducts();
    },

    applyFilters() {
        this.currentFilters.search = document.getElementById('searchInput').value;
        this.currentFilters.category_id = document.getElementById('categoryFilter').value;
        this.currentFilters.supplier_id = document.getElementById('supplierFilter').value;
        this.currentFilters.is_active = document.getElementById('statusFilter').value;

        // 고급 필터
        const minPrice = document.getElementById('minPrice')?.value;
        const maxPrice = document.getElementById('maxPrice')?.value;
        const stockLevel = document.getElementById('stockLevelFilter')?.value;

        if (minPrice) this.currentFilters.min_price = minPrice;
        if (maxPrice) this.currentFilters.max_price = maxPrice;
        if (stockLevel) this.currentFilters.stock_level = stockLevel;

        this.currentPage = 1;
        this.loadProducts();

        // 필터 적용 효과
        const filterPanel = document.querySelector('.filter-panel');
        filterPanel.style.transform = 'scale(0.98)';
        setTimeout(() => {
            filterPanel.style.transform = 'scale(1)';
        }, 150);
    },

    resetFilters() {
        this.currentFilters = { search: '', category_id: '', supplier_id: '', is_active: '1' };
        document.getElementById('searchInput').value = '';
        document.getElementById('categoryFilter').value = '';
        document.getElementById('supplierFilter').value = '';
        document.getElementById('statusFilter').value = '1';
        this.currentPage = 1;
        this.loadProducts();
    },

    async showAddModal() {
        try {
            // 카테고리와 공급업체 목록을 가져와서 모달에 표시
            const [categoriesResponse, suppliersResponse] = await Promise.all([
                API.get('/products/categories'),
                API.suppliers.getAll()
            ]);

            const categories = categoriesResponse.success ? categoriesResponse.data : [];
            const suppliers = suppliersResponse.success ? (suppliersResponse.data.suppliers || suppliersResponse.data) : [];

            const modalContent = `
                <form id="addProductForm" class="product-form">
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="productCode">제품코드 *</label>
                            <input type="text" id="productCode" name="product_code" required
                                   placeholder="예: PROD-001" maxlength="50">
                            <small class="form-help">고유한 제품 코드를 입력하세요</small>
                        </div>

                        <div class="form-group">
                            <label for="productName">제품명 *</label>
                            <input type="text" id="productName" name="name" required
                                   placeholder="제품명을 입력하세요" maxlength="200">
                        </div>

                        <div class="form-group">
                            <label for="categoryId">카테고리 *</label>
                            <select id="categoryId" name="category_id" required>
                                <option value="">카테고리를 선택하세요</option>
                                ${categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('')}
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="supplierId">공급업체 *</label>
                            <select id="supplierId" name="supplier_id" required>
                                <option value="">공급업체를 선택하세요</option>
                                ${suppliers.map(sup => `<option value="${sup.id}">${sup.name || sup.company_name}</option>`).join('')}
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="unit">단위 *</label>
                            <select id="unit" name="unit" required>
                                <option value="">단위를 선택하세요</option>
                                <option value="개">개</option>
                                <option value="박스">박스</option>
                                <option value="팩">팩</option>
                                <option value="병">병</option>
                                <option value="kg">kg</option>
                                <option value="L">L</option>
                                <option value="ml">ml</option>
                                <option value="g">g</option>
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="costPrice">원가 *</label>
                            <input type="number" id="costPrice" name="cost_price" required
                                   min="0" step="0.01" placeholder="0" onchange="Products.calculateProfit()">
                            <small class="form-help">원(KRW) 단위로 입력</small>
                        </div>

                        <div class="form-group">
                            <label for="salePrice">판매가 *</label>
                            <input type="number" id="salePrice" name="sale_price" required
                                   min="0" step="0.01" placeholder="0" onchange="Products.calculateProfit()">
                            <small class="form-help">원(KRW) 단위로 입력</small>
                        </div>

                        <div class="form-group">
                            <label for="factoryProfit">공장수익</label>
                            <input type="number" id="factoryProfit" name="factory_profit"
                                   min="0" step="0.01" placeholder="0" value="0" onchange="Products.calculateProfit()">
                            <small class="form-help">원(KRW) 단위로 입력</small>
                        </div>

                        <div class="form-group">
                            <label for="calculatedProfit">계산된 수익 (자동계산)</label>
                            <input type="number" id="calculatedProfit" name="calculated_profit" readonly
                                   style="background-color: #f8f9fa; cursor: not-allowed;" placeholder="0">
                            <small class="form-help">판매가 - 원가 - 공장수익</small>
                        </div>

                        <div class="form-group">
                            <label for="minStockLevel">최소재고량</label>
                            <input type="number" id="minStockLevel" name="min_stock_level"
                                   min="0" step="1" placeholder="0" value="10">
                        </div>

                        <div class="form-group">
                            <label for="maxStockLevel">최대재고량</label>
                            <input type="number" id="maxStockLevel" name="max_stock_level"
                                   min="0" step="1" placeholder="0" value="1000">
                        </div>

                        <div class="form-group form-group-full">
                            <label for="description">제품설명</label>
                            <textarea id="description" name="description" rows="3"
                                      placeholder="제품에 대한 상세 설명을 입력하세요" maxlength="1000"></textarea>
                        </div>

                        <div class="form-group">
                            <label for="isActive">상태</label>
                            <select id="isActive" name="is_active">
                                <option value="1" selected>활성</option>
                                <option value="0">비활성</option>
                            </select>
                        </div>
                    </div>
                </form>
            `;

            Utils.openModal('새 제품 추가', modalContent, {
                size: 'large',
                footerContent: `
                    <button class="btn btn-secondary" onclick="Utils.closeModal()">취소</button>
                    <button class="btn btn-primary" onclick="Products.saveProduct()">
                        <i class="fas fa-save"></i> 저장
                    </button>
                `
            });

        } catch (error) {
            console.error('제품 추가 모달 오류:', error);
            Utils.showToast('모달을 표시하는 중 오류가 발생했습니다.', 'error');
        }
    },

    async showDetailsModal(id) {
        try {
            Utils.showLoading('제품 정보를 불러오는 중...');

            const response = await API.products.getById(id);
            Utils.hideLoading();

            if (!response.success) {
                Utils.showToast('제품 정보를 불러올 수 없습니다.', 'error');
                return;
            }

            const product = response.data.product;

            const modalContent = `
                <div class="product-details">
                    <div class="details-grid">
                        <div class="detail-section">
                            <h4>기본 정보</h4>
                            <div class="detail-item">
                                <label>제품코드:</label>
                                <span class="value">${product.product_code || '-'}</span>
                            </div>
                            <div class="detail-item">
                                <label>제품명:</label>
                                <span class="value">${product.name || '-'}</span>
                            </div>
                            <div class="detail-item">
                                <label>카테고리:</label>
                                <span class="value badge badge-info">${product.category_name || '-'}</span>
                            </div>
                            <div class="detail-item">
                                <label>공급업체:</label>
                                <span class="value">${product.supplier_name || '-'}</span>
                            </div>
                            <div class="detail-item">
                                <label>단위:</label>
                                <span class="value">${product.unit || '-'}</span>
                            </div>
                            <div class="detail-item">
                                <label>원가:</label>
                                <span class="value">₩${Utils.formatNumber(product.cost_price || 0)}</span>
                            </div>
                            <div class="detail-item">
                                <label>판매가:</label>
                                <span class="value">₩${Utils.formatNumber(product.sale_price || 0)}</span>
                            </div>
                            <div class="detail-item">
                                <label>공장수익:</label>
                                <span class="value">₩${Utils.formatNumber(product.factory_profit || 0)}</span>
                            </div>
                            <div class="detail-item">
                                <label>계산된 수익:</label>
                                <span class="value text-success">₩${Utils.formatNumber(product.calculated_profit || 0)}</span>
                            </div>
                            <div class="detail-item">
                                <label>상태:</label>
                                <span class="value badge ${product.is_active ? 'badge-success' : 'badge-secondary'}">
                                    ${product.is_active ? '활성' : '비활성'}
                                </span>
                            </div>
                        </div>

                        <div class="detail-section">
                            <h4>재고 정보</h4>
                            <div class="detail-item">
                                <label>현재 재고:</label>
                                <span class="value stock-level ${this.getStockStatusClass(product)}">
                                    ${Utils.formatNumber(product.available_stock || 0)}
                                </span>
                            </div>
                            <div class="detail-item">
                                <label>총 재고:</label>
                                <span class="value">${Utils.formatNumber(product.total_stock || 0)}</span>
                            </div>
                            <div class="detail-item">
                                <label>최소 재고량:</label>
                                <span class="value">${Utils.formatNumber(product.min_stock_level || 0)}</span>
                            </div>
                            <div class="detail-item">
                                <label>최대 재고량:</label>
                                <span class="value">${Utils.formatNumber(product.max_stock_level || 0)}</span>
                            </div>
                        </div>

                        <div class="detail-section">
                            <h4>등록 정보</h4>
                            <div class="detail-item">
                                <label>등록자:</label>
                                <div class="creator-info">
                                    <strong>${product.created_by_name || '시스템'}</strong>
                                    <br><small class="text-muted">${product.created_by_email || '-'}</small>
                                </div>
                            </div>
                            <div class="detail-item">
                                <label>등록일:</label>
                                <span class="value">${Utils.formatDate(product.created_at)}</span>
                            </div>
                            <div class="detail-item">
                                <label>수정일:</label>
                                <span class="value">${product.updated_at ? Utils.formatDate(product.updated_at) : '수정된 적 없음'}</span>
                            </div>
                        </div>

                        ${product.description ? `
                        <div class="detail-section full-width">
                            <h4>제품 설명</h4>
                            <div class="description-content">
                                ${product.description}
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;

            Utils.openModal(`제품 상세 정보 - ${product.name}`, modalContent, {
                size: 'large',
                footerContent: `
                    <button class="btn btn-secondary" onclick="Utils.closeModal()">닫기</button>
                    <button class="btn btn-warning" onclick="Utils.closeModal(); Products.showEditModal(${product.id})">
                        <i class="fas fa-edit"></i> 수정
                    </button>
                    <button class="btn btn-danger" onclick="Utils.closeModal(); Products.deleteProduct(${product.id})">
                        <i class="fas fa-trash"></i> 삭제
                    </button>
                `
            });

        } catch (error) {
            Utils.hideLoading();
            console.error('제품 상세보기 오류:', error);
            Utils.showToast('제품 정보를 불러오는 중 오류가 발생했습니다.', 'error');
        }
    },

    async showEditModal(id) {
        try {
            Utils.showLoading('제품 정보를 불러오는 중...');

            // 제품 정보, 카테고리, 공급업체 정보를 동시에 가져오기
            const [productResponse, categoriesResponse, suppliersResponse] = await Promise.all([
                API.products.getById(id),
                API.get('/products/categories'),
                API.suppliers.getAll()
            ]);

            Utils.hideLoading();

            if (!productResponse.success) {
                Utils.showToast('제품 정보를 불러올 수 없습니다.', 'error');
                return;
            }

            const product = productResponse.data;
            const categories = categoriesResponse.success ? categoriesResponse.data : [];
            const suppliers = suppliersResponse.success ? (suppliersResponse.data.suppliers || suppliersResponse.data) : [];

            const modalContent = `
                <form id="editProductForm" class="product-form">
                    <input type="hidden" name="id" value="${product.id}">
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="editProductCode">제품코드 *</label>
                            <input type="text" id="editProductCode" name="product_code" required readonly
                                   value="${product.product_code || ''}" placeholder="예: PROD-001" maxlength="50"
                                   style="background-color: #f8f9fa; cursor: not-allowed;">
                            <small class="form-help">제품 코드는 수정할 수 없습니다</small>
                        </div>

                        <div class="form-group">
                            <label for="editProductName">제품명 *</label>
                            <input type="text" id="editProductName" name="name" required
                                   value="${product.name || ''}" placeholder="제품명을 입력하세요" maxlength="200">
                        </div>

                        <div class="form-group">
                            <label for="editCategoryId">카테고리 *</label>
                            <select id="editCategoryId" name="category_id" required>
                                <option value="">카테고리를 선택하세요</option>
                                ${categories.map(cat =>
                                    `<option value="${cat.id}" ${cat.id == product.category_id ? 'selected' : ''}>${cat.name}</option>`
                                ).join('')}
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="editSupplierId">공급업체 *</label>
                            <select id="editSupplierId" name="supplier_id" required>
                                <option value="">공급업체를 선택하세요</option>
                                ${suppliers.map(sup =>
                                    `<option value="${sup.id}" ${sup.id == product.supplier_id ? 'selected' : ''}>${sup.name || sup.company_name}</option>`
                                ).join('')}
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="editUnit">단위 *</label>
                            <select id="editUnit" name="unit" required>
                                <option value="">단위를 선택하세요</option>
                                ${['개', '박스', '팩', '병', 'kg', 'L', 'ml', 'g'].map(unit =>
                                    `<option value="${unit}" ${unit === product.unit ? 'selected' : ''}>${unit}</option>`
                                ).join('')}
                            </select>
                        </div>

                        <div class="form-group">
                            <label for="editCostPrice">원가 *</label>
                            <input type="number" id="editCostPrice" name="cost_price" required
                                   value="${product.cost_price || 0}" min="0" step="0.01" onchange="Products.calculateProfit(true)">
                            <small class="form-help">원(KRW) 단위로 입력</small>
                        </div>

                        <div class="form-group">
                            <label for="editSalePrice">판매가 *</label>
                            <input type="number" id="editSalePrice" name="sale_price" required
                                   value="${product.sale_price || 0}" min="0" step="0.01" onchange="Products.calculateProfit(true)">
                            <small class="form-help">원(KRW) 단위로 입력</small>
                        </div>

                        <div class="form-group">
                            <label for="editFactoryProfit">공장수익</label>
                            <input type="number" id="editFactoryProfit" name="factory_profit"
                                   value="${product.factory_profit || 0}" min="0" step="0.01" onchange="Products.calculateProfit(true)">
                            <small class="form-help">원(KRW) 단위로 입력</small>
                        </div>

                        <div class="form-group">
                            <label for="editCalculatedProfit">계산된 수익 (자동계산)</label>
                            <input type="number" id="editCalculatedProfit" name="calculated_profit" readonly
                                   value="${product.calculated_profit || 0}" style="background-color: #f8f9fa; cursor: not-allowed;">
                            <small class="form-help">판매가 - 원가 - 공장수익</small>
                        </div>

                        <div class="form-group">
                            <label for="editMinStockLevel">최소재고량</label>
                            <input type="number" id="editMinStockLevel" name="min_stock_level"
                                   value="${product.min_stock_level || 10}" min="0" step="1">
                        </div>

                        <div class="form-group">
                            <label for="editMaxStockLevel">최대재고량</label>
                            <input type="number" id="editMaxStockLevel" name="max_stock_level"
                                   value="${product.max_stock_level || 1000}" min="0" step="1">
                        </div>

                        <div class="form-group form-group-full">
                            <label for="editDescription">제품설명</label>
                            <textarea id="editDescription" name="description" rows="3"
                                      placeholder="제품에 대한 상세 설명을 입력하세요" maxlength="1000">${product.description || ''}</textarea>
                        </div>

                        <div class="form-group">
                            <label for="editIsActive">상태</label>
                            <select id="editIsActive" name="is_active">
                                <option value="1" ${product.is_active == 1 ? 'selected' : ''}>활성</option>
                                <option value="0" ${product.is_active == 0 ? 'selected' : ''}>비활성</option>
                            </select>
                        </div>
                    </div>
                </form>
            `;

            Utils.openModal('제품 수정', modalContent, {
                size: 'large',
                footerContent: `
                    <button class="btn btn-secondary" onclick="Utils.closeModal()">취소</button>
                    <button class="btn btn-primary" onclick="Products.saveProduct(true)">
                        <i class="fas fa-save"></i> 수정 저장
                    </button>
                `
            });

        } catch (error) {
            Utils.hideLoading();
            console.error('제품 수정 모달 오류:', error);
            Utils.showToast('제품 정보를 불러오는 중 오류가 발생했습니다.', 'error');
        }
    },

    async deleteProduct(id) {
        const product = this.currentData.find(p => p.id === id);
        if (!product) return;

        const confirmed = await new Promise(resolve => {
            Utils.confirm(`정말로 제품 "${product.name}"을(를) 삭제하시겠습니까?`, resolve);
        });

        if (confirmed) {
            try {
                Utils.showLoading('제품을 삭제하는 중...');
                const response = await API.products.delete(id);
                Utils.hideLoading();

                if (response.success) {
                    Utils.showToast('제품이 성공적으로 삭제되었습니다.', 'success');
                    this.loadProducts();
                } else {
                    Utils.showToast(response.error || '제품 삭제에 실패했습니다.', 'error');
                }
            } catch (error) {
                Utils.hideLoading();
                Utils.showToast('제품 삭제 중 오류가 발생했습니다.', 'error');
            }
        }
    },

    exportData() {
        Utils.showToast('데이터 내보내기가 곧 구현될 예정입니다.', 'info');
    },

    async search(query) {
        this.currentFilters.search = query;
        this.currentPage = 1;
        this.loadProducts();
    },

    // 제품 저장
    async saveProduct(isEdit = false) {
        const form = document.getElementById(isEdit ? 'editProductForm' : 'addProductForm');
        if (!form) return;

        const formData = new FormData(form);
        const productData = Object.fromEntries(formData.entries());

        // 필수 필드 검증
        const requiredFields = ['product_code', 'name', 'category_id', 'supplier_id', 'unit', 'cost_price', 'sale_price'];
        const missingFields = requiredFields.filter(field => !productData[field]);

        if (missingFields.length > 0) {
            Utils.showToast('필수 필드를 모두 입력해주세요.', 'warning');
            return;
        }

        // 숫자 필드 변환
        productData.cost_price = parseFloat(productData.cost_price);
        productData.sale_price = parseFloat(productData.sale_price);
        productData.factory_profit = parseFloat(productData.factory_profit) || 0;
        productData.calculated_profit = parseFloat(productData.calculated_profit) || 0;
        productData.min_stock_level = parseInt(productData.min_stock_level) || 0;
        productData.max_stock_level = parseInt(productData.max_stock_level) || 0;
        productData.is_active = parseInt(productData.is_active);

        try {
            Utils.showLoading(isEdit ? '제품을 수정하는 중...' : '제품을 추가하는 중...');

            let response;
            if (isEdit) {
                const productId = productData.id;
                delete productData.id;
                response = await API.products.update(productId, productData);
            } else {
                response = await API.products.create(productData);
            }

            Utils.hideLoading();

            if (response.success) {
                Utils.closeModal();
                Utils.showToast(
                    isEdit ? '제품이 성공적으로 수정되었습니다.' : '제품이 성공적으로 추가되었습니다.',
                    'success'
                );
                this.loadProducts();
            } else {
                Utils.showToast(response.error || '제품 저장에 실패했습니다.', 'error');
            }
        } catch (error) {
            Utils.hideLoading();
            console.error('제품 저장 오류:', error);
            Utils.showToast('제품 저장 중 오류가 발생했습니다.', 'error');
        }
    },

    // 수익 자동 계산 함수
    calculateProfit(isEdit = false) {
        const prefix = isEdit ? 'edit' : '';
        const costPriceInput = document.getElementById(prefix + 'CostPrice');
        const salePriceInput = document.getElementById(prefix + 'SalePrice');
        const factoryProfitInput = document.getElementById(prefix + 'FactoryProfit');
        const calculatedProfitInput = document.getElementById(prefix + 'CalculatedProfit');

        if (!costPriceInput || !salePriceInput || !factoryProfitInput || !calculatedProfitInput) {
            return;
        }

        const costPrice = parseFloat(costPriceInput.value) || 0;
        const salePrice = parseFloat(salePriceInput.value) || 0;
        const factoryProfit = parseFloat(factoryProfitInput.value) || 0;

        // 수익 = 판매가 - 원가 - 공장수익
        const calculatedProfit = salePrice - costPrice - factoryProfit;
        const profitPercent = salePrice > 0 ? (calculatedProfit / salePrice * 100).toFixed(1) : 0;

        calculatedProfitInput.value = calculatedProfit.toFixed(2);

        // 수익률 표시 업데이트
        let profitPercentDisplay = calculatedProfitInput.parentNode.querySelector('.profit-percent');
        if (!profitPercentDisplay) {
            profitPercentDisplay = document.createElement('small');
            profitPercentDisplay.className = 'profit-percent';
            calculatedProfitInput.parentNode.appendChild(profitPercentDisplay);
        }
        profitPercentDisplay.textContent = `수익률: ${profitPercent}%`;

        // 수익에 따른 스타일 설정
        if (calculatedProfit < 0) {
            calculatedProfitInput.style.color = '#dc3545';
            calculatedProfitInput.style.fontWeight = 'bold';
            profitPercentDisplay.style.color = '#dc3545';
            profitPercentDisplay.textContent += ' (손실)';
        } else {
            calculatedProfitInput.style.color = '#28a745';
            calculatedProfitInput.style.fontWeight = 'bold';
            profitPercentDisplay.style.color = '#28a745';
        }
    }
};

// 전역으로 등록
window.Products = Products;

document.addEventListener('DOMContentLoaded', function() {
    if (window.App) {
        App.registerPage('products', Products);
    }
});