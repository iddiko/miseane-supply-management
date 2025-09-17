// 유틸리티 함수들
const Utils = {
    // 날짜 포맷팅
    formatDate: function(date, format = 'YYYY-MM-DD') {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');

        switch (format) {
            case 'YYYY-MM-DD':
                return `${year}-${month}-${day}`;
            case 'YYYY-MM-DD HH:mm':
                return `${year}-${month}-${day} ${hours}:${minutes}`;
            case 'MM/DD/YYYY':
                return `${month}/${day}/${year}`;
            default:
                return `${year}-${month}-${day}`;
        }
    },

    // 숫자 포맷팅 (천단위 구분)
    formatNumber: function(num) {
        if (num === null || num === undefined) return '0';
        return Number(num).toLocaleString('ko-KR');
    },

    // 통화 포맷팅
    formatCurrency: function(amount) {
        if (amount === null || amount === undefined) return '₩0';
        return '₩' + Number(amount).toLocaleString('ko-KR');
    },

    // 문자열 자르기
    truncateText: function(text, length = 50) {
        if (!text) return '';
        return text.length > length ? text.substring(0, length) + '...' : text;
    },

    // 이메일 유효성 검사
    isValidEmail: function(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    // 전화번호 유효성 검사
    isValidPhone: function(phone) {
        const phoneRegex = /^(\+82|0)?1[0-9]{1}-?[0-9]{4}-?[0-9]{4}$/;
        return phoneRegex.test(phone.replace(/\s/g, ''));
    },

    // 로딩 스피너 표시
    showLoading: function(message = '로딩 중...') {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.querySelector('p').textContent = message;
            loadingScreen.style.display = 'flex';
        }
    },

    // 로딩 스피너 숨기기
    hideLoading: function() {
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    },

    // 토스트 메시지 표시
    showToast: function(message, type = 'info', duration = 3000) {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${this.getToastIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        toastContainer.appendChild(toast);

        // 자동 제거
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, duration);
    },

    // 토스트 아이콘 반환
    getToastIcon: function(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    },

    // 모달 열기
    openModal: function(title, content, options = {}) {
        const modalContainer = document.getElementById('modalContainer');
        if (!modalContainer) return;

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="Utils.closeModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
                ${options.showFooter !== false ? `
                <div class="modal-footer">
                    ${options.footerContent || `
                        <button class="btn btn-secondary" onclick="Utils.closeModal()">취소</button>
                        <button class="btn btn-primary" onclick="Utils.handleModalConfirm()">확인</button>
                    `}
                </div>
                ` : ''}
            </div>
        `;

        modalContainer.appendChild(modal);
        modalContainer.style.display = 'flex';

        // ESC 키로 모달 닫기
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    },

    // 모달 닫기
    closeModal: function() {
        const modalContainer = document.getElementById('modalContainer');
        if (modalContainer) {
            modalContainer.innerHTML = '';
            modalContainer.style.display = 'none';
        }
    },

    // 확인 대화상자
    confirm: function(message, callback) {
        this.openModal('확인', `<p>${message}</p>`, {
            footerContent: `
                <button class="btn btn-secondary" onclick="Utils.closeModal()">취소</button>
                <button class="btn btn-danger" onclick="Utils.handleConfirm(${callback.toString()})">확인</button>
            `
        });
    },

    // 확인 처리
    handleConfirm: function(callback) {
        this.closeModal();
        if (typeof callback === 'function') {
            callback();
        }
    },

    // 테이블 정렬
    sortTable: function(table, column, direction = 'asc') {
        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));

        rows.sort((a, b) => {
            const aValue = a.cells[column].textContent.trim();
            const bValue = b.cells[column].textContent.trim();

            // 숫자인지 확인
            const aNum = parseFloat(aValue.replace(/[^\d.-]/g, ''));
            const bNum = parseFloat(bValue.replace(/[^\d.-]/g, ''));

            if (!isNaN(aNum) && !isNaN(bNum)) {
                return direction === 'asc' ? aNum - bNum : bNum - aNum;
            } else {
                return direction === 'asc'
                    ? aValue.localeCompare(bValue, 'ko-KR')
                    : bValue.localeCompare(aValue, 'ko-KR');
            }
        });

        rows.forEach(row => tbody.appendChild(row));
    },

    // 페이지네이션 생성
    createPagination: function(container, totalPages, currentPage, onPageClick) {
        if (!container) return;

        container.innerHTML = '';

        // 이전 버튼
        const prevBtn = document.createElement('button');
        prevBtn.className = `pagination-btn ${currentPage === 1 ? 'disabled' : ''}`;
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.onclick = () => {
            if (currentPage > 1) onPageClick(currentPage - 1);
        };
        container.appendChild(prevBtn);

        // 페이지 번호들
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.onclick = () => onPageClick(i);
            container.appendChild(pageBtn);
        }

        // 다음 버튼
        const nextBtn = document.createElement('button');
        nextBtn.className = `pagination-btn ${currentPage === totalPages ? 'disabled' : ''}`;
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.onclick = () => {
            if (currentPage < totalPages) onPageClick(currentPage + 1);
        };
        container.appendChild(nextBtn);
    },

    // 디바운스 함수
    debounce: function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // 로컬 스토리지 헬퍼
    storage: {
        set: function(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (e) {
                console.error('Storage set error:', e);
                return false;
            }
        },

        get: function(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (e) {
                console.error('Storage get error:', e);
                return defaultValue;
            }
        },

        remove: function(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (e) {
                console.error('Storage remove error:', e);
                return false;
            }
        }
    }
};

// 비밀번호 표시/숨기기 토글
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling.querySelector('i');

    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// 전역 이벤트 리스너
document.addEventListener('DOMContentLoaded', function() {
    // 모든 입력 필드에 엔터 키 이벤트 추가
    document.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && e.target.matches('input[type="text"], input[type="email"], input[type="password"]')) {
            const form = e.target.closest('form');
            if (form) {
                const submitBtn = form.querySelector('button[type="submit"]');
                if (submitBtn) {
                    submitBtn.click();
                }
            }
        }
    });

    // 클릭 외부 영역으로 드롭다운 닫기
    document.addEventListener('click', function(e) {
        const dropdowns = document.querySelectorAll('.dropdown');
        dropdowns.forEach(dropdown => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
    });
});