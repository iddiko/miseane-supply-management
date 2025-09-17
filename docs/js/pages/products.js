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

        // 초기 데이터 로드
        await this.loadCategories();
        await this.loadSuppliers();
        await this.loadProducts();

        // 이벤트 리스너 설정
        this.setupEventListeners();
    },

    getTemplate() {
        return `
            <div class="page-header">
                <h1>제품 관리</h1>
                <div class="page-actions">
                    <button class="btn btn-primary" onclick="Products.showAddModal()">
                        <i class="fas fa-plus"></i>
                        제품 추가
                    </button>
                    <button class="btn btn-secondary" onclick="Products.exportData()">
                        <i class="fas fa-download"></i>
                        내보내기
                    </button>
                </div>
            </div>

            <div class="page-content">
                <!-- 필터 섹션 -->
                <div class="card mb-4">
                    <div class="card-header">
                        <h3>필터</h3>
                    </div>
                    <div class="card-content">
                        <div class="filter-form">
                            <div class="form-row">
                                <div class="form-group">
                                    <label>검색</label>
                                    <input type="text" id="searchInput" placeholder="제품명, 제품코드 검색...">
                                </div>
                                <div class="form-group">
                                    <label>카테고리</label>
                                    <select id="categoryFilter">
                                        <option value="">전체</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>공급업체</label>
                                    <select id="supplierFilter">
                                        <option value="">전체</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>상태</label>
                                    <select id="statusFilter">
                                        <option value="">전체</option>
                                        <option value="1" selected>활성</option>
                                        <option value="0">비활성</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <button class="btn btn-primary" onclick="Products.applyFilters()">
                                        <i class="fas fa-search"></i>
                                        검색
                                    </button>
                                    <button class="btn btn-secondary" onclick="Products.resetFilters()">
                                        <i class="fas fa-undo"></i>
                                        초기화
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 제품 테이블 -->
                <div class="card">
                    <div class="card-header">
                        <h3>제품 목록</h3>
                        <div class="card-actions">
                            <span id="totalCount">총 0개</span>
                        </div>
                    </div>
                    <div class="card-content">
                        <div class="table-responsive">
                            <table class="table" id="productsTable">
                                <thead>
                                    <tr>
                                        <th>제품코드</th>
                                        <th>제품명</th>
                                        <th>카테고리</th>
                                        <th>공급업체</th>
                                        <th>단위</th>
                                        <th>가격정보</th>
                                        <th>재고</th>
                                        <th>등록자</th>
                                        <th>상태</th>
                                        <th>등록일</th>
                                        <th>작업</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td colspan="11" class="text-center">로딩 중...</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- 페이지네이션 -->
                        <div class="pagination-wrapper">
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

        if (this.currentData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="text-center">등록된 제품이 없습니다.</td></tr>';
            return;
        }

        tbody.innerHTML = this.currentData.map(product => `
            <tr>
                <td><strong>${product.product_code}</strong></td>
                <td>
                    <div class="product-info">
                        <strong>${product.name}</strong>
                        ${product.description ? `<br><small class="text-muted">${product.description}</small>` : ''}
                    </div>
                </td>
                <td><span class="badge badge-info">${product.category_name || '-'}</span></td>
                <td>${product.supplier_name || '-'}</td>
                <td>${product.unit}</td>
                <td class="text-right">
                    <div class="price-info">
                        <strong>₩${Utils.formatNumber(product.sale_price || 0)}</strong><br>
                        <small class="text-muted">원가: ₩${Utils.formatNumber(product.cost_price || 0)}</small><br>
                        <small class="text-success">수익: ₩${Utils.formatNumber(product.calculated_profit || 0)}</small>
                    </div>
                </td>
                <td class="text-right">
                    <span class="stock-level ${this.getStockStatusClass(product)}">
                        ${Utils.formatNumber(product.available_stock || 0)}
                    </span>
                </td>
                <td>
                    <div class="creator-info">
                        <strong>${product.created_by_name || '시스템'}</strong>
                        <br><small class="text-muted">${product.created_by_email || '-'}</small>
                    </div>
                </td>
                <td>
                    <span class="badge ${product.is_active ? 'badge-success' : 'badge-secondary'}">
                        ${product.is_active ? '활성' : '비활성'}
                    </span>
                </td>
                <td>${Utils.formatDate(product.created_at)}</td>
                <td class="actions">
                    <button class="btn btn-sm btn-info" onclick="Products.showDetailsModal(${product.id})" title="상세보기">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="Products.showEditModal(${product.id})" title="수정">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="Products.deleteProduct(${product.id})" title="삭제">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
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
        this.currentPage = 1;
        this.loadProducts();
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

        calculatedProfitInput.value = calculatedProfit.toFixed(2);

        // 수익이 음수인 경우 경고 표시
        if (calculatedProfit < 0) {
            calculatedProfitInput.style.color = '#dc3545'; // 빨간색
            calculatedProfitInput.style.fontWeight = 'bold';
        } else {
            calculatedProfitInput.style.color = '#28a745'; // 초록색
            calculatedProfitInput.style.fontWeight = 'bold';
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