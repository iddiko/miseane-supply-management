// 품질 검사 페이지 모듈
const Quality = {
    async init() {
        const contentContainer = document.querySelector('.content-container');
        contentContainer.innerHTML = `
            <div class="page-header">
                <h1>품질 검사</h1>
                <div class="page-actions">
                    <button class="btn btn-primary">
                        <i class="fas fa-check-circle"></i>
                        검사 등록
                    </button>
                </div>
            </div>
            <div class="page-content">
                <div class="card">
                    <div class="card-content">
                        <p>품질 검사 기능이 곧 추가될 예정입니다.</p>
                    </div>
                </div>
            </div>
        `;
    },
    async search(query) {
        Utils.showToast(`품질검사 검색: ${query}`, 'info');
    }
};

// 전역으로 등록
window.Quality = Quality;

document.addEventListener('DOMContentLoaded', function() {
    if (window.App) {
        App.registerPage('quality', Quality);
    }
});