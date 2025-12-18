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
    const cartItemsPage = document.getElementById('cart-items-page');
    const cartTotalPage = document.getElementById('cart-total-page');
    const cartCount = document.getElementById('cart-count');
    const sidebarItems = document.getElementById('sidebar-cart-items');
    const sidebarTotal = document.getElementById('sidebar-cart-total');
    
    let total = 0;
    let itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    const cartHTML = cart.map((item, i) => {
        const itemTotal = parseFloat(item.price || 0) * item.quantity;
        total += itemTotal;
        return `
            <div class="cart-item">
                <span>${item.name} - KSH ${item.price} x ${item.quantity}</span>
                <div class="quantity-controls">
                    <button onclick="changeQuantity(${i}, -1)">-</button>
                    <span>${item.quantity}</span>
                    <button onclick="changeQuantity(${i}, 1)">+</button>
                    <button onclick="removeFromCart(${i})">Remove</button>
                </div>
            </div>
        `;
    }).join('');
    
    const sidebarHTML = cart.length > 0 ? cart.map((item, i) => {
        const itemTotal = parseFloat(item.price || 0) * item.quantity;
        return `
            <div class="sidebar-cart-item">
                <div class="item-info">
                    <h4>${item.name}</h4>
                    <p>KSH ${item.price} each</p>
                </div>
                <div class="item-controls">
                    <div class="quantity-controls">
                        <button onclick="changeQuantity(${i}, -1)">-</button>
                        <span>${item.quantity}</span>
                        <button onclick="changeQuantity(${i}, 1)">+</button>
                    </div>
                    <button class="remove-btn" onclick="removeFromCart(${i})">×</button>
                </div>
                <div class="item-total">KSH ${(itemTotal).toLocaleString()}</div>
            </div>
        `;
    }).join('') : '<div class="empty-cart">Your cart is empty</div>';
    
    if (cartItems) cartItems.innerHTML = cartHTML;
    if (cartItemsPage) cartItemsPage.innerHTML = cartHTML;
    if (sidebarItems) sidebarItems.innerHTML = sidebarHTML;
    if (cartTotal) cartTotal.textContent = total.toLocaleString();
    if (cartTotalPage) cartTotalPage.textContent = total.toLocaleString();
    if (sidebarTotal) sidebarTotal.textContent = total.toLocaleString();
    if (cartCount) cartCount.textContent = itemCount;
    
    localStorage.setItem('cart', JSON.stringify(cart));
    updateProductButtons();
}

function addToCart(id, name, price) {
    const existingItem = cart.find(i => i.id === id);
    if (existingItem) {
        existingItem.quantity += 1;
        showNotification(`${name} quantity increased to ${existingItem.quantity}`);
    } else {
        cart.push({ id, name, price, quantity: 1 });
        showNotification(`${name} added to cart!`);
    }
    updateCartDisplay();
}

function changeQuantity(index, change) {
    const item = cart[index];
    item.quantity += change;
    if (item.quantity <= 0) {
        showNotification(`${item.name} removed from cart`);
        cart.splice(index, 1);
    } else {
        showNotification(`${item.name} quantity: ${item.quantity}`);
    }
    updateCartDisplay();
}

function removeFromCart(index) { 
    cart.splice(index, 1); 
    updateCartDisplay(); 
}

function updateProductButtons() {
    document.querySelectorAll('.product').forEach(product => {
        const id = product.dataset.id;
        const cartItem = cart.find(i => i.id === id);
        const button = product.querySelector('.add-to-cart');
        
        if (cartItem && button) {
            button.innerHTML = `
                <div class="quantity-controls">
                    <button type="button" onclick="event.stopPropagation(); changeQuantityByProduct('${id}', -1)">-</button>
                    <span>${cartItem.quantity}</span>
                    <button type="button" onclick="event.stopPropagation(); changeQuantityByProduct('${id}', 1)">+</button>
                </div>
            `;
            button.className = 'quantity-button';
        } else if (button) {
            button.innerHTML = 'Add to Cart';
            button.className = 'add-to-cart';
        }
    });
}

