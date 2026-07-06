document.addEventListener('DOMContentLoaded', async () => {
  const loginForm = document.getElementById('login-form');
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('submit-btn');
  const errorAlert = document.getElementById('error-alert');
  const errorText = document.getElementById('error-text');
  const togglePasswordBtn = document.getElementById('toggle-password');

  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      togglePasswordBtn.className = type === 'password' ? 'fa-solid fa-eye toggle-password' : 'fa-solid fa-eye-slash toggle-password';
    });
  }

  function showError(msg) {
    errorText.textContent = msg;
    errorAlert.style.display = 'block';
    setTimeout(() => {
      errorAlert.style.display = 'none';
    }, 5000);
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'กำลังโหลดตั้งค่า...';


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
    submitBtn.textContent = 'สมัครสมาชิก';
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

      const name = nameInput.value.trim();
      
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            full_name: name
          }
        }
      });

      if (error) {
        let errorMsg = 'เกิดข้อผิดพลาด: ' + error.message;
        if (error.message.includes('already registered')) errorMsg = 'อีเมลนี้ถูกลงทะเบียนไว้แล้ว';
        showError(errorMsg);
        submitBtn.disabled = false;
        submitBtn.textContent = 'สมัครสมาชิก';
      } else {
        if (data.user && data.user.identities && data.user.identities.length === 0) {
            showError('อีเมลนี้มีอยู่ในระบบแล้ว โปรดเข้าสู่ระบบ');
            submitBtn.disabled = false;
            submitBtn.textContent = 'สมัครสมาชิก';
            return;
        }
        
        // If "Confirm email" is ON, session might be null after sign up
        if (!data.session) {
            alert('สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบอีเมลของคุณเพื่อยืนยันบัญชี');
            window.location.replace('login.html');
            return;
        }
        
        // Signup success, redirect to dashboard
        window.location.replace('/');
      }
    });

  } catch (err) {
    showError(err.message);
    submitBtn.textContent = 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
  }
});
