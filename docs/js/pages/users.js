// 사용자 관리 페이지 모듈
const Users = {
    async init() {
        const contentContainer = document.querySelector('.content-container');
        contentContainer.innerHTML = `
            <div class="page-header">
                <h1><i class="fas fa-users"></i> 사용자 관리</h1>
                <div class="page-actions">
                    <button class="btn btn-primary" onclick="Users.showCreateModal()">
                        <i class="fas fa-user-plus"></i>
                        사용자 추가
                    </button>
                </div>
            </div>

            <div class="page-content">
                <!-- 사용자 통계 카드 -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-users"></i>
                        </div>
                        <div class="stat-info">
                            <h3 id="totalUsers">0</h3>
                            <p>전체 사용자</p>
                            <span class="stat-change neutral">활성</span>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-user-shield"></i>
                        </div>
                        <div class="stat-info">
                            <h3 id="adminUsers">0</h3>
                            <p>관리자</p>
                            <span class="stat-change positive">권한</span>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-user-clock"></i>
                        </div>
                        <div class="stat-info">
                            <h3 id="recentLogins">0</h3>
                            <p>최근 로그인</p>
                            <span class="stat-change positive">7일</span>
                        </div>
                    </div>

                    <div class="stat-card">
                        <div class="stat-icon">
                            <i class="fas fa-user-times"></i>
                        </div>
                        <div class="stat-info">
                            <h3 id="inactiveUsers">0</h3>
                            <p>비활성 사용자</p>
                            <span class="stat-change negative">관리필요</span>
                        </div>
                    </div>
                </div>

                <!-- 검색 및 필터 -->
                <div class="controls-section">
                    <div class="search-controls">
                        <div class="search-box">
                            <input type="text" id="userSearch" placeholder="사용자 검색...">
                            <i class="fas fa-search"></i>
                        </div>
                        <select id="roleFilter" class="form-select">
                            <option value="">모든 역할</option>
                            <option value="superadmin">시스템 관리자</option>
                            <option value="hq_admin">본사 관리자</option>
                            <option value="regional_admin">지사 관리자</option>
                            <option value="branch_admin">지점 관리자</option>
                            <option value="partner">협력사</option>
                            <option value="hospital_user">병원/요양원</option>
                            <option value="data_entry">데이터 입력</option>
                            <option value="auditor">회계/감사</option>
                        </select>
                        <select id="statusFilter" class="form-select">
                            <option value="">모든 상태</option>
                            <option value="1">활성</option>
                            <option value="0">비활성</option>
                        </select>
                    </div>
                </div>

                <!-- 사용자 테이블 -->
                <div class="table-section">
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>사용자 정보</th>
                                    <th>역할</th>
                                    <th>부서</th>
                                    <th>상태</th>
                                    <th>마지막 로그인</th>
                                    <th>생성일</th>
                                    <th>액션</th>
                                </tr>
                            </thead>
                            <tbody id="usersTableBody">
                                <tr>
                                    <td colspan="7" class="text-center">
                                        <div class="loading-spinner">
                                            <i class="fas fa-spinner fa-spin"></i>
                                            사용자 목록을 불러오는 중...
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- 페이지네이션 -->
                    <div class="pagination-container" id="usersPagination"></div>
                </div>
            </div>
        `;

        this.bindEvents();
        await this.loadUsers();
    },

    bindEvents() {
        // 검색
        document.getElementById('userSearch').addEventListener('input', (e) => {
            this.searchUsers(e.target.value);
        });

        // 필터
        document.getElementById('roleFilter').addEventListener('change', () => {
            this.loadUsers();
        });

        document.getElementById('statusFilter').addEventListener('change', () => {
            this.loadUsers();
        });
    },

    async loadUsers() {
        try {
            Utils.showLoading();

            // 임시 데이터 생성
            const users = [
                {
                    id: 1,
                    username: 'admin',
                    email: 'admin@miseane.com',
                    full_name: '시스템 관리자',
                    role: 'superadmin',
                    role_display: '시스템 관리자',
                    department: '시스템관리팀',
                    is_active: 1,
                    last_login: '2024-12-17 09:30:00',
                    created_at: '2024-01-01 00:00:00'
                },
                {
                    id: 2,
                    username: 'hq_manager',
                    email: 'hq@miseane.com',
                    full_name: '본사 관리자',
                    role: 'hq_admin',
                    role_display: '본사 관리자',
                    department: '영업관리팀',
                    is_active: 1,
                    last_login: '2024-12-16 18:45:00',
                    created_at: '2024-01-15 00:00:00'
                },
                {
                    id: 3,
                    username: 'region_seoul',
                    email: 'seoul@miseane.com',
                    full_name: '서울지사 관리자',
                    role: 'regional_admin',
                    role_display: '지사 관리자',
                    department: '서울지사',
                    is_active: 1,
                    last_login: '2024-12-16 17:20:00',
                    created_at: '2024-02-01 00:00:00'
                }
            ];

            this.updateStats(users);
            this.renderUsersTable(users);

        } catch (error) {
            console.error('사용자 목록 로딩 오류:', error);
            Utils.showToast('사용자 목록을 불러오는데 실패했습니다', 'error');
        } finally {
            Utils.hideLoading();
        }
    },

    updateStats(users) {
        document.getElementById('totalUsers').textContent = users.length;
        document.getElementById('adminUsers').textContent =
            users.filter(u => u.role.includes('admin')).length;
        document.getElementById('recentLogins').textContent =
            users.filter(u => u.last_login && new Date(u.last_login) > new Date(Date.now() - 7*24*60*60*1000)).length;
        document.getElementById('inactiveUsers').textContent =
            users.filter(u => !u.is_active).length;
    },

    renderUsersTable(users) {
        const tbody = document.getElementById('usersTableBody');

        if (users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">등록된 사용자가 없습니다</td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = users.map(user => `
            <tr>
                <td>
                    <div class="user-info">
                        <div class="user-avatar">
                            <i class="fas fa-user"></i>
                        </div>
                        <div class="user-details">
                            <div class="user-name">${user.full_name}</div>
                            <div class="user-email">${user.email}</div>
                            <div class="user-username">@${user.username}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="role-badge role-${user.role}">
                        ${user.role_display}
                    </span>
                </td>
                <td>${user.department || '-'}</td>
                <td>
                    <span class="status-badge ${user.is_active ? 'status-active' : 'status-inactive'}">
                        ${user.is_active ? '활성' : '비활성'}
                    </span>
                </td>
                <td>
                    ${user.last_login ? Utils.formatDateTime(user.last_login) : '로그인 기록 없음'}
                </td>
                <td>${Utils.formatDateTime(user.created_at)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-outline" onclick="Users.editUser(${user.id})" title="수정">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="Users.toggleUserStatus(${user.id})" title="${user.is_active ? '비활성화' : '활성화'}">
                            <i class="fas fa-${user.is_active ? 'ban' : 'check'}"></i>
                        </button>
                        <button class="btn btn-sm btn-outline" onclick="Users.resetPassword(${user.id})" title="비밀번호 재설정">
                            <i class="fas fa-key"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    showCreateModal() {
        Utils.showToast('사용자 생성 기능이 곧 추가될 예정입니다', 'info');
    },

    editUser(userId) {
        Utils.showToast(`사용자 ${userId} 편집 기능이 곧 추가될 예정입니다`, 'info');
    },

    toggleUserStatus(userId) {
        Utils.showToast(`사용자 ${userId} 상태 변경 기능이 곧 추가될 예정입니다`, 'info');
    },

    resetPassword(userId) {
        Utils.showToast(`사용자 ${userId} 비밀번호 재설정 기능이 곧 추가될 예정입니다`, 'info');
    },

    searchUsers(query) {
        // 실제로는 API 호출로 검색
        Utils.showToast(`사용자 검색: ${query}`, 'info');
    },

    async search(query) {
        this.searchUsers(query);
    }
};

// 전역으로 등록
window.Users = Users;

document.addEventListener('DOMContentLoaded', function() {
    if (window.App) {
        App.registerPage('users', Users);
    }
});