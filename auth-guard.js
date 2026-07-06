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
    
    if (!session) {
      // Not logged in, redirect
      window.location.replace('/login.html');
      return;
    }

    // 4. Set up Logout button
    document.addEventListener('DOMContentLoaded', () => {
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
    });

  } catch (err) {
    console.error('Auth Guard Error:', err);
  }
})();
