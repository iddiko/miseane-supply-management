// 시스템 설정 페이지 모듈
const Settings = {
    async init() {
        const contentContainer = document.querySelector('.content-container');
        contentContainer.innerHTML = `
            <div class="page-header">
                <h1><i class="fas fa-cogs"></i> 시스템 설정</h1>
                <div class="page-actions">
                    <button class="btn btn-primary" onclick="Settings.saveAllSettings()">
                        <i class="fas fa-save"></i>
                        모든 설정 저장
                    </button>
                </div>
            </div>

            <div class="page-content">
                <!-- 설정 탭 -->
                <div class="settings-tabs">
                    <button class="tab-btn active" data-tab="general">일반 설정</button>
                    <button class="tab-btn" data-tab="distribution">배분 규칙</button>
                    <button class="tab-btn" data-tab="security">보안 설정</button>
                    <button class="tab-btn" data-tab="notification">알림 설정</button>
                    <button class="tab-btn" data-tab="backup">백업 설정</button>
                </div>

                <!-- 일반 설정 -->
                <div class="tab-content active" id="generalTab">
                    <div class="settings-section">
                        <h3><i class="fas fa-building"></i> 회사 정보</h3>
                        <div class="form-grid">
                            <div class="form-group">
                                <label>회사명</label>
                                <input type="text" id="companyName" value="㈜미세안" class="form-control">
                            </div>
                            <div class="form-group">
                                <label>사업자등록번호</label>
                                <input type="text" id="businessNumber" value="123-45-67890" class="form-control">
                            </div>
                            <div class="form-group">
                                <label>대표자명</label>
                                <input type="text" id="ceoName" value="김대표" class="form-control">
                            </div>
                            <div class="form-group">
                                <label>연락처</label>
                                <input type="tel" id="companyPhone" value="02-1234-5678" class="form-control">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>주소</label>
                            <textarea id="companyAddress" class="form-control" rows="2">서울특별시 강남구 테헤란로 123, 미세안빌딩 10층</textarea>
                        </div>
                    </div>

                    <div class="settings-section">
                        <h3><i class="fas fa-cog"></i> 시스템 설정</h3>
                        <div class="form-grid">
                            <div class="form-group">
                                <label>기본 통화</label>
                                <select id="defaultCurrency" class="form-control">
                                    <option value="KRW" selected>원 (KRW)</option>
                                    <option value="USD">달러 (USD)</option>
                                    <option value="EUR">유로 (EUR)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>시간대</label>
                                <select id="timezone" class="form-control">
                                    <option value="Asia/Seoul" selected>한국 표준시 (UTC+9)</option>
                                    <option value="UTC">협정 세계시 (UTC)</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>페이지당 항목 수</label>
                                <select id="itemsPerPage" class="form-control">
                                    <option value="10" selected>10개</option>
                                    <option value="20">20개</option>
                                    <option value="50">50개</option>
                                    <option value="100">100개</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>언어</label>
                                <select id="defaultLanguage" class="form-control">
                                    <option value="ko" selected>한국어</option>
                                    <option value="en">English</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 배분 규칙 설정 -->
                <div class="tab-content" id="distributionTab">
                    <div class="settings-section">
                        <h3><i class="fas fa-chart-pie"></i> 기본 배분 규칙</h3>
                        <div class="distribution-settings">
                            <div class="distribution-item">
                                <label>공장 (Factory)</label>
                                <div class="input-group">
                                    <input type="number" id="factoryPercentage" value="32" min="0" max="100" class="form-control">
                                    <span class="input-addon">%</span>
                                </div>
                            </div>
                            <div class="distribution-item">
                                <label>본사 (HQ)</label>
                                <div class="input-group">
                                    <input type="number" id="hqPercentage" value="3" min="0" max="100" class="form-control">
                                    <span class="input-addon">%</span>
                                </div>
                            </div>
                            <div class="distribution-item">
                                <label>지사 (Regional)</label>
                                <div class="input-group">
                                    <input type="number" id="regionalPercentage" value="25" min="0" max="100" class="form-control">
                                    <span class="input-addon">%</span>
                                </div>
                            </div>
                            <div class="distribution-item">
                                <label>지점 (Branch)</label>
                                <div class="input-group">
                                    <input type="number" id="branchPercentage" value="2" min="0" max="100" class="form-control">
                                    <span class="input-addon">%</span>
                                </div>
                            </div>
                            <div class="distribution-item">
                                <label>전국 (Nationwide)</label>
                                <div class="input-group">
                                    <input type="number" id="nationwidePercentage" value="2" min="0" max="100" class="form-control">
                                    <span class="input-addon">%</span>
                                </div>
                            </div>
                            <div class="distribution-item">
                                <label>지역 (Local)</label>
                                <div class="input-group">
                                    <input type="number" id="localPercentage" value="3" min="0" max="100" class="form-control">
                                    <span class="input-addon">%</span>
                                </div>
                            </div>
                            <div class="distribution-item">
                                <label>구역 (Area)</label>
                                <div class="input-group">
                                    <input type="number" id="areaPercentage" value="5" min="0" max="100" class="form-control">
                                    <span class="input-addon">%</span>
                                </div>
                            </div>
                            <div class="distribution-item">
                                <label>병원 (Hospital)</label>
                                <div class="input-group">
                                    <input type="number" id="hospitalPercentage" value="30" min="0" max="100" class="form-control">
                                    <span class="input-addon">%</span>
                                </div>
                            </div>
                        </div>
                        <div class="distribution-total">
                            <strong>총 배분율: <span id="totalPercentage">102</span>%</strong>
                            <small class="text-danger" id="percentageWarning">배분율 합계가 100%가 아닙니다</small>
                        </div>
                    </div>
                </div>

                <!-- 보안 설정 -->
                <div class="tab-content" id="securityTab">
                    <div class="settings-section">
                        <h3><i class="fas fa-shield-alt"></i> 비밀번호 정책</h3>
                        <div class="form-grid">
                            <div class="form-group">
                                <label>최소 길이</label>
                                <input type="number" id="minPasswordLength" value="8" min="4" max="32" class="form-control">
                            </div>
                            <div class="form-group">
                                <label>비밀번호 만료일</label>
                                <input type="number" id="passwordExpiry" value="90" min="0" max="365" class="form-control">
                                <small>0은 만료되지 않음</small>
                            </div>
                            <div class="form-group">
                                <label>로그인 시도 제한</label>
                                <input type="number" id="maxLoginAttempts" value="5" min="1" max="10" class="form-control">
                            </div>
                            <div class="form-group">
                                <label>세션 타임아웃 (분)</label>
                                <input type="number" id="sessionTimeout" value="60" min="5" max="480" class="form-control">
                            </div>
                        </div>

                        <div class="checkbox-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="requireUppercase" checked>
                                <span class="checkmark"></span>
                                대문자 포함 필수
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" id="requireLowercase" checked>
                                <span class="checkmark"></span>
                                소문자 포함 필수
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" id="requireNumbers" checked>
                                <span class="checkmark"></span>
                                숫자 포함 필수
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" id="requireSpecialChars" checked>
                                <span class="checkmark"></span>
                                특수문자 포함 필수
                            </label>
                        </div>
                    </div>
                </div>

                <!-- 알림 설정 -->
                <div class="tab-content" id="notificationTab">
                    <div class="settings-section">
                        <h3><i class="fas fa-bell"></i> 알림 설정</h3>
                        <div class="notification-settings">
                            <div class="notification-item">
                                <div class="notification-info">
                                    <strong>재고 부족 알림</strong>
                                    <p>재고가 최소 수준 이하로 떨어질 때 알림</p>
                                </div>
                                <label class="switch">
                                    <input type="checkbox" id="stockAlert" checked>
                                    <span class="slider round"></span>
                                </label>
                            </div>

                            <div class="notification-item">
                                <div class="notification-info">
                                    <strong>주문 승인 알림</strong>
                                    <p>새로운 주문이 승인 대기 중일 때 알림</p>
                                </div>
                                <label class="switch">
                                    <input type="checkbox" id="orderAlert" checked>
                                    <span class="slider round"></span>
                                </label>
                            </div>

                            <div class="notification-item">
                                <div class="notification-info">
                                    <strong>시스템 오류 알림</strong>
                                    <p>시스템 오류 발생 시 관리자에게 알림</p>
                                </div>
                                <label class="switch">
                                    <input type="checkbox" id="systemAlert" checked>
                                    <span class="slider round"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 백업 설정 -->
                <div class="tab-content" id="backupTab">
                    <div class="settings-section">
                        <h3><i class="fas fa-database"></i> 백업 설정</h3>
                        <div class="form-grid">
                            <div class="form-group">
                                <label>자동 백업</label>
                                <select id="autoBackup" class="form-control">
                                    <option value="disabled">비활성화</option>
                                    <option value="daily" selected>매일</option>
                                    <option value="weekly">매주</option>
                                    <option value="monthly">매월</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>백업 보관 기간 (일)</label>
                                <input type="number" id="backupRetention" value="30" min="1" max="365" class="form-control">
                            </div>
                            <div class="form-group">
                                <label>백업 시간</label>
                                <input type="time" id="backupTime" value="02:00" class="form-control">
                            </div>
                        </div>

                        <div class="backup-actions">
                            <button class="btn btn-secondary" onclick="Settings.createBackup()">
                                <i class="fas fa-download"></i>
                                수동 백업 생성
                            </button>
                            <button class="btn btn-secondary" onclick="Settings.restoreBackup()">
                                <i class="fas fa-upload"></i>
                                백업 복원
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
        this.updateDistributionTotal();
    },

    bindEvents() {
        // 탭 전환
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // 배분율 자동 계산
        document.querySelectorAll('[id$="Percentage"]').forEach(input => {
            input.addEventListener('input', () => {
                this.updateDistributionTotal();
            });
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

    updateDistributionTotal() {
        const percentageInputs = [
            'factoryPercentage', 'hqPercentage', 'regionalPercentage', 'branchPercentage',
            'nationwidePercentage', 'localPercentage', 'areaPercentage', 'hospitalPercentage'
        ];

        const total = percentageInputs.reduce((sum, id) => {
            const value = parseFloat(document.getElementById(id).value) || 0;
            return sum + value;
        }, 0);

        document.getElementById('totalPercentage').textContent = total;

        const warning = document.getElementById('percentageWarning');
        if (total === 100) {
            warning.style.display = 'none';
        } else {
            warning.style.display = 'block';
            warning.textContent = total > 100 ?
                `배분율이 ${total - 100}% 초과입니다` :
                `배분율이 ${100 - total}% 부족합니다`;
        }
    },

    saveAllSettings() {
        Utils.showToast('설정이 저장되었습니다', 'success');
    },

    createBackup() {
        Utils.showToast('백업을 생성하는 중...', 'info');
        setTimeout(() => {
            Utils.showToast('백업이 성공적으로 생성되었습니다', 'success');
        }, 2000);
    },

    restoreBackup() {
        Utils.showToast('백업 복원 기능이 곧 추가될 예정입니다', 'info');
    },

    async search(query) {
        Utils.showToast(`설정 검색: ${query}`, 'info');
    }
};

// 전역으로 등록
window.Settings = Settings;

document.addEventListener('DOMContentLoaded', function() {
    if (window.App) {
        App.registerPage('settings', Settings);
    }
});