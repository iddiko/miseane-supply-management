// 업무일정/회의록 메뉴 및 동적 추가 UI

document.addEventListener('DOMContentLoaded', function() {
    const menuList = document.getElementById('workScheduleMenuList');
    const addBtn = document.getElementById('addWorkScheduleMenuBtn');

    if (addBtn && menuList) {
        addBtn.addEventListener('click', function() {
            const newMenuName = prompt('새 메뉴 이름을 입력하세요 (예: 2025년 9월 업무일정)');
            if (newMenuName) {
                const li = document.createElement('li');
                li.className = 'work-schedule-menu-item';
                li.textContent = newMenuName;
                menuList.appendChild(li);
            }
        });
    }
});
