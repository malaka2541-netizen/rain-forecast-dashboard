document.addEventListener('DOMContentLoaded', async () => {
  const loginForm = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('submit-btn');
  const errorAlert = document.getElementById('error-alert');
  const errorText = document.getElementById('error-text');

  function showError(msg) {
    errorText.textContent = msg;
    errorAlert.style.display = 'block';
    setTimeout(() => {
      errorAlert.style.display = 'none';
    }, 5000);
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'กำลังโหลดตั้งค่า...';

  let isLoginMode = true;
  const toggleModeBtn = document.getElementById('toggle-mode-btn');
  const toggleModeText = document.getElementById('toggle-mode-text');

  toggleModeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
      submitBtn.textContent = 'เข้าสู่ระบบ';
      toggleModeText.innerHTML = 'ยังไม่มีบัญชีผู้ใช้? <a href="#" id="toggle-mode-btn">สมัครสมาชิก</a>';
    } else {
      submitBtn.textContent = 'สมัครสมาชิก';
      toggleModeText.innerHTML = 'มีบัญชีอยู่แล้ว? <a href="#" id="toggle-mode-btn">เข้าสู่ระบบ</a>';
    }
    // Re-attach event listener to the newly created element
    document.getElementById('toggle-mode-btn').addEventListener('click', arguments.callee);
  });

  try {
    // 1. Fetch config from server
    const response = await fetch('/api/config');
    if (!response.ok) throw new Error('Failed to load configuration');
    const config = await response.json();

    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      throw new Error('Supabase configuration is missing. Please check server environment variables.');
    }

    // 2. Initialize Supabase
    const supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

    // 3. Check if already logged in
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      window.location.replace('/'); // Redirect to dashboard
      return;
    }

    submitBtn.disabled = false;
    submitBtn.textContent = isLoginMode ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก';

    // 4. Handle Login / Signup
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      
      if (!email || !password) {
        showError('กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังดำเนินการ...';

      let authResult;
      
      if (isLoginMode) {
        authResult = await supabase.auth.signInWithPassword({ email, password });
      } else {
        authResult = await supabase.auth.signUp({ email, password });
      }

      const { data, error } = authResult;

      if (error) {
        let errorMsg = 'เกิดข้อผิดพลาด: ' + error.message;
        if (error.message === 'Invalid login credentials') errorMsg = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
        if (error.message.includes('already registered')) errorMsg = 'อีเมลนี้ถูกลงทะเบียนไว้แล้ว';
        showError(errorMsg);
        submitBtn.disabled = false;
        submitBtn.textContent = isLoginMode ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก';
      } else {
        if (!isLoginMode && data.user && data.user.identities && data.user.identities.length === 0) {
            showError('อีเมลนี้มีอยู่ในระบบแล้ว โปรดเข้าสู่ระบบ');
            submitBtn.disabled = false;
            submitBtn.textContent = 'สมัครสมาชิก';
            return;
        }
        
        // If "Confirm email" is ON, session might be null after sign up
        if (!isLoginMode && !data.session) {
            alert('สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบอีเมลของคุณเพื่อยืนยันบัญชี');
            // Switch back to login
            document.getElementById('toggle-mode-btn').click();
            submitBtn.disabled = false;
            return;
        }
        
        // Login/Signup success, redirect to dashboard
        window.location.replace('/');
      }
    });

  } catch (err) {
    showError(err.message);
    submitBtn.textContent = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
  }
});
