// Load navbar
function loadNavbar() {
    const navbarContainer = document.getElementById('navbar-container');
    if (!navbarContainer) return;

    fetch('navbar.html')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.text();
        })
        .then(data => {
            navbarContainer.innerHTML = data;
            updateNavigation();
        })
        .catch(err => {
            console.error('Error loading navbar:', err);
            navbarContainer.innerHTML = `
                <nav>
                    <ul>
                        <li><a href="index.html">Home</a></li>
                        <li><a href="shop.html">Shop</a></li>
                        <li><a href="about.html">About</a></li>
                        <li><a href="contact.html">Contact</a></li>
                        <li><a href="login.html">Login</a></li>
                        <li><a href="signup.html">Sign Up</a></li>
                    </ul>
                </nav>`;
            updateNavigation();
        });
}

// Cart
let cart = JSON.parse(localStorage.getItem('cart')) || [];
function updateCartDisplay() {
    const cartItems = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');
    if (!cartItems || !cartTotal) return;
    cartItems.innerHTML = '';
    let total = 0;
    cart.forEach((item, i) => {
        const el = document.createElement('div');
        el.className = 'cart-item';
        el.innerHTML = `<span>${item.name} - $${item.price}</span><button onclick="removeFromCart(${i})">Remove</button>`;
        cartItems.appendChild(el);
        total += parseFloat(item.price || 0);
    });
    cartTotal.textContent = total.toFixed(2);
    localStorage.setItem('cart', JSON.stringify(cart));
}
function addToCart(id, name, price) {
    if (cart.find(i => i.id === id)) { alert('Item already in cart!'); return; }
    cart.push({ id, name, price }); updateCartDisplay(); alert('Item added to cart!');
}
function removeFromCart(index) { cart.splice(index,1); updateCartDisplay(); }

// Auth state
let users = JSON.parse(localStorage.getItem('users')) || [];
let token = localStorage.getItem('token') || null;
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
// Prevent duplicate form handling
let __handlingSubmit = false;

const API_PORT = 3001;
const API_BASE = (location.port && String(location.port) !== String(API_PORT))
    ? `${location.protocol}//${location.hostname}:${API_PORT}`
    : '';
function apiUrl(path) { return API_BASE + path; }

function updateNavigation() {
    const navUl = document.querySelector('nav ul');
    if (!navUl) return;

    // Clear existing auth links
    const existingAuthLinks = navUl.querySelectorAll('li a[href="login.html"], li a[href="signup.html"], li a[href="profile.html"]');
    existingAuthLinks.forEach(link => link.parentElement.remove());

    // Add appropriate links based on auth state
    if (currentUser) {
        const profileLi = document.createElement('li');
        profileLi.innerHTML = '<a href="profile.html">Profile</a>';
        navUl.appendChild(profileLi);
    } else {
        const loginLi = document.createElement('li');
        loginLi.innerHTML = '<a href="login.html">Login</a>';
        navUl.appendChild(loginLi);

        const signupLi = document.createElement('li');
        signupLi.innerHTML = '<a href="signup.html">Sign Up</a>';
        navUl.appendChild(signupLi);
    }
}

async function updateUserInterface() {
    updateNavigation();
    const profileContent = document.getElementById('profile-content');
    const adminContent = document.getElementById('admin-content');

    // If we have a token, refresh the current user's data from the server
    if (token) {
        try {
            const res = await fetch(apiUrl('/api/profile'), { headers: { 'Authorization': token ? `Bearer ${token}` : '' } });
            if (res.ok) {
                const payload = await res.json();
                currentUser = payload.user;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
            } else {
                // token invalid or expired -> clear local auth
                currentUser = null;
                localStorage.removeItem('currentUser');
                localStorage.removeItem('token');
                token = null;
            }
        } catch (err) {
            console.warn('Could not refresh profile:', err);
        }
    }

    if (profileContent) {
        if (currentUser) {
            profileContent.innerHTML = `
                <h2>Welcome, ${currentUser.name}!</h2>
                <p>Email: ${currentUser.email}</p>
                <p>Last login: ${currentUser.lastLogin ? new Date(currentUser.lastLogin).toLocaleString() : 'N/A'}</p>
                <h3>Account Settings</h3>
                <form id="profile-form">
                    <div class="form-group"><label for="profile-name">Full Name:</label><input type="text" id="profile-name" value="${currentUser.name}" required></div>
                    <div class="form-group"><label for="profile-email">Email:</label><input type="email" id="profile-email" value="${currentUser.email}" required></div>
                    <button type="submit">Update Profile</button>
                </form>
                <button onclick="logout()" style="margin-top:1rem;">Logout</button>
                <div id="profile-message"></div>
            `;
        } else {
            profileContent.innerHTML = '<p>Please <a href="login.html">login</a> to view your profile.</p>';
        }
    }

    if (adminContent) {
        if (currentUser && currentUser.isAdmin) {
            adminContent.innerHTML = `<h2>Admin Controls</h2><div id="admin-users"></div>`;
            loadAdminUsers();
        } else {
            adminContent.innerHTML = '<p>Please login as admin to access the dashboard.</p>';
        }
    }
    }

