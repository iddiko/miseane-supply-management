// 공급업체 관리 페이지 모듈
const Suppliers = {
    // 현재 데이터
    currentData: [],
    currentPage: 1,
    totalPages: 1,
    pageSize: 10,

    // 초기화
    async init() {
        const contentContainer = document.querySelector('.content-container');
        contentContainer.innerHTML = this.getTemplate();

        // 통계 데이터 로드
        await this.loadStatistics();

        // 데이터 로드
        await this.loadSuppliers();

        // 이벤트 리스너 설정
        this.setupEventListeners();
    },

    // 템플릿 반환
    getTemplate() {
        return `
            <div class="page-header">
                <div>
                    <h1 class="dashboard-title">공급업체 관리</h1>
                    <p class="dashboard-subtitle">공급업체 정보를 통합 관리합니다</p>
                </div>
                <div class="page-actions">
                    <button class="btn btn-secondary" onclick="Suppliers.exportData()">
                        <i class="fas fa-download"></i> 내보내기
                    </button>
                    <button class="btn btn-primary" onclick="Suppliers.showAddModal()">
                        <i class="fas fa-plus"></i> 공급업체 추가
                    </button>
                </div>
            </div>

            <!-- 통계 카드 섹션 -->
            <div class="stats-grid" style="margin-bottom: 2rem;">
                <div class="stat-card suppliers">
                    <div class="stat-header">
                        <div class="stat-title">전체 공급업체</div>
                        <div class="stat-icon">
                            <i class="fas fa-building"></i>
                        </div>
                    </div>
                    <div class="stat-value" id="totalSuppliers">-</div>
                    <div class="stat-change neutral">
                        <i class="fas fa-equals"></i>
                        <span>전체 등록업체</span>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-title">활성 업체</div>
                        <div class="stat-icon" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%);">
                            <i class="fas fa-check-circle"></i>
                        </div>
                    </div>
                    <div class="stat-value" id="activeSuppliers">-</div>
                    <div class="stat-change positive">
                        <i class="fas fa-arrow-up"></i>
                        <span id="activePercentage">-</span>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-title">평균 평점</div>
                        <div class="stat-icon" style="background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%);">
                            <i class="fas fa-star"></i>
                        </div>
                    </div>
                    <div class="stat-value" id="averageRating">-</div>
                    <div class="stat-change neutral">
                        <i class="fas fa-star"></i>
                        <span>5점 만점</span>
                    </div>
                </div>

                <div class="stat-card">
                    <div class="stat-header">
                        <div class="stat-title">이번 달 신규</div>
                        <div class="stat-icon" style="background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%);">
                            <i class="fas fa-plus-circle"></i>
                        </div>
                    </div>
                    <div class="stat-value" id="newSuppliers">-</div>
                    <div class="stat-change positive">
                        <i class="fas fa-arrow-up"></i>
                        <span>신규 등록</span>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h2>공급업체 목록</h2>
                    <div class="card-header-actions">
                        <div class="search-container">
                            <div class="search-box">
                                <i class="fas fa-search"></i>
                                <input type="text" id="supplierSearch" placeholder="공급업체명, 담당자, 연락처로 검색...">
                                <button type="button" class="clear-search" onclick="Suppliers.clearSearch()">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                        <div class="filter-container">
                            <select id="statusFilter" class="filter-select">
                                <option value="">전체 상태</option>
                                <option value="active">활성</option>
                                <option value="inactive">비활성</option>
                            </select>
                            <select id="ratingFilter" class="filter-select">
                                <option value="">전체 등급</option>
                                <option value="5">⭐⭐⭐⭐⭐ 5점</option>
                                <option value="4">⭐⭐⭐⭐ 4점 이상</option>
                                <option value="3">⭐⭐⭐ 3점 이상</option>
                                <option value="2">⭐⭐ 2점 이상</option>
                                <option value="1">⭐ 1점 이상</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table" id="suppliersTable">
                            <thead>
                                <tr>
                                    <th class="sortable" onclick="Suppliers.sortTable('company_name')">
                                        <span>업체 정보</span>
                                        <i class="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th class="sortable" onclick="Suppliers.sortTable('contact_person')">
                                        <span>담당자 정보</span>
                                        <i class="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th class="sortable" onclick="Suppliers.sortTable('rating')">
                                        <span>평점</span>
                                        <i class="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th class="sortable" onclick="Suppliers.sortTable('status')">
                                        <span>상태</span>
                                        <i class="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th class="sortable" onclick="Suppliers.sortTable('created_at')">
                                        <span>등록일</span>
                                        <i class="fas fa-sort sort-icon"></i>
                                    </th>
                                    <th style="width: 120px;">작업</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td colspan="6" class="text-center py-4">
                                        <div class="loading-spinner">
                                            <i class="fas fa-spinner fa-spin"></i>
                                            <span>데이터를 불러오는 중...</span>
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
        const searchInput = document.getElementById('supplierSearch');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce(() => {
                this.searchSuppliers();
            }, 300));
        }

        // 필터 변경
        const statusFilter = document.getElementById('statusFilter');
        const ratingFilter = document.getElementById('ratingFilter');

        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.loadSuppliers());
        }

        if (ratingFilter) {
            ratingFilter.addEventListener('change', () => this.loadSuppliers());
        }
    },

    // 공급업체 목록 로드
    async loadSuppliers(page = 1) {
        try {
            const searchQuery = document.getElementById('supplierSearch').value;
            const statusFilter = document.getElementById('statusFilter').value;
            const ratingFilter = document.getElementById('ratingFilter').value;

            const params = {
                page,
                limit: this.pageSize,
                search: searchQuery,
                status: statusFilter,
                rating: ratingFilter
            };

            const response = await API.suppliers.getAll(params);

            if (response.success) {
                this.currentData = response.data.suppliers || [];
                this.currentPage = response.data.currentPage || 1;
                this.totalPages = response.data.totalPages || 1;

                this.renderTable();
                this.updatePagination();
            } else {
                Utils.showToast(response.error, 'error');
                this.renderEmptyTable();
            }
        } catch (error) {
            console.error('공급업체 로드 오류:', error);
            Utils.showToast('공급업체 목록을 불러올 수 없습니다.', 'error');
            this.renderEmptyTable();
        }
    },

    // 테이블 렌더링
    renderTable() {
        const tbody = document.querySelector('#suppliersTable tbody');
        if (!tbody) return;

        if (this.currentData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-5">
                        <div class="empty-state">
                            <i class="fas fa-building fa-3x text-muted mb-3"></i>
                            <h3 class="text-muted">공급업체가 없습니다</h3>
                            <p class="text-muted">새로운 공급업체를 추가해보세요.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.currentData.map(supplier => `
            <tr class="supplier-row" data-supplier-id="${supplier.id}">
                <td>
                    <div class="supplier-info-cell">
                        <div class="supplier-avatar">
                            <i class="fas fa-building"></i>
                        </div>
                        <div class="supplier-details">
                            <div class="supplier-name">${supplier.company_name || '-'}</div>
                            <div class="supplier-code text-muted">${supplier.supplier_code || 'SUP-' + supplier.id?.toString().padStart(3, '0')}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="contact-info">
                        <div class="contact-person">
                            <i class="fas fa-user text-muted me-1"></i>
                            ${supplier.contact_person || '-'}
                        </div>
                        <div class="contact-details text-muted">
                            <div><i class="fas fa-phone me-1"></i>${supplier.phone || '-'}</div>
                            <div><i class="fas fa-envelope me-1"></i>${supplier.email || '-'}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="rating-cell">
                        <div class="stars">${this.renderStars(supplier.rating || 0)}</div>
                        <div class="rating-number">${(supplier.rating || 0).toFixed(1)}/5.0</div>
                    </div>
                </td>
                <td>
                    <span class="status-badge ${supplier.is_active ? 'status-active' : 'status-inactive'}">
                        <i class="fas fa-circle"></i>
                        ${supplier.is_active ? '활성' : '비활성'}
                    </span>
                </td>
                <td>
                    <span class="text-muted">${Utils.formatDate(supplier.created_at, 'YYYY-MM-DD')}</span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-outline" onclick="Suppliers.showDetailModal(${supplier.id})" title="상세보기">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="Suppliers.showEditModal(${supplier.id})" title="수정">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline btn-danger" onclick="Suppliers.deleteSupplier(${supplier.id})" title="삭제">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    // 빈 테이블 렌더링
    renderEmptyTable() {
        const tbody = document.querySelector('#suppliersTable tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="no-data">공급업체를 불러올 수 없습니다.</td></tr>';
        }
    },

    // 별점 렌더링
    renderStars(rating) {
        const fullStars = Math.floor(rating);
        const halfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

        let stars = '';

        // 채워진 별
        for (let i = 0; i < fullStars; i++) {
            stars += '<i class="fas fa-star"></i>';
        }

        // 반 별
        if (halfStar) {
            stars += '<i class="fas fa-star-half-alt"></i>';
        }

        // 빈 별
        for (let i = 0; i < emptyStars; i++) {
            stars += '<i class="far fa-star"></i>';
        }

        return stars;
    },

    // 페이지네이션 업데이트
    updatePagination() {
        const paginationInfo = document.getElementById('paginationInfo');
        const paginationContainer = document.getElementById('pagination');

        if (paginationInfo) {
            const start = (this.currentPage - 1) * this.pageSize + 1;
            const end = Math.min(this.currentPage * this.pageSize, this.currentData.length);
            paginationInfo.textContent = `${start}-${end} / 총 ${this.currentData.length}개`;
        }

        if (paginationContainer) {
            Utils.createPagination(paginationContainer, this.totalPages, this.currentPage, (page) => {
                this.loadSuppliers(page);
            });
        }
    },

    // 검색
    async searchSuppliers() {
        await this.loadSuppliers(1);
    },

    // 검색 기능 (전역 검색에서 호출)
    async search(query) {
        const searchInput = document.getElementById('supplierSearch');
        if (searchInput) {
            searchInput.value = query;
            await this.searchSuppliers();
        }
    },

    // 테이블 정렬
    sortTable(column) {
        const table = document.getElementById('suppliersTable');
        Utils.sortTable(table, column);
    },

    // 추가 모달 표시
    showAddModal() {
        const content = `
            <form id="supplierForm">
                <div class="form-grid">
                    <div class="form-group">
                        <label for="companyName">회사명 *</label>
                        <input type="text" id="companyName" name="company_name" required>
                    </div>
                    <div class="form-group">
                        <label for="contactPerson">담당자명</label>
                        <input type="text" id="contactPerson" name="contact_person">
                    </div>
                    <div class="form-group">
                        <label for="phone">전화번호</label>
                        <input type="tel" id="phone" name="phone">
                    </div>
                    <div class="form-group">
                        <label for="email">이메일</label>
                        <input type="email" id="email" name="email">
                    </div>
                    <div class="form-group">
                        <label for="address">주소</label>
                        <input type="text" id="address" name="address">
                    </div>
                    <div class="form-group">
                        <label for="status">상태</label>
                        <select id="status" name="status">
                            <option value="active">활성</option>
                            <option value="inactive">비활성</option>
                        </select>
                    </div>
                </div>
            </form>
        `;

        Utils.openModal('공급업체 추가', content, {
            footerContent: `
                <button class="btn btn-secondary" onclick="Utils.closeModal()">취소</button>
                <button class="btn btn-primary" onclick="Suppliers.saveSupplier()">저장</button>
            `
        });
    },

    // 공급업체 저장
    async saveSupplier() {
        const form = document.getElementById('supplierForm');
        if (!form) return;

        const formData = new FormData(form);
        const supplierData = Object.fromEntries(formData.entries());

        try {
            Utils.showLoading('공급업체 저장 중...');

            const response = await API.suppliers.create(supplierData);

            Utils.hideLoading();

            if (response.success) {
                Utils.closeModal();
                Utils.showToast('공급업체가 추가되었습니다.', 'success');
                await this.loadSuppliers(this.currentPage);
            } else {
                Utils.showToast(response.error, 'error');
            }
        } catch (error) {
            Utils.hideLoading();
            Utils.showToast('공급업체 저장 중 오류가 발생했습니다.', 'error');
        }
    },

    // 수정 모달 표시
    async showEditModal(id) {
        try {
            Utils.showLoading('공급업체 정보 로딩 중...');

            const response = await API.suppliers.getById(id);

            Utils.hideLoading();

            if (response.success) {
                const supplier = response.data;

                const content = `
                    <form id="supplierEditForm">
                        <input type="hidden" name="id" value="${supplier.id}">
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="editCompanyName">회사명 *</label>
                                <input type="text" id="editCompanyName" name="company_name" value="${supplier.company_name || ''}" required>
                            </div>
                            <div class="form-group">
                                <label for="editContactPerson">담당자명</label>
                                <input type="text" id="editContactPerson" name="contact_person" value="${supplier.contact_person || ''}">
                            </div>
                            <div class="form-group">
                                <label for="editPhone">전화번호</label>
                                <input type="tel" id="editPhone" name="phone" value="${supplier.phone || ''}">
                            </div>
                            <div class="form-group">
                                <label for="editEmail">이메일</label>
                                <input type="email" id="editEmail" name="email" value="${supplier.email || ''}">
                            </div>
                            <div class="form-group">
                                <label for="editAddress">주소</label>
                                <input type="text" id="editAddress" name="address" value="${supplier.address || ''}">
                            </div>
                            <div class="form-group">
                                <label for="editStatus">상태</label>
                                <select id="editStatus" name="status">
                                    <option value="active" ${supplier.status === 'active' ? 'selected' : ''}>활성</option>
                                    <option value="inactive" ${supplier.status === 'inactive' ? 'selected' : ''}>비활성</option>
                                </select>
                            </div>
                        </div>
                    </form>
                `;

                Utils.openModal('공급업체 수정', content, {
                    footerContent: `
                        <button class="btn btn-secondary" onclick="Utils.closeModal()">취소</button>
                        <button class="btn btn-primary" onclick="Suppliers.updateSupplier()">수정</button>
                    `
                });
            } else {
                Utils.showToast(response.error, 'error');
            }
        } catch (error) {
            Utils.hideLoading();
            Utils.showToast('공급업체 정보를 불러올 수 없습니다.', 'error');
        }
    },

    // 공급업체 수정
    async updateSupplier() {
        const form = document.getElementById('supplierEditForm');
        if (!form) return;

        const formData = new FormData(form);
        const supplierData = Object.fromEntries(formData.entries());
        const id = supplierData.id;

        delete supplierData.id;

        try {
            Utils.showLoading('공급업체 수정 중...');

            const response = await API.suppliers.update(id, supplierData);

            Utils.hideLoading();

            if (response.success) {
                Utils.closeModal();
                Utils.showToast('공급업체가 수정되었습니다.', 'success');
                await this.loadSuppliers(this.currentPage);
            } else {
                Utils.showToast(response.error, 'error');
            }
        } catch (error) {
            Utils.hideLoading();
            Utils.showToast('공급업체 수정 중 오류가 발생했습니다.', 'error');
        }
    },

    // 공급업체 삭제
    async deleteSupplier(id) {
        Utils.confirm('이 공급업체를 삭제하시겠습니까?', async () => {
            try {
                Utils.showLoading('공급업체 삭제 중...');

                const response = await API.suppliers.delete(id);

                Utils.hideLoading();

                if (response.success) {
                    Utils.showToast('공급업체가 삭제되었습니다.', 'success');
                    await this.loadSuppliers(this.currentPage);
                } else {
                    Utils.showToast(response.error, 'error');
                }
            } catch (error) {
                Utils.hideLoading();
                Utils.showToast('공급업체 삭제 중 오류가 발생했습니다.', 'error');
            }
        });
    },

    // 상세 정보 모달
    async showDetailModal(id) {
        try {
            Utils.showLoading('공급업체 정보 로딩 중...');

            const response = await API.suppliers.getById(id);

            Utils.hideLoading();

            if (response.success) {
                const supplier = response.data.supplier || response.data;

                const content = `
                    <div class="supplier-detail-container">
                        <div class="supplier-header">
                            <div class="supplier-avatar-large">
                                <i class="fas fa-building"></i>
                            </div>
                            <div class="supplier-title">
                                <h2>${supplier.company_name || '-'}</h2>
                                <p class="supplier-code">${supplier.supplier_code || 'SUP-' + supplier.id?.toString().padStart(3, '0')}</p>
                            </div>
                            <div class="supplier-status">
                                <span class="status-badge ${supplier.is_active ? 'status-active' : 'status-inactive'}">
                                    <i class="fas fa-circle"></i>
                                    ${supplier.is_active ? '활성' : '비활성'}
                                </span>
                            </div>
                        </div>

                        <div class="detail-tabs">
                            <div class="tab-headers">
                                <button class="tab-header active" onclick="Suppliers.switchTab(event, 'basic')">기본 정보</button>
                                <button class="tab-header" onclick="Suppliers.switchTab(event, 'contact')">연락처</button>
                                <button class="tab-header" onclick="Suppliers.switchTab(event, 'performance')">성과</button>
                            </div>

                            <div class="tab-content active" id="basic">
                                <div class="detail-grid">
                                    <div class="detail-group">
                                        <label><i class="fas fa-building"></i> 회사명</label>
                                        <div class="detail-value">${supplier.company_name || '-'}</div>
                                    </div>
                                    <div class="detail-group">
                                        <label><i class="fas fa-tag"></i> 공급업체 코드</label>
                                        <div class="detail-value">${supplier.supplier_code || 'SUP-' + supplier.id?.toString().padStart(3, '0')}</div>
                                    </div>
                                    <div class="detail-group">
                                        <label><i class="fas fa-map-marker-alt"></i> 주소</label>
                                        <div class="detail-value">${supplier.address || '-'}</div>
                                    </div>
                                    <div class="detail-group">
                                        <label><i class="fas fa-calendar-alt"></i> 등록일</label>
                                        <div class="detail-value">${Utils.formatDate(supplier.created_at, 'YYYY-MM-DD HH:mm')}</div>
                                    </div>
                                </div>
                            </div>

                            <div class="tab-content" id="contact">
                                <div class="detail-grid">
                                    <div class="detail-group">
                                        <label><i class="fas fa-user"></i> 담당자명</label>
                                        <div class="detail-value">${supplier.contact_person || '-'}</div>
                                    </div>
                                    <div class="detail-group">
                                        <label><i class="fas fa-phone"></i> 전화번호</label>
                                        <div class="detail-value">
                                            ${supplier.phone ? `<a href="tel:${supplier.phone}">${supplier.phone}</a>` : '-'}
                                        </div>
                                    </div>
                                    <div class="detail-group">
                                        <label><i class="fas fa-envelope"></i> 이메일</label>
                                        <div class="detail-value">
                                            ${supplier.email ? `<a href="mailto:${supplier.email}">${supplier.email}</a>` : '-'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="tab-content" id="performance">
                                <div class="performance-grid">
                                    <div class="performance-card">
                                        <div class="performance-icon">
                                            <i class="fas fa-star"></i>
                                        </div>
                                        <div class="performance-info">
                                            <div class="performance-title">평균 평점</div>
                                            <div class="performance-value">${(supplier.rating || 0).toFixed(1)}/5.0</div>
                                            <div class="performance-detail">
                                                <div class="stars">${this.renderStars(supplier.rating || 0)}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="performance-card">
                                        <div class="performance-icon">
                                            <i class="fas fa-box"></i>
                                        </div>
                                        <div class="performance-info">
                                            <div class="performance-title">공급 제품 수</div>
                                            <div class="performance-value">${supplier.product_count || 0}</div>
                                            <div class="performance-detail">개 제품</div>
                                        </div>
                                    </div>
                                    <div class="performance-card">
                                        <div class="performance-icon">
                                            <i class="fas fa-truck"></i>
                                        </div>
                                        <div class="performance-info">
                                            <div class="performance-title">총 공급 건수</div>
                                            <div class="performance-value">${supplier.order_count || 0}</div>
                                            <div class="performance-detail">건 공급</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                Utils.openModal('공급업체 상세정보', content, {
                    size: 'large',
                    footerContent: `
                        <button class="btn btn-secondary" onclick="Utils.closeModal()">닫기</button>
                        <button class="btn btn-primary" onclick="Suppliers.showEditModal(${supplier.id}); Utils.closeModal();">수정</button>
                    `
                });
            } else {
                Utils.showToast(response.error || '공급업체 정보를 불러올 수 없습니다.', 'error');
            }
        } catch (error) {
            Utils.hideLoading();
            Utils.showToast('공급업체 정보를 불러올 수 없습니다.', 'error');
        }
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

    // 검색 클리어
    clearSearch() {
        const searchInput = document.getElementById('supplierSearch');
        if (searchInput) {
            searchInput.value = '';
            this.loadSuppliers(1);
        }
    },

    // 데이터 내보내기
    async exportData() {
        try {
            Utils.showLoading('데이터 내보내는 중...');

            const response = await API.suppliers.getAll({ export: true });

            if (response.success) {
                const data = response.data.suppliers || [];
                Utils.exportToCSV(data, 'suppliers', [
                    { key: 'company_name', label: '회사명' },
                    { key: 'contact_person', label: '담당자' },
                    { key: 'phone', label: '전화번호' },
                    { key: 'email', label: '이메일' },
                    { key: 'address', label: '주소' },
                    { key: 'rating', label: '평점' },
                    { key: 'is_active', label: '상태', format: (value) => value ? '활성' : '비활성' },
                    { key: 'created_at', label: '등록일', format: (value) => Utils.formatDate(value, 'YYYY-MM-DD') }
                ]);
                Utils.showToast('데이터가 성공적으로 내보내졌습니다.', 'success');
            } else {
                Utils.showToast(response.error || '데이터 내보내기에 실패했습니다.', 'error');
            }

            Utils.hideLoading();
        } catch (error) {
            Utils.hideLoading();
            Utils.showToast('데이터 내보내기 중 오류가 발생했습니다.', 'error');
        }
    },

    // 통계 데이터 로드
    async loadStatistics() {
        try {
            const response = await API.suppliers.getAll({ stats: true });

            if (response.success) {
                const stats = response.data.statistics || {};

                // 전체 공급업체 수
                const totalElement = document.getElementById('totalSuppliers');
                if (totalElement) {
                    totalElement.textContent = stats.total || 0;
                }

                // 활성 업체 수
                const activeElement = document.getElementById('activeSuppliers');
                const activePercentageElement = document.getElementById('activePercentage');
                if (activeElement && activePercentageElement) {
                    const activeCount = stats.active || 0;
                    const total = stats.total || 0;
                    const percentage = total > 0 ? Math.round((activeCount / total) * 100) : 0;

                    activeElement.textContent = activeCount;
                    activePercentageElement.textContent = `${percentage}%`;
                }

                // 평균 평점
                const ratingElement = document.getElementById('averageRating');
                if (ratingElement) {
                    ratingElement.textContent = (stats.average_rating || 0).toFixed(1);
                }

                // 신규 업체 수
                const newElement = document.getElementById('newSuppliers');
                if (newElement) {
                    newElement.textContent = stats.new_this_month || 0;
                }
            }
        } catch (error) {
            console.error('통계 로드 오류:', error);
        }
    }
};

// 전역으로 등록
window.Suppliers = Suppliers;

// 페이지 모듈 등록
document.addEventListener('DOMContentLoaded', function() {
    if (window.App) {
        App.registerPage('suppliers', Suppliers);
    }
});