function changeQuantityByProduct(id, change) {
    const index = cart.findIndex(i => i.id === id);
    if (index !== -1) {
        changeQuantity(index, change);
    }
}

function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'cart-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        font-weight: 500;
        animation: slideInRight 0.3s ease-out;
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// Slideshow function
function changeSlide(button, direction) {
    const container = button.closest('.slideshow-container');
    const slides = container.querySelectorAll('.slide');
    const activeSlide = container.querySelector('.slide.active');
    let currentIndex = Array.from(slides).indexOf(activeSlide);
    
    slides[currentIndex].classList.remove('active');
    currentIndex = (currentIndex + direction + slides.length) % slides.length;
    slides[currentIndex].classList.add('active');
}

// Auth state
let users = JSON.parse(localStorage.getItem('users')) || [];
let token = localStorage.getItem('token') || null;
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
// Prevent duplicate form handling
let __handlingSubmit = false;

const API_PORT = 3000;
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
                const errorData = await res.json().catch(() => ({}));
                if (errorData.banned) {
                    // User is banned - show message and logout
                    alert(errorData.message);
                    logout();
                    return;
                }
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
        let isBanned = false;
        try {
            const body = await res.json();
            if (body && body.message) {
                msg = body.message;
                isBanned = body.banned || res.status === 403;
            }
        } catch (e) {
            // ignore parse errors
        }
        const msgEl = document.getElementById('login-message');
        if (msgEl) {
            msgEl.textContent = msg;
            msgEl.style.color = isBanned ? '#dc3545' : 'red';
            if (isBanned) {
                msgEl.style.fontWeight = 'bold';
                msgEl.style.padding = '1rem';
                msgEl.style.border = '2px solid #dc3545';
                msgEl.style.borderRadius = '8px';
                msgEl.style.backgroundColor = '#f8d7da';
            }
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

// Periodic ban check for logged-in users
function startBanCheck() {
    if (!currentUser || !token) return;
    
    setInterval(async () => {
        if (!currentUser || !token) return;
        
        try {
            const res = await fetch(apiUrl('/api/profile'), { 
                headers: { 'Authorization': `Bearer ${token}` } 
            });
            
            if (res.status === 403) {
                const errorData = await res.json().catch(() => ({}));
                if (errorData.banned) {
                    alert(`You have been banned: ${errorData.message}`);
                    logout();
                }
            }
        } catch (err) {
            console.warn('Ban check failed:', err);
        }
    }, 30000); // Check every 30 seconds
}

// Cart sidebar functions
function toggleCartSidebar() {
    const sidebar = document.getElementById('cart-sidebar');
    sidebar.classList.toggle('open');
}

function createCartSidebar() {
    const sidebar = document.createElement('div');
    sidebar.id = 'cart-sidebar';
    sidebar.className = 'cart-sidebar';
    sidebar.innerHTML = `
        <div class="sidebar-header">
            <h3>Shopping Cart</h3>
            <button onclick="toggleCartSidebar()">&times;</button>
        </div>
        <div id="sidebar-cart-items"></div>
        <div class="sidebar-footer">
            <div class="sidebar-total">Total: KSH <span id="sidebar-cart-total">0</span></div>
            <button onclick="window.location.href='cart.html'">View Cart</button>
        </div>
    `;
    document.body.appendChild(sidebar);
}

function createFloatingCartButton() {
    // Remove existing button if any
    const existing = document.getElementById('floating-cart-btn');
    if (existing) existing.remove();
    
    const button = document.createElement('button');
    button.id = 'floating-cart-btn';
    button.className = 'floating-cart-btn';
    button.innerHTML = '🛒';
    button.onclick = toggleCartSidebar;
    button.style.cssText = `
        position: fixed !important;
        bottom: 20px !important;
        right: 20px !important;
        width: 60px !important;
        height: 60px !important;
        border-radius: 50% !important;
        background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%) !important;
        border: none !important;
        font-size: 24px !important;
        cursor: pointer !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
        z-index: 99999 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
    `;
    document.body.appendChild(button);
    console.log('Floating cart button created');
}

// Other DOM handlers and initializers
document.addEventListener('DOMContentLoaded', function() {
    // Load navbar and initialize UI
    loadNavbar(); updateCartDisplay(); updateUserInterface();
    
    // Create cart sidebar and floating button
    createCartSidebar();
    createFloatingCartButton();
    
    // Start ban checking if user is logged in
    if (currentUser && token) startBanCheck();

    // Bind add-to-cart buttons (products may be present statically)
    document.querySelectorAll('.add-to-cart').forEach(btn => btn.addEventListener('click', function() {
        const product = this.closest('.product');
        if (!product) return;
        addToCart(product.dataset.id, product.dataset.name, product.dataset.price);
    }));

    const checkoutBtn = document.getElementById('checkout-btn');
    const checkoutBtnPage = document.getElementById('checkout-btn-page');
    
    [checkoutBtn, checkoutBtnPage].forEach(btn => {
        if (btn) btn.addEventListener('click', function() {
            if (cart.length === 0) { alert('Your cart is empty!'); return; }
            if (!currentUser) { alert('Please login to checkout!'); window.location.href='login.html'; return; }
            alert('Checkout successful! Thank you for your purchase.'); cart = []; updateCartDisplay();
        });
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
                    startBanCheck(); // Start monitoring for bans
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
let isSuperAdmin = false;

async function loadAdminUsers() {
    const container = document.getElementById('admin-users');
    if (!container) return;
    container.textContent = 'Loading users...';
    try {
        if (!token) {
            container.textContent = 'Not authenticated. Please login as an admin.';
            return;
        }

        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
        const res = await fetch(apiUrl('/api/admin/users'), { headers });
        if (!res.ok) {
            let msg = `Unable to load users (status ${res.status})`;
            try { const body = await res.json(); if (body && body.message) msg += `: ${body.message}`; } catch (e) { /* ignore */ }
            container.textContent = msg;
            return;
        }
        const data = await res.json();
        isSuperAdmin = data.currentUser?.isSuperAdmin || false;
        
        // Show create admin button for super admin
        const createBtn = document.getElementById('create-admin-btn');
        if (createBtn) createBtn.style.display = isSuperAdmin ? 'inline-block' : 'none';
        
        const rows = data.users.map(u => {
            const banStatus = u.is_banned ? (u.ban_until ? `Banned until ${new Date(u.ban_until).toLocaleString()}` : 'Permanently banned') : 'Active';
            const permissions = u.permissions ? u.permissions.join(', ') : 'None';
            
            return `
                <tr data-id="${u.id}">
                    <td>${u.id}</td>
                    <td>${u.name}${u.is_super_admin ? ' (Super)' : ''}</td>
                    <td>${u.email}</td>
                    <td>${u.last_login ? new Date(u.last_login).toLocaleString() : 'N/A'}</td>
                    <td><input type="checkbox" class="admin-toggle" ${u.is_admin ? 'checked' : ''}></td>
                    <td>${banStatus}</td>
                    <td>${permissions}</td>
                    <td>
                        ${!u.is_super_admin ? `
                            <button onclick="showBanForm(${u.id})" ${u.is_banned ? 'style="display:none"' : ''}>Ban</button>
                            <button onclick="unbanUser(${u.id})" ${!u.is_banned ? 'style="display:none"' : ''}>Unban</button>
                            ${isSuperAdmin && u.is_admin ? `<button onclick="showPermissionsForm(${u.id}, ${JSON.stringify(u.permissions || []).replace(/"/g, '&quot;')})">Permissions</button>` : ''}
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');
        
        container.innerHTML = `
            <table class="admin-users-table">
                <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Last Login</th><th>Admin</th><th>Status</th><th>Permissions</th><th>Actions</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;
        
        // bind admin toggles
        container.querySelectorAll('.admin-toggle').forEach(ch => {
            ch.addEventListener('change', async function() {
                const tr = this.closest('tr');
                const id = tr.dataset.id;
                const isAdmin = this.checked;
                try {
                    const r = await fetch(apiUrl(`/api/admin/users/${id}`), {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ isAdmin })
                    });
                    if (!r.ok) {
                        alert('Failed to update user');
                        this.checked = !isAdmin;
                        return;
                    }
                } catch (err) {
                    console.error('Error updating user admin flag', err);
                    alert('Error updating user');
                    this.checked = !isAdmin;
                }
            });
        });
    } catch (err) { container.textContent = 'Error loading users.'; }
}

// Admin management functions
function showCreateAdminForm() {
    document.getElementById('create-admin-form').style.display = 'block';
}

function hideCreateAdminForm() {
    document.getElementById('create-admin-form').style.display = 'none';
    document.getElementById('create-admin-form').querySelector('form').reset();
}

async function createAdmin(event) {
    event.preventDefault();
    const name = document.getElementById('admin-name').value;
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    const permissions = Array.from(document.querySelectorAll('#create-admin-form input[type="checkbox"]:checked')).map(cb => cb.value);
    
    try {
        const res = await fetch(apiUrl('/api/admin/create-admin'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name, email, password, permissions })
        });
        
        if (res.ok) {
            alert('Admin created successfully!');
            hideCreateAdminForm();
            loadAdminUsers();
        } else {
            const error = await res.json();
            alert(`Failed to create admin: ${error.message}`);
        }
    } catch (err) {
        alert('Error creating admin');
    }
}

function showBanForm(userId) {
    document.getElementById('ban-user-id').value = userId;
    document.getElementById('ban-user-form').style.display = 'block';
}

function hideBanForm() {
    document.getElementById('ban-user-form').style.display = 'none';
    document.getElementById('ban-user-form').querySelector('form').reset();
}

async function banUser(event) {
    event.preventDefault();
    const userId = document.getElementById('ban-user-id').value;
    const duration = document.getElementById('ban-duration').value;
    const reason = document.getElementById('ban-reason').value;
    
    try {
        const res = await fetch(apiUrl(`/api/admin/ban/${userId}`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ duration: duration ? parseInt(duration) : null, reason })
        });
        
        if (res.ok) {
            alert('User banned successfully!');
            hideBanForm();
            loadAdminUsers();
        } else {
            const error = await res.json();
            alert(`Failed to ban user: ${error.message}`);
        }
    } catch (err) {
        alert('Error banning user');
    }
}

async function unbanUser(userId) {
    if (!confirm('Are you sure you want to unban this user?')) return;
    
    try {
        const res = await fetch(apiUrl(`/api/admin/unban/${userId}`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            alert('User unbanned successfully!');
            loadAdminUsers();
        } else {
            const error = await res.json();
            alert(`Failed to unban user: ${error.message}`);
        }
    } catch (err) {
        alert('Error unbanning user');
    }
}

function showPermissionsForm(userId, currentPermissions) {
    document.getElementById('permissions-user-id').value = userId;
    const checkboxes = document.querySelectorAll('#permissions-checkboxes input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = currentPermissions.includes(cb.value);
    });
    document.getElementById('permissions-form').style.display = 'block';
}

function hidePermissionsForm() {
    document.getElementById('permissions-form').style.display = 'none';
}

async function setPermissions(event) {
    event.preventDefault();
    const userId = document.getElementById('permissions-user-id').value;
    const permissions = Array.from(document.querySelectorAll('#permissions-checkboxes input[type="checkbox"]:checked')).map(cb => cb.value);
    
    try {
        const res = await fetch(apiUrl(`/api/admin/permissions/${userId}`), {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ permissions })
        });
        
        if (res.ok) {
            alert('Permissions updated successfully!');
            hidePermissionsForm();
            loadAdminUsers();
        } else {
            const error = await res.json();
            alert(`Failed to update permissions: ${error.message}`);
        }
    } catch (err) {
        alert('Error updating permissions');
    }
}

function addProduct() { const name = prompt('Product name:'); const price = prompt('Product price:'); if (name && price) alert('Product added (simulated)'); }
