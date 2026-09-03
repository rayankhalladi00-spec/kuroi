const msg = document.getElementById('msg');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const subtitle = document.getElementById('subtitle');

function show(text, kind = 'error') {
  msg.textContent = text;
  msg.className = `msg show ${kind}`;
}
function clear() {
  msg.className = 'msg';
}

function nextUrl() {
  const next = new URLSearchParams(location.search).get('next');
  // On n'accepte qu'un chemin interne, jamais une URL absolue.
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

document.getElementById('toRegister').addEventListener('click', (e) => {
  e.preventDefault();
  clear();
  loginForm.hidden = true;
  registerForm.hidden = false;
  subtitle.textContent = 'Crée ton compte pour accéder au catalogue.';
});

document.getElementById('toLogin').addEventListener('click', (e) => {
  e.preventDefault();
  clear();
  registerForm.hidden = true;
  loginForm.hidden = false;
  subtitle.textContent = 'Connecte-toi pour accéder au catalogue.';
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clear();
  const btn = loginForm.querySelector('button');
  btn.disabled = true;
  try {
    await api('/api/auth/login', {
      method: 'POST',
      body: {
        identifier: document.getElementById('identifier').value,
        password: document.getElementById('password').value,
      },
    });
    location.href = nextUrl();
  } catch (err) {
    show(err.message + (err.data?.reason ? ` — motif : ${err.data.reason}` : ''));
    btn.disabled = false;
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clear();
  const btn = registerForm.querySelector('button');
  btn.disabled = true;
  try {
    await api('/api/auth/register', {
      method: 'POST',
      body: {
        username: document.getElementById('rUsername').value,
        email: document.getElementById('rEmail').value,
        password: document.getElementById('rPassword').value,
      },
    });
    location.href = nextUrl();
  } catch (err) {
    show(err.message);
    btn.disabled = false;
  }
});

// Déjà connecté -> on saute l'écran de login.
currentUser().then((u) => {
  if (u) location.href = nextUrl();
});