async function login(email, password) {
    try {
        const res = await fetch(apiUrl('/api/login'), { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) });
        if (res.ok) {
            const data = await res.json();
            token = data.token;
            currentUser = data.user;
            localStorage.setItem('token', token);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            return true;
        }

        // Try to extract server message for better UX
        let msg = `HTTP ${res.status} ${res.statusText}`;
        try {
            const body = await res.json();
            if (body && body.message) msg = body.message;
        } catch (e) {
            // ignore parse errors
        }
        const msgEl = document.getElementById('login-message');
        if (msgEl) {
            msgEl.textContent = msg;
            msgEl.style.color = 'red';
        }
        console.error('Login failed:', msg);
        return false;
    } catch (err) {
        // fallback
        const u = users.find(u=>u.email===email && u.password===password);
        if (u) { currentUser = u; localStorage.setItem('currentUser', JSON.stringify(currentUser)); return true; }
        const msgEl = document.getElementById('login-message');
        if (msgEl) {
            msgEl.textContent = 'Network error during login';
            msgEl.style.color = 'red';
        }
        console.error('Login error:', err);
        return false;
    }
}

async function signup(name,email,password) {
    try {
        const res = await fetch(apiUrl('/api/signup'), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name,email,password}) });
        if (res.ok || res.status===201) { const data = await res.json(); token = data.token; currentUser = data.user; localStorage.setItem('token', token); localStorage.setItem('currentUser', JSON.stringify(currentUser)); return true; }
        return false;
    } catch (err) {
        if (users.find(u=>u.email===email)) return false;
        const newUser = { name, email, password, isAdmin:false, lastLogin: new Date().toISOString() };
        users.push(newUser); localStorage.setItem('users', JSON.stringify(users)); currentUser = newUser; localStorage.setItem('currentUser', JSON.stringify(currentUser)); return true;
    }
}

function logout() { currentUser = null; localStorage.removeItem('currentUser'); localStorage.removeItem('token'); updateUserInterface(); window.location.href='index.html'; }

// Delegated submit listener to ensure signup/profile are intercepted even if specific handlers aren't attached
document.addEventListener('submit', async function(e) {
    try {
        const t = e.target;
        if (!t) return;
        if (t.id === 'signup-form') {
            e.preventDefault(); e.stopPropagation();
            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const confirm = document.getElementById('signup-confirm-password').value;
            const sm = document.getElementById('signup-message');
            if (password !== confirm) { sm.textContent='Passwords do not match!'; sm.style.color='red'; return; }
            const ok = await signup(name,email,password);
            if (ok) { sm.textContent='Account created successfully!'; sm.style.color='green'; if (currentUser && currentUser.lastLogin) sm.textContent += ` First login: ${new Date(currentUser.lastLogin).toLocaleString()}`; setTimeout(()=>window.location.href='login.html',1000); }
            else { sm.textContent='Email already exists!'; sm.style.color='red'; }
        }
        if (t.id === 'profile-form') {
            e.preventDefault(); e.stopPropagation();
            const name = document.getElementById('profile-name').value;
            const email = document.getElementById('profile-email').value;
            try {
                const res = await fetch(apiUrl('/api/profile'), { method:'PUT', headers: { 'Content-Type':'application/json', 'Authorization': token ? `Bearer ${token}` : '' }, body: JSON.stringify({ name, email }) });
                if (res.ok) { currentUser.name = name; currentUser.email = email; localStorage.setItem('currentUser', JSON.stringify(currentUser)); document.getElementById('profile-message').textContent='Profile updated successfully!'; document.getElementById('profile-message').style.color='green'; updateUserInterface(); return; }
            } catch (err) { console.warn('Profile update failed, falling back to local update'); }
            currentUser.name = name; currentUser.email = email; localStorage.setItem('currentUser', JSON.stringify(currentUser)); const idx = users.findIndex(u=>u.email===currentUser.email); if (idx!==-1) { users[idx]=currentUser; localStorage.setItem('users', JSON.stringify(users)); } document.getElementById('profile-message').textContent='Profile updated successfully!'; document.getElementById('profile-message').style.color='green';
        }
    } catch (err) { console.error('Delegated submit error:', err); }
}, true);

