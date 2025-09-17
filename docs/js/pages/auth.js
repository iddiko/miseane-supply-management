// 로그인 및 회원가입, SNS 로그인 UI/로직
// 기본 로그인, 회원가입, SNS(Google, Kakao) 버튼 및 이벤트 처리

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const rememberMe = document.getElementById('rememberMe').checked;
            try {
                const res = await fetch('/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, rememberMe })
                });
                const data = await res.json();
                if (data.success) {
                    localStorage.setItem('token', data.data.token);
                    // 로그인 성공 시 앱 컨테이너로 이동
                    document.getElementById('loginContainer').style.display = 'none';
                    document.getElementById('appContainer').style.display = '';
                } else {
                    alert(data.message || '로그인 실패');
                }
            } catch (err) {
                alert('서버 오류: ' + err.message);
            }
        });
    }

    // SNS 로그인 버튼 이벤트
    document.getElementById('googleLoginBtn')?.addEventListener('click', function() {
        window.location.href = '/auth/google';
    });
    document.getElementById('kakaoLoginBtn')?.addEventListener('click', function() {
        window.location.href = '/auth/kakao';
    });

    // 회원가입 버튼 이벤트
    document.getElementById('showRegisterBtn')?.addEventListener('click', function() {
        showRegisterModal();
    });
});

function showRegisterModal() {
    // 간단한 회원가입 모달 예시 (실제 구현은 modalContainer 활용)
    alert('회원가입 기능은 최고관리자만 가능합니다. 관리자에게 문의하세요.');
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
    } else {
        input.type = 'password';
    }
}

function logout() {
    localStorage.removeItem('token');
    document.getElementById('appContainer').style.display = 'none';
    document.getElementById('loginContainer').style.display = '';
}
