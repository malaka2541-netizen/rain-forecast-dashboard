(async function() {
  try {
    // 1. Fetch config
    const response = await fetch('/api/config');
    if (!response.ok) throw new Error('Failed to load configuration');
    const config = await response.json();

    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      console.warn('Supabase Auth is not configured. Skipping auth check.');
      return;
    }

    // 2. Initialize Supabase
    window.supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

    // 3. Check Session
    const { data: { session } } = await window.supabaseClient.auth.getSession();
    
    // === TEMPORARILY BYPASSED LOGIN SYSTEM (PUBLIC ACCESS) ===
    /*
    if (!session) {
      // Not logged in, redirect
      window.location.replace('/login.html');
      return;
    }

    // 4. Check User Approval Status
    const { data: profile, error } = await window.supabaseClient
      .from('user_profiles')
      .select('status')
      .eq('id', session.user.id)
      .single();

    if (error || !profile || profile.status !== 'approved') {
      window.__AUTH_BLOCKED = true;
      // Block access and show pending message
      document.body.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: 'Prompt', sans-serif; background-color: #f1f5f9; padding: 2rem; text-align: center; margin: 0;">
          <div style="background: white; padding: 2.5rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1); max-width: 400px; width: 100%;">
            <i class="fa-solid fa-user-clock" style="font-size: 3rem; color: #f59e0b; margin-bottom: 1.5rem;"></i>
            <h2 style="color: #0f172a; margin-bottom: 1rem; font-size: 1.5rem;">บัญชีรอการอนุมัติ</h2>
            <p style="color: #64748b; margin-bottom: 2rem; line-height: 1.5;">
              บัญชีของคุณกำลังอยู่ในระหว่างรอผู้ดูแลระบบตรวจสอบและอนุมัติการเข้าใช้งาน<br><br>
              <span style="font-size: 0.85rem;">(หากแอดมินอนุมัติแล้ว กรุณากดรีเฟรชหน้าเว็บ หรือออกจากระบบแล้วเข้าใหม่)</span>
            </p>
            <button id="btn-logout-pending" style="background: #ef4444; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; font-weight: 500; cursor: pointer; font-family: inherit; font-size: 1rem; width: 100%; transition: background 0.2s;">
              <i class="fa-solid fa-arrow-right-from-bracket"></i> ออกจากระบบ
            </button>
          </div>
        </div>
      `;
      
      const logoutBtnPending = document.getElementById('btn-logout-pending');
      logoutBtnPending.addEventListener('click', async () => {
        logoutBtnPending.disabled = true;
        logoutBtnPending.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        await window.supabaseClient.auth.signOut();
        window.location.replace('/login.html');
      });
      return; // Stop execution to prevent loading the dashboard
    }
    */
    // ==========================================================

    // 4. Set up Logout button
    const setupLogoutBtn = () => {
      const logoutBtn = document.getElementById('btn-logout');
      if (logoutBtn) {
        logoutBtn.style.display = 'inline-flex';
        logoutBtn.addEventListener('click', async () => {
          logoutBtn.disabled = true;
          logoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
          await window.supabaseClient.auth.signOut();
          window.location.replace('/login.html');
        });
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupLogoutBtn);
    } else {
      setupLogoutBtn();
    }

  } catch (err) {
    console.error('Auth Guard Error:', err);
  }
})();
