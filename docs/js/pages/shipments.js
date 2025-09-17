// 배송 관리 페이지 모듈
const Shipments = {
    async init() {
        const contentContainer = document.querySelector('.content-container');
        contentContainer.innerHTML = `
            <div class="page-header">
                <h1>배송 관리</h1>
                <div class="page-actions">
                    <button class="btn btn-primary">
                        <i class="fas fa-truck"></i>
                        입고 처리
                    </button>
                </div>
            </div>
            <div class="page-content">
                <div class="card">
                    <div class="card-content">
                        <p>배송 관리 기능이 곧 추가될 예정입니다.</p>
                    </div>
                </div>
            </div>
        `;
    },
    async search(query) {
        Utils.showToast(`배송 검색: ${query}`, 'info');
    }
};

// 전역으로 등록
window.Shipments = Shipments;

document.addEventListener('DOMContentLoaded', function() {
    if (window.App) {
        App.registerPage('shipments', Shipments);
    }
});