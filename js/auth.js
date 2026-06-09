/* Auth client — handles login, register, session state.
   Included on login/register pages and the global header. */

window.StudioAuth = (function () {
  var API = '/api/auth';
  var currentUser = null;

  function request(method, url, body) {
    return fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) { return r.json().then(function (d) { return { status: r.status, data: d }; }); });
  }

  function login(email, password) {
    return request('POST', API + '/login', { email: email, password: password }).then(function (r) {
      if (r.status === 200) {
        currentUser = r.data.user;
        localStorage.setItem('studio_token', r.data.token);
      }
      return r;
    });
  }

  function register(email, password, name) {
    return request('POST', API + '/register', { email: email, password: password, name: name }).then(function (r) {
      if (r.status === 200) {
        currentUser = r.data.user;
        localStorage.setItem('studio_token', r.data.token);
      }
      return r;
    });
  }

  function logout() {
    return request('POST', API + '/logout').then(function () {
      currentUser = null;
      localStorage.removeItem('studio_token');
      window.location.href = '/login';
    });
  }

  function getMe() {
    return request('GET', API + '/me').then(function (r) {
      if (r.status === 200) currentUser = r.data.user;
      return r;
    });
  }

  function getUser() { return currentUser; }

  /** Update the header UI to show logged-in state */
  function updateHeaderUI() {
    getMe().then(function (r) {
      if (r.status !== 200) return;
      var user = r.data.user;
      // Find the login button in header and replace with user info
      var loginLinks = document.querySelectorAll('a[href="/login"]');
      loginLinks.forEach(function (link) {
        // If it's in the header nav, transform it
        if (link.closest('header')) {
          link.href = '#';
          link.innerHTML =
            '<span class="flex items-center gap-2">' +
            '<span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-cyan-500 text-white text-xs font-bold">' +
            user.name.charAt(0).toUpperCase() +
            '</span>' +
            '<span class="hidden lg:inline text-sm">' + user.name + '</span>' +
            '<span class="text-xs text-cyan-400">' + user.credits + ' credits</span>' +
            '</span>';
          link.onclick = function (e) {
            e.preventDefault();
            var menu = document.getElementById('studio-user-menu');
            if (menu) menu.classList.toggle('hidden');
          };

          // Add dropdown menu after the link
          if (!document.getElementById('studio-user-menu')) {
            var dropdown = document.createElement('div');
            dropdown.id = 'studio-user-menu';
            dropdown.className = 'hidden absolute right-4 top-14 bg-[#1a1f2e] border border-white/10 rounded-lg shadow-xl z-50 py-2 min-w-[180px]';
            dropdown.innerHTML =
              '<div class="px-4 py-2 border-b border-white/10">' +
              '<p class="text-sm font-medium text-white">' + user.name + '</p>' +
              '<p class="text-xs text-gray-400">' + user.email + '</p>' +
              '<p class="text-xs text-cyan-400 mt-1">' + user.credits + ' credits</p>' +
              '</div>' +
              (user.role === 'admin' ? '<a href="/admin" class="block px-4 py-2 text-sm text-gray-300 hover:bg-white/5">Admin Panel</a>' : '') +
              '<a href="/pricing" class="block px-4 py-2 text-sm text-gray-300 hover:bg-white/5">Mua Credits</a>' +
              '<button onclick="StudioAuth.logout()" class="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-white/5">Đăng xuất</button>';
            link.parentElement.style.position = 'relative';
            link.parentElement.appendChild(dropdown);
          }
        }
      });
    });
  }

  return {
    login: login,
    register: register,
    logout: logout,
    getMe: getMe,
    getUser: getUser,
    updateHeaderUI: updateHeaderUI,
  };
})();

// Auto-update header on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', StudioAuth.updateHeaderUI);
} else {
  StudioAuth.updateHeaderUI();
}
