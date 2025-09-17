// 인증 관리 모듈
const Auth = {
    // 토큰 키
    TOKEN_KEY: 'miseane_auth_token',
    USER_KEY: 'miseane_user_data',

    // 현재 사용자 정보
    currentUser: null,

    // 초기화
    init: function() {
        console.log('Auth.init() called');

        // 잘못된 스토리지 데이터 정리
        this.clearInvalidStorage();

        this.currentUser = this.getStoredUser();
        console.log('Stored user from localStorage/sessionStorage:', this.currentUser);
        this.setupTokenRefresh();
    },

    // 잘못된 스토리지 데이터 정리
    clearInvalidStorage: function() {
        const token = localStorage.getItem(this.TOKEN_KEY) || sessionStorage.getItem(this.TOKEN_KEY);
        const user = localStorage.getItem(this.USER_KEY) || sessionStorage.getItem(this.USER_KEY);

        if (token === 'undefined' || token === 'null') {
            localStorage.removeItem(this.TOKEN_KEY);
            sessionStorage.removeItem(this.TOKEN_KEY);
        }

        if (user === 'undefined' || user === 'null') {
            localStorage.removeItem(this.USER_KEY);
            sessionStorage.removeItem(this.USER_KEY);
        }
    },

    // 로그인
    async login(email, password, remember = false) {
        try {
            Utils.showLoading('로그인 중...');

            const response = await API.auth.login({
                email: email.trim(),
                password: password
            });

            if (response.success) {
                console.log('Full response received:', response);
                const responseData = response.data;
                console.log('Response data:', responseData);

                const actualData = responseData.data || responseData;
                const { token, user } = actualData;
                console.log('Extracted token:', token);
                console.log('Extracted user data:', user);

                // 토큰 저장
                this.setToken(token, remember);
                this.setUser(user, remember);
                this.currentUser = user;
                console.log('currentUser set to:', this.currentUser);

                Utils.hideLoading();
                Utils.showToast('로그인되었습니다.', 'success');

                // 메인 화면으로 이동
                this.showMainApp();

                return { success: true };
            } else {
                Utils.hideLoading();
                Utils.showToast(response.error, 'error');
                return { success: false, error: response.error };
            }
        } catch (error) {
            Utils.hideLoading();
            Utils.showToast('로그인 중 오류가 발생했습니다.', 'error');
            return { success: false, error: '로그인 중 오류가 발생했습니다.' };
        }
    },

    // 로그아웃
    logout: function() {
        // 토큰 및 사용자 정보 제거
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
        sessionStorage.removeItem(this.TOKEN_KEY);
        sessionStorage.removeItem(this.USER_KEY);

        this.currentUser = null;

        // 로그인 화면 표시
        this.showLoginScreen();

        Utils.showToast('로그아웃되었습니다.', 'info');
    },

    // 토큰 저장
    setToken: function(token, persistent = false) {
        const storage = persistent ? localStorage : sessionStorage;
        storage.setItem(this.TOKEN_KEY, token);
    },

    // 토큰 가져오기
    getToken: function() {
        const token = localStorage.getItem(this.TOKEN_KEY) || sessionStorage.getItem(this.TOKEN_KEY);
        if (!token || token === 'undefined' || token === 'null') {
            return null;
        }
        return token;
    },

    // 사용자 정보 저장
    setUser: function(user, persistent = false) {
        const storage = persistent ? localStorage : sessionStorage;
        storage.setItem(this.USER_KEY, JSON.stringify(user));
    },

    // 저장된 사용자 정보 가져오기
    getStoredUser: function() {
        try {
            const userStr = localStorage.getItem(this.USER_KEY) || sessionStorage.getItem(this.USER_KEY);
            if (!userStr || userStr === 'undefined' || userStr === 'null') {
                return null;
            }
            return JSON.parse(userStr);
        } catch (error) {
            console.error('Error parsing stored user data:', error);
            // 잘못된 데이터 제거
            localStorage.removeItem(this.USER_KEY);
            sessionStorage.removeItem(this.USER_KEY);
            return null;
        }
    },

    // 사용자 정보 가져오기
    getCurrentUser: function() {
        return this.currentUser;
    },

    // 인증 상태 확인
    isAuthenticated: function() {
        const token = this.getToken();
        if (!this.currentUser) {
            this.currentUser = this.getStoredUser();
        }
        return !!token && !!this.currentUser;
    },

    // 권한 확인
    hasRole: function(role) {
        if (!this.currentUser) {
            this.currentUser = this.getStoredUser();
        }
        return this.currentUser && this.currentUser.role === role;
    },

    // 관리자 권한 확인
    isAdmin: function() {
        return this.hasRole('admin') || this.hasRole('superadmin');
    },

    // 구매담당자 권한 확인
    isPurchaser: function() {
        return this.hasRole('purchaser') || this.isAdmin();
    },

    // 창고담당자 권한 확인
    isWarehouse: function() {
        return this.hasRole('warehouse') || this.isAdmin();
    },

    // 품질담당자 권한 확인
    isQuality: function() {
        return this.hasRole('quality') || this.isAdmin();
    },

    // 토큰 검증
    verifyToken: async function() {
        const token = this.getToken();
        if (!token) {
            this.showLoginScreen();
            return false;
        }

        try {
            const response = await API.auth.verifyToken();

            if (response.success) {
                this.currentUser = response.data.user;
                this.setUser(response.data.user);
                return true;
            } else {
                this.logout();
                return false;
            }
        } catch (error) {
            this.logout();
            return false;
        }
    },

    // 토큰 자동 갱신 설정
    setupTokenRefresh: function() {
        // 30분마다 토큰 확인
        setInterval(async () => {
            if (this.isAuthenticated()) {
                await this.verifyToken();
            }
        }, 30 * 60 * 1000); // 30분
    },

    // 로그인 화면 표시
    showLoginScreen: function() {
        document.getElementById('loginContainer').style.display = 'flex';
        document.getElementById('appContainer').style.display = 'none';
        Utils.hideLoading();
    },

    // 메인 앱 표시
    showMainApp: function() {
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('appContainer').style.display = 'flex';

        // 사용자 정보 표시
        this.updateUserDisplay();

        // 관리자 메뉴 표시/숨기기
        this.updateMenuVisibility();

        // 대시보드 로드
        if (window.navigateTo) {
            navigateTo('dashboard');
        }

        // 알림 개수 업데이트
        this.updateNotificationCount();
    },

    // 사용자 표시 정보 업데이트
    updateUserDisplay: function() {
        if (!this.currentUser) return;

        const userNameElements = document.querySelectorAll('#userName');
        userNameElements.forEach(element => {
            element.textContent = this.currentUser.full_name || this.currentUser.username;
        });

        // 사용자 아바타 업데이트 (있을 경우)
        const userAvatarElements = document.querySelectorAll('.user-avatar');
        userAvatarElements.forEach(element => {
            if (this.currentUser.avatar) {
                element.src = this.currentUser.avatar;
            }
        });
    },

    // 메뉴 권한별 표시/숨기기
    updateMenuVisibility: function() {
        console.log('updateMenuVisibility called');

        // currentUser가 없으면 다시 로드 시도
        if (!this.currentUser) {
            this.currentUser = this.getStoredUser();
            console.log('Reloaded currentUser from storage:', this.currentUser);
        }

        console.log('currentUser:', this.currentUser);
        console.log('User role:', this.currentUser?.role);
        console.log('isAdmin():', this.isAdmin());

        const adminSection = document.getElementById('adminSection');
        if (adminSection) {
            const showAdmin = this.isAdmin();
            console.log('Setting adminSection display to:', showAdmin ? 'block' : 'none');
            adminSection.style.display = showAdmin ? 'block' : 'none';
        }

        // 권한별 메뉴 아이템 표시/숨기기
        this.updateMenuItemVisibility('suppliers', this.isPurchaser() || this.isAdmin());
        this.updateMenuItemVisibility('orders', this.isPurchaser() || this.isAdmin());
        this.updateMenuItemVisibility('inventory', this.isWarehouse() || this.isAdmin());
        this.updateMenuItemVisibility('shipments', this.isWarehouse() || this.isAdmin());
        this.updateMenuItemVisibility('quality', this.isQuality() || this.isAdmin());
    },

    // 메뉴 아이템 표시/숨기기
    updateMenuItemVisibility: function(menuName, hasPermission) {
        const menuItems = document.querySelectorAll(`[onclick="navigateTo('${menuName}')"]`);
        menuItems.forEach(item => {
            item.style.display = hasPermission ? 'block' : 'none';
        });
    },

    // 알림 개수 업데이트
    updateNotificationCount: async function() {
        try {
            const response = await API.notifications.getUnreadCount();
            if (response.success) {
                const badge = document.getElementById('notificationBadge');
                if (badge) {
                    const count = response.data.count || 0;
                    badge.textContent = count;
                    badge.style.display = count > 0 ? 'inline' : 'none';
                }
            }
        } catch (error) {
            console.error('알림 개수 업데이트 오류:', error);
        }
    },

    // 비밀번호 변경
    changePassword: async function(currentPassword, newPassword) {
        try {
            Utils.showLoading('비밀번호 변경 중...');

            const response = await API.auth.changePassword({
                current_password: currentPassword,
                new_password: newPassword
            });

            Utils.hideLoading();

            if (response.success) {
                Utils.showToast('비밀번호가 성공적으로 변경되었습니다.', 'success');
                return { success: true };
            } else {
                Utils.showToast(response.error, 'error');
                return { success: false, error: response.error };
            }
        } catch (error) {
            Utils.hideLoading();
            Utils.showToast('비밀번호 변경 중 오류가 발생했습니다.', 'error');
            return { success: false, error: '비밀번호 변경 중 오류가 발생했습니다.' };
        }
    },

    // 프로필 업데이트
    updateProfile: async function(profileData) {
        try {
            Utils.showLoading('프로필 업데이트 중...');

            const response = await API.auth.updateProfile(profileData);

            Utils.hideLoading();

            if (response.success) {
                // 사용자 정보 업데이트
                this.currentUser = { ...this.currentUser, ...response.data.user };
                this.setUser(this.currentUser);
                this.updateUserDisplay();

                Utils.showToast('프로필이 성공적으로 업데이트되었습니다.', 'success');
                return { success: true };
            } else {
                Utils.showToast(response.error, 'error');
                return { success: false, error: response.error };
            }
        } catch (error) {
            Utils.hideLoading();
            Utils.showToast('프로필 업데이트 중 오류가 발생했습니다.', 'error');
            return { success: false, error: '프로필 업데이트 중 오류가 발생했습니다.' };
        }
    }
};

// 로그인 폼 처리
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const remember = document.getElementById('rememberMe').checked;

            if (!email || !password) {
                Utils.showToast('이메일과 비밀번호를 모두 입력해주세요.', 'warning');
                return;
            }

            await Auth.login(email, password, remember);
        });
    }
});

// 전역 함수들
function logout() {
    Utils.confirm('로그아웃하시겠습니까?', () => {
        Auth.logout();
    });
}

function showProfile() {
    if (window.showProfileModal) {
        showProfileModal();
    }
}

function showSettings() {
    if (window.showSettingsModal) {
        showSettingsModal();
    }
}

// 사용자 메뉴 토글
document.addEventListener('DOMContentLoaded', function() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');

    if (userMenuBtn && userDropdown) {
        userMenuBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            userDropdown.classList.toggle('active');
            userDropdown.classList.toggle('show');
        });

        // 외부 클릭시 메뉴 닫기
        document.addEventListener('click', function() {
            userDropdown.classList.remove('active');
            userDropdown.classList.remove('show');
        });

        userDropdown.addEventListener('click', function(e) {
            e.stopPropagation();
        });
    }
});