// Other DOM handlers and initializers
document.addEventListener('DOMContentLoaded', function() {
    // Load navbar and initialize UI
    loadNavbar(); updateCartDisplay(); updateUserInterface();

    // Bind add-to-cart buttons (products may be present statically)
    document.querySelectorAll('.add-to-cart').forEach(btn => btn.addEventListener('click', function() {
        const product = this.closest('.product');
        if (!product) return;
        addToCart(product.dataset.id, product.dataset.name, product.dataset.price);
    }));

    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) checkoutBtn.addEventListener('click', function() {
        if (cart.length === 0) { alert('Your cart is empty!'); return; }
        if (!currentUser) { alert('Please login to checkout!'); window.location.href='login.html'; return; }
        alert('Checkout successful! Thank you for your purchase.'); cart = []; updateCartDisplay();
    });

    // Ensure login form handler is attached
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (__handlingSubmit) return;
            __handlingSubmit = true;
            try {
                const email = document.getElementById('login-email').value;
                const password = document.getElementById('login-password').value;
                const ok = await login(email, password);
                const msgEl = document.getElementById('login-message');
                if (ok) {
                    msgEl.textContent = 'Login successful!'; msgEl.style.color = 'green'; updateUserInterface();
                    if (currentUser && currentUser.lastLogin) msgEl.textContent += ` Last login: ${new Date(currentUser.lastLogin).toLocaleString()}`;
                    setTimeout(() => window.location.href = 'profile.html', 1000);
                } else {
                    // Do not overwrite server-provided message; login() already sets messages on failure.
                    if (msgEl && !msgEl.textContent) {
                        msgEl.textContent = 'Invalid credentials!';
                        msgEl.style.color = 'red';
                    }
                }
            } finally {
                __handlingSubmit = false;
            }
        });
    }

    // Clear local data button (helps when users are stuck in localStorage)
    const clearBtn = document.getElementById('clear-local-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            localStorage.removeItem('users');
            localStorage.removeItem('currentUser');
            localStorage.removeItem('token');
            sessionStorage.clear();
            alert('Local data cleared. The page will reload.');
            window.location.reload();
        });
    }
});

// Admin helpers
async function loadAdminUsers() {
    const container = document.getElementById('admin-users');
    if (!container) return;
    container.textContent = 'Loading users...';
    try {
        // Require a valid token before attempting the admin users call
        if (!token) {
            container.textContent = 'Not authenticated. Please login as an admin.';
            return;
        }

        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(apiUrl('/api/admin/users'), { headers });
        if (!res.ok) {
            let msg = `Unable to load users (status ${res.status})`;
            try { const body = await res.json(); if (body && body.message) msg += `: ${body.message}`; } catch (e) { /* ignore */ }
            container.textContent = msg;
            console.error('Admin users fetch failed:', res.status, await res.text().catch(()=>''));
            return;
        }
        const data = await res.json();
        // build table with toggle for is_admin
        const rows = data.users.map(u => `
            <tr data-id="${u.id}">
                <td>${u.id}</td>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td>${u.last_login ? new Date(u.last_login).toLocaleString() : 'N/A'}</td>
                <td><input type="checkbox" class="admin-toggle" ${u.is_admin ? 'checked' : ''}></td>
            </tr>
        `).join('');
        container.innerHTML = `
            <table class="admin-users-table">
                <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Last Login</th><th>Admin</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;
        // bind toggles
        container.querySelectorAll('.admin-toggle').forEach(ch => {
            ch.addEventListener('change', async function() {
                const tr = this.closest('tr');
                const id = tr.dataset.id;
                const isAdmin = this.checked;
                try {
                    const r = await fetch(apiUrl(`/api/admin/users/${id}`), {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
                        body: JSON.stringify({ isAdmin })
                    });
                    if (!r.ok) {
                        alert('Failed to update user');
                        this.checked = !isAdmin; // revert
                        return;
                    }
                    const payload = await r.json();
                    // update row if needed
                    console.log('User updated', payload.user);
                } catch (err) {
                    console.error('Error updating user admin flag', err);
                    alert('Error updating user');
                    this.checked = !isAdmin;
                }
            });
        });
    } catch (err) { container.textContent = 'Error loading users.'; }
}

function addProduct() { const name = prompt('Product name:'); const price = prompt('Product price:'); if (name && price) alert('Product added (simulated)'); }
