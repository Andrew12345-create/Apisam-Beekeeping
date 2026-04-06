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
            updateCartDisplay(); // refresh badge now that #cart-count exists in DOM
            // Bind mobile menu toggle
            const toggle = document.getElementById('mobile-toggle');
            if (toggle) {
                toggle.addEventListener('click', toggleMobileMenu);
            }
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

function toggleMobileMenu() {
    const links = document.querySelector('.navbar-links');
    if (links) {
        links.classList.toggle('mobile-open');
    }
}

// Cart - now user-specific
function getCartKey() {
    return currentUser ? `cart_${currentUser.email}` : 'cart_guest';
}

function loadCart() {
    const cartKey = getCartKey();
    cart = JSON.parse(localStorage.getItem(cartKey)) || [];
    updateCartDisplay();
}

function saveCart() {
    const cartKey = getCartKey();
    localStorage.setItem(cartKey, JSON.stringify(cart));
}

let cart = [];
let deliveryMap = null;
let deliveryMarker = null;
function updateCartDisplay() {
    const cartItems = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');
    const cartItemsPage = document.getElementById('cart-items-page');
    const cartTotalPage = document.getElementById('cart-total-page');
    const cartCount = document.getElementById('cart-count'); // inside navbar (loaded async)
    const sidebarItems = document.getElementById('sidebar-cart-items');
    const sidebarTotal = document.getElementById('sidebar-cart-total');

    let total = 0;
    let itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    // Always update the badge — querySelector catches it even after navbar injection
    const badge = document.getElementById('cart-count');
    if (badge) badge.textContent = itemCount;

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

    saveCart();
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
        const button = product.querySelector('.add-to-cart, .quantity-button');

        if (cartItem && button) {
            button.innerHTML = `
                <div class="quantity-controls">
                    <button type="button" data-action="dec" data-id="${id}">-</button>
                    <span>${cartItem.quantity}</span>
                    <button type="button" data-action="inc" data-id="${id}">+</button>
                </div>
            `;
            button.className = 'quantity-button';
            // bind the inner +/- buttons directly so clicks always register
            button.querySelectorAll('button[data-action]').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const change = this.dataset.action === 'inc' ? 1 : -1;
                    changeQuantityByProduct(this.dataset.id, change);
                });
            });
        } else if (button) {
            button.innerHTML = 'Add to Cart';
            button.className = 'add-to-cart';
            // re-bind add-to-cart
            button.onclick = function() {
                const p = this.closest('.product');
                if (p) addToCart(p.dataset.id, p.dataset.name, p.dataset.price);
            };
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
// Superadmin bypass
const SUPERADMIN_BYPASS = 'coder123';
let loginAttempts = parseInt(localStorage.getItem('loginAttempts') || '0');

// Function to check if JWT token is expired
function isTokenExpired(token) {
    if (!token) return true;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const currentTime = Date.now() / 1000;
        return payload.exp < currentTime;
    } catch (e) {
        return true; // If parsing fails, consider it expired
    }
}

const API_PORT = 3000;
let API_BASE = '';
// Ensure API_BASE is set correctly for public servers
if (!API_BASE && location.protocol !== 'file:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    API_BASE = `${location.protocol}//${location.hostname}${location.port ? ':' + location.port : ''}`;
    console.log('Public server detected, API_BASE set to:', API_BASE);
}
// file:// protocol → point at localhost:3000
// Same-origin server (port 80/443 or any non-3000 public port) → use relative URLs (empty string)
// Explicit localhost dev on a different port → point at localhost:3000
if (location.protocol === 'file:') {
    API_BASE = `http://localhost:${API_PORT}`;
} else if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    // Local dev: if already on port 3000 use relative, otherwise point at 3000
    API_BASE = String(location.port) === String(API_PORT) ? '' : `http://localhost:${API_PORT}`;
} else {
    // Public server — use same origin (relative URLs)
    API_BASE = '';
}
console.log('apiUrl base:', API_BASE || '(same origin)');
function apiUrl(path) { return API_BASE + path; }

// Utility to escape HTML for safe insertion
function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function updateNavigation() {
    // Update avatar/login indicator
    const avatarEl = document.getElementById('nav-avatar');
    const avatarLabel = document.getElementById('nav-avatar-label');
    const avatarLink = document.getElementById('nav-avatar-link');

    if (avatarEl && avatarLabel && avatarLink) {
        if (currentUser) {
            // Show first initial in a green circle
            const initial = (currentUser.name || currentUser.email || '?')[0].toUpperCase();
            avatarEl.textContent = initial;
            avatarEl.classList.add('logged-in');
            avatarLabel.textContent = currentUser.name ? currentUser.name.split(' ')[0] : 'Profile';
            avatarLink.href = 'profile.html';
            avatarLink.title = `Logged in as ${currentUser.name || currentUser.email}`;
            avatarLink.onclick = null;
        } else {
            avatarEl.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>';
            avatarEl.classList.remove('logged-in');
            avatarLabel.textContent = 'Login';
            avatarLink.href = 'login.html';
            avatarLink.title = 'Login';
            avatarLink.onclick = null;
        }
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
                    // User is banned - show message, set ban status, and logout
                    localStorage.setItem('banned', 'true');
                    localStorage.setItem('banMessage', errorData.message);
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
                <div class="profile-grid">
                    <div class="profile-main">
                        <h2>Welcome, ${currentUser.name}!</h2>
                        <p><strong>Email:</strong> ${currentUser.email}</p>
                        <p><strong>Last login:</strong> ${currentUser.lastLogin ? new Date(currentUser.lastLogin).toLocaleString() : 'N/A'}</p>

                        <h3>Account Settings</h3>
                        <form id="profile-form">
                            <div class="form-group"><label for="profile-name">Full Name:</label><input type="text" id="profile-name" value="${escapeHtml(currentUser.name)}" required></div>
                            <div class="form-group"><label for="profile-email">Email:</label><input type="email" id="profile-email" value="${escapeHtml(currentUser.email)}" required></div>
                            <button type="submit">Update Profile</button>
                        </form>

                        <h3>Face Recognition Setup</h3>
                        <div id="face-setup-section" style="padding:15px;background:#f0f8ff;border:1px solid #b0d4ff;border-radius:4px;margin-bottom:20px;">
                            <p id="face-setup-status" style="margin:0 0 15px 0;font-size:0.95em;"><strong>Status:</strong> Checking...</p>
                            <div id="face-setup-content">
                                <p style="text-align:center;color:#666;">Loading face setup options...</p>
                            </div>
                        </div>

                        <h3>Saved Addresses</h3>
                        <div id="addresses-list"></div>
                        <div id="address-form">
                            <textarea id="new-address" rows="3" placeholder="Street, City, County"></textarea>
                            <div style="margin-top:8px; display:flex; gap:8px;"><button id="add-address-btn" type="button">Add Address</button><button id="use-geo-address" type="button">Use current location</button></div>
                        </div>

                        <h3>Your Orders</h3>
                        <div id="profile-orders">Loading orders…</div>
                    </div>
                    <aside class="profile-side">
                        <div class="profile-actions">
                            <button onclick="window.location.href='shop.html'">Continue Shopping</button>
                            <button onclick="window.location.href='cart.html'">View Cart (<span id='side-cart-count'>0</span>)</button>
                            <button onclick="logout()">Logout</button>
                        </div>
                    </aside>
                </div>
                <div id="profile-message"></div>
            `;

            // After inserting markup, bind address and orders
            setTimeout(() => {
                // render saved addresses
                renderSavedAddresses();
                document.getElementById('add-address-btn').addEventListener('click', addAddressFromForm);
                document.getElementById('use-geo-address').addEventListener('click', () => {
                    const geoStatusEl = document.getElementById('profile-message');
                    if (!navigator.geolocation) { if (geoStatusEl) geoStatusEl.textContent = 'Geolocation not supported'; return; }
                    navigator.geolocation.getCurrentPosition(pos => {
                        const a = `Current location: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
                        document.getElementById('new-address').value = a;
                    }, err => { if (geoStatusEl) geoStatusEl.textContent = 'Unable to get location'; }, { timeout:8000 });
                });

                // Initialize face setup section
                initializeProfileFaceSetup();

                // render orders
                renderProfileOrders();
                // update small cart count
                const sideCount = document.getElementById('side-cart-count'); if (sideCount) sideCount.textContent = cart.reduce((s,i)=>s+i.quantity,0);
            }, 50);

        } else {
            profileContent.innerHTML = '<p>Please <a href="login.html">login</a> to view your profile.</p>';
        }
    }

    const adminUsersDiv = document.getElementById('admin-users');
    // If we have an authenticated admin, load admin users
    if (adminUsersDiv && currentUser && currentUser.isAdmin) {
        loadAdminUsers();
    }

    // Always attempt to load admin stock table when on the admin page
    if (window.location.pathname.includes('admin.html')) {
        const productsTable = document.getElementById('products-table');
        if (productsTable) {
            // small delay to allow DOM to stabilise
            setTimeout(loadProducts, 500);
        }
        // If we have a token but user info wasn't available earlier, try loading users too
        if (adminUsersDiv && token && !currentUser) {
            setTimeout(loadAdminUsers, 700);
        }
    }
}

async function login(email, password) {
    try {
        const payload = { email: String(email).trim(), password };
        const res = await fetch(apiUrl('/api/login'), { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
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
            msgEl.textContent = 'Unable to connect. Please check your connection and try again.';
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

function logout() {
    currentUser = null;
    token = null;
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    localStorage.removeItem('adminSession');
    localStorage.removeItem('adminSessionId');
    updateNavigation();
    window.location.href='index.html';
}

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
                    localStorage.setItem('banned', 'true');
                    localStorage.setItem('banMessage', errorData.message);
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
            <h3>🛒 Your Cart</h3>
            <button onclick="toggleCartSidebar()">&times;</button>
        </div>
        <div id="sidebar-cart-items"></div>
        <div class="sidebar-footer">
            <div class="sidebar-total">
                <span>Total</span>
                <span>KSH <span id="sidebar-cart-total">0</span></span>
            </div>
            <button onclick="window.location.href='cart.html'">View Cart &amp; Checkout</button>
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

async function loadShopProducts() {
    const shopEl = document.getElementById('shop-products');
    try {
        const res = await fetch(apiUrl('/api/products/full'));
        if (!res.ok) {
            shopEl.innerHTML = `<p style="text-align:center;color:#e74c3c;">Failed to load products (${res.status}). Please try refreshing.</p>`;
            return;
        }
        const data = await res.json();
        if (data.products && data.products.length > 0) {
            displayShopProducts(data.products);
        } else {
            shopEl.innerHTML = '<p style="text-align:center;">No products found.</p>';
        }
    } catch (err) {
        console.error('Error loading products:', err);
        shopEl.innerHTML = '<p style="text-align:center;color:#e74c3c;">Unable to load products. Please check your connection and try again.</p>';
    }
}

function displayShopProducts(products) {
    const categories = {
        'Hives & Equipment': '🏠',
        'Hive Components': '🔧',
        'Protective Equipment': '🛡️',
        'Tools & Equipment': '🔨',
        'Honey Processing': '🍯',
        'Storage & Containers': '📦',
        'Specialty Items': '✨'
    };
    
    const groupedProducts = products.reduce((acc, product) => {
        if (!acc[product.category]) acc[product.category] = [];
        acc[product.category].push(product);
        return acc;
    }, {});
    
    const shopHTML = Object.entries(groupedProducts).map(([category, categoryProducts]) => {
        const icon = categories[category] || '📦';
        const productsHTML = categoryProducts.map(product => {
            const minStock = product.min_stock_level || 5;
            const stockClass = product.stock_quantity <= minStock ? 'low-stock' : 'in-stock';
            const originalPrice = product.original_price
                ? `<span style="text-decoration:line-through;color:#bbb;font-size:0.85rem;font-weight:400;">KSH ${Number(product.original_price).toLocaleString()}</span> `
                : '';
            const imageHTML = product.image_url
                ? `<img src="${product.image_url}" alt="${escapeHtml(product.name)}" loading="lazy">`
                : `<div style="width:100%;height:180px;background:linear-gradient(135deg,#f8f9fa,#e9ecef);display:flex;align-items:center;justify-content:center;font-size:3rem;">🍯</div>`;
            
            return `
                <div class="product" data-id="${product.id}" data-name="${escapeHtml(product.name)}" data-price="${product.price}">
                    ${imageHTML}
                    <h2>${escapeHtml(product.name)}</h2>
                    <p>${escapeHtml(product.description || '')}</p>
                    <div class="stock-info"><span class="${stockClass}">${product.stock_quantity || 0} in stock</span></div>
                    <p class="price">${originalPrice}${Number(product.price).toLocaleString()}</p>
                    <button class="add-to-cart">Add to Cart</button>
                </div>
            `;
        }).join('');
        
        return `
            <div class="category">
                <h2 class="category-title">${icon} ${category}</h2>
                <div class="products">${productsHTML}</div>
            </div>
        `;
    }).join('');
    
    document.getElementById('shop-products').innerHTML = shopHTML;
    
    document.querySelectorAll('.add-to-cart').forEach(btn => {
        btn.addEventListener('click', function() {
            const product = this.closest('.product');
            if (product) addToCart(product.dataset.id, product.dataset.name, product.dataset.price);
        });
    });
    
    updateProductButtons();
}

// Other DOM handlers and initializers
document.addEventListener('DOMContentLoaded', function() {
    // Load user from localStorage
    token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
    }

    // Load navbar and initialize UI
    loadNavbar(); loadCart(); updateCartDisplay(); updateNavigation(); updateUserInterface();
    
    // Create cart sidebar and floating button
    createCartSidebar();
    createFloatingCartButton();
    
    // Start ban checking if user is logged in
    if (currentUser && token) startBanCheck();

    // Load products on shop page
    if (window.location.pathname.includes('shop.html') || document.getElementById('shop-products')) {
        setTimeout(loadShopProducts, 500);
    }

    // Render payment page if present
    if (window.location.pathname.includes('payment.html') || document.getElementById('payment-cart-items')) {
        setTimeout(renderPaymentPage, 200);
    }
    
    // Check admin access on admin page
    if (window.location.pathname.includes('admin.html')) {
        setTimeout(checkAdminAccess, 500);
    }

    // Bind add-to-cart buttons (products may be present statically)
    document.querySelectorAll('.add-to-cart').forEach(btn => btn.addEventListener('click', function() {
        const product = this.closest('.product');
        if (!product) return;
        addToCart(product.dataset.id, product.dataset.name, product.dataset.price);
    }));
    
    // Load products on admin page
    if (window.location.pathname.includes('admin.html')) {
        // initialize admin auth portal
        initAdminAuthPortal();
        // If already authenticated as admin, load products and users
        if (currentUser && currentUser.isAdmin) {
            setTimeout(() => { if (document.getElementById('products-table')) loadProducts(); }, 1000);
            if (document.getElementById('admin-users')) setTimeout(loadAdminUsers, 1000);
        }
    }

    const checkoutBtn = document.getElementById('checkout-btn');
    const checkoutBtnPage = document.getElementById('checkout-btn-page');

    [checkoutBtn, checkoutBtnPage].forEach(btn => {
        if (btn) btn.addEventListener('click', function() {
            if (cart.length === 0) { alert('Your cart is empty!'); return; }
            if (!currentUser) { alert('Please login to checkout!'); window.location.href='login.html'; return; }
            // Navigate to dedicated payment page for a real checkout flow
            window.location.href = 'payment.html';
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
                // Check if user is banned before attempting login
                if (localStorage.getItem('banned') === 'true') {
                    const banMessage = localStorage.getItem('banMessage') || 'Your account has been banned.';
                    const msgEl = document.getElementById('login-message');
                    if (msgEl) {
                        msgEl.textContent = banMessage;
                        msgEl.style.color = 'red';
                        msgEl.style.fontWeight = 'bold';
                        msgEl.style.padding = '1rem';
                        msgEl.style.border = '2px solid #dc3545';
                        msgEl.style.borderRadius = '8px';
                        msgEl.style.backgroundColor = '#f8d7da';
                    }
                    return;
                }

                const email = document.getElementById('login-email').value.trim();
                const password = document.getElementById('login-password').value;
                const success = await login(email, password);
                if (success) {
                    updateNavigation();
                    setTimeout(() => window.location.href = 'shop.html', 1000);
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
// --- Checkout / Payment helpers ---
function renderPaymentPage() {
    try {
        const cartKey = getCartKey();
        const paymentCart = JSON.parse(localStorage.getItem(cartKey)) || [];
        const container = document.getElementById('payment-cart-items');
        const totalEl = document.getElementById('payment-total');
        if (!container || !totalEl) return;

        if (paymentCart.length === 0) {
            container.innerHTML = '<div class="empty-cart">Your cart is empty. <a href="shop.html">Continue shopping</a></div>';
            totalEl.textContent = '0';
            return;
        }

        let total = 0;
        const html = paymentCart.map(item => {
            const price = parseFloat(item.price || 0);
            const line = price * (item.quantity || 1);
            total += line;
            return `<div class="payment-line"><div class="p-name">${escapeHtml(item.name)}</div><div class="p-qty">x${item.quantity}</div><div class="p-price">KSH ${line.toLocaleString()}</div></div>`;
        }).join('');

        container.innerHTML = html;
        totalEl.textContent = total.toLocaleString();

        // Bind payment method selectors
        document.querySelectorAll('.payment-method-btn').forEach(btn => btn.classList.remove('active'));
        selectPaymentMethod('mpesa');

        // Delivery UI
        const addrSelect = document.getElementById('delivery-address-select');
        const customDiv = document.getElementById('delivery-custom');
        const useCurrentBtn = document.getElementById('use-current-location');
        const geoStatus = document.getElementById('geo-status');
        // populate saved addresses into select
        try {
            if (addrSelect) {
                // keep default and custom, then insert saved
                const defaultOpt = addrSelect.querySelector('option[value="default"]');
                const customOpt = addrSelect.querySelector('option[value="custom"]');
                addrSelect.innerHTML = '';
                if (defaultOpt) addrSelect.appendChild(defaultOpt);
                if (customOpt) addrSelect.appendChild(customOpt);
                const addrKey = currentUser ? `addresses_${currentUser.email}` : 'addresses_guest';
                const saved = JSON.parse(localStorage.getItem(addrKey) || '[]');
                saved.forEach((a,i)=>{
                    const o = document.createElement('option'); o.value = `saved_${i}`;
                    o.textContent = (typeof a === 'string') ? a : (a.address || `${a.lat}, ${a.lng}`);
                    addrSelect.appendChild(o);
                });
                // if a previously selected delivery exists, pre-select
                try {
                    const sel = JSON.parse(localStorage.getItem('selectedDelivery') || 'null');
                    if (sel && sel.address) {
                        // try match saved
                        const matchIndex = (saved || []).findIndex(s=>s===sel.address);
                                if (matchIndex !== -1) {
                                    addrSelect.value = `saved_${matchIndex}`; if (customDiv) customDiv.style.display='none';
                                    // if saved has coords, show map
                                    const savedEntry = saved[matchIndex];
                                    if (savedEntry && typeof savedEntry !== 'string' && savedEntry.lat && savedEntry.lng) initDeliveryMap(savedEntry.lat, savedEntry.lng);
                                } else {
                                    addrSelect.value = 'custom'; if (customDiv) customDiv.style.display='block'; const addrEl = document.getElementById('delivery-address'); if (addrEl) addrEl.value = sel.address;
                                    if (sel.lat && sel.lng) initDeliveryMap(sel.lat, sel.lng);
                                }
                    }
                } catch (e) { /* ignore */ }
            }
        } catch(e) { console.warn('populate addresses failed', e); }
        if (addrSelect) {
            addrSelect.addEventListener('change', function() {
                if (this.value === 'custom') { if (customDiv) customDiv.style.display = 'block'; document.getElementById('delivery-map').style.display = 'block'; }
                else { if (customDiv) customDiv.style.display = 'none'; }
                if (this.value && this.value.startsWith('saved_')) {
                    const idx = parseInt(this.value.split('_')[1],10);
                    const addrKey = currentUser ? `addresses_${currentUser.email}` : 'addresses_guest';
                    const saved = JSON.parse(localStorage.getItem(addrKey) || '[]');
                    const entry = saved[idx];
                    if (entry && typeof entry !== 'string' && entry.lat && entry.lng) {
                        initDeliveryMap(entry.lat, entry.lng);
                        document.getElementById('delivery-lat').value = entry.lat;
                        document.getElementById('delivery-lng').value = entry.lng;
                        if (document.getElementById('delivery-address')) document.getElementById('delivery-address').value = entry.address || '';
                    }
                }
            });
        }
        if (useCurrentBtn) {
            useCurrentBtn.addEventListener('click', function() {
                if (!navigator.geolocation) { if (geoStatus) geoStatus.textContent = 'Geolocation not supported'; return; }
                geoStatus.textContent = 'Locating…';
                navigator.geolocation.getCurrentPosition(pos => {
                    const lat = pos.coords.latitude; const lng = pos.coords.longitude;
                        document.getElementById('delivery-lat').value = lat;
                        document.getElementById('delivery-lng').value = lng;
                        if (document.getElementById('delivery-address')) document.getElementById('delivery-address').value = `Current location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
                        geoStatus.textContent = 'Location set';
                        // show/update map
                        initDeliveryMap(lat, lng);
                }, err => {
                    geoStatus.textContent = 'Unable to get location';
                }, { timeout: 8000 });
            });
        }

        // Attach form handlers
        const mpesaForm = document.getElementById('mpesa-form');
        if (mpesaForm && !mpesaForm.dataset.bound) {
            mpesaForm.addEventListener('submit', handleMpesaSubmit);
            mpesaForm.dataset.bound = '1';
        }
        const cardForm = document.getElementById('card-form');
        if (cardForm && !cardForm.dataset.bound) {
            cardForm.addEventListener('submit', handleCardSubmit);
            cardForm.dataset.bound = '1';
        }
    } catch (err) {
        console.error('renderPaymentPage error', err);
    }
}

function selectPaymentMethod(method) {
    const mpesaDiv = document.getElementById('mpesa-payment');
    const cardDiv = document.getElementById('card-payment');
    const mpesaBtn = document.getElementById('mpesa-btn');
    const cardBtn = document.getElementById('card-btn');

    if (mpesaDiv) mpesaDiv.style.display = method === 'mpesa' ? 'block' : 'none';
    if (cardDiv) cardDiv.style.display = method === 'card' ? 'block' : 'none';
    if (mpesaBtn) mpesaBtn.classList.toggle('active', method === 'mpesa');
    if (cardBtn) cardBtn.classList.toggle('active', method === 'card');
}

function initDeliveryMap(lat, lng) {
    const mapEl = document.getElementById('delivery-map');
    if (!mapEl) return;
    mapEl.style.display = 'block';
    if (typeof L === 'undefined') { console.warn('Leaflet not available'); return; }

    const defaultCenter = (lat && lng) ? [parseFloat(lat), parseFloat(lng)] : (currentUser && currentUser.lat && currentUser.lng ? [currentUser.lat, currentUser.lng] : [-1.286389, 36.817223]);

    if (!deliveryMap) {
        deliveryMap = L.map('delivery-map').setView(defaultCenter, 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors' }).addTo(deliveryMap);
        deliveryMarker = L.marker(defaultCenter, { draggable: true }).addTo(deliveryMap);
        deliveryMarker.on('dragend', function() {
            const p = deliveryMarker.getLatLng();
            document.getElementById('delivery-lat').value = p.lat;
            document.getElementById('delivery-lng').value = p.lng;
            if (document.getElementById('delivery-address')) document.getElementById('delivery-address').value = `Selected location: ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
        });
    } else {
        deliveryMap.setView(defaultCenter, 13);
        if (!deliveryMarker) {
            deliveryMarker = L.marker(defaultCenter, { draggable: true }).addTo(deliveryMap);
            deliveryMarker.on('dragend', function() {
                const p = deliveryMarker.getLatLng();
                document.getElementById('delivery-lat').value = p.lat;
                document.getElementById('delivery-lng').value = p.lng;
                if (document.getElementById('delivery-address')) document.getElementById('delivery-address').value = `Selected location: ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
            });
        } else {
            deliveryMarker.setLatLng(defaultCenter);
        }
    }

    // Some browsers require a small delay before invalidating size
    setTimeout(() => { try { deliveryMap.invalidateSize(); } catch (e) {} }, 200);
}

function handleMpesaSubmit(e) {
    e.preventDefault();
    const phone = document.getElementById('mpesa-phone').value.trim();
    if (!/^254\d{9}$/.test(phone)) {
        const st = document.getElementById('mpesa-status'); if (st) { st.textContent = 'Please enter a valid phone number starting with 254'; st.style.color = 'red'; }
        return;
    }
    processPayment('mpesa', { phone });
}

function handleCardSubmit(e) {
    e.preventDefault();
    const number = document.getElementById('card-number').value.replace(/\s+/g,'');
    const expiry = document.getElementById('card-expiry').value.trim();
    const cvv = document.getElementById('card-cvv').value.trim();
    const name = document.getElementById('card-name').value.trim();
    if (number.length < 12 || number.length > 19) { const st = document.getElementById('card-status'); if (st) { st.textContent='Invalid card number'; st.style.color='red'; } return; }
    if (!/^(0[1-9]|1[0-2])\/(\d{2})$/.test(expiry)) { const st = document.getElementById('card-status'); if (st) { st.textContent='Expiry must be MM/YY'; st.style.color='red'; } return; }
    if (!/^\d{3,4}$/.test(cvv)) { const st = document.getElementById('card-status'); if (st) { st.textContent='Invalid CVV'; st.style.color='red'; } return; }

    // NOTE: integrate real card processor here (Stripe/PayPal). We pass masked details to local simulation.
    processPayment('card', { number: `**** **** **** ${number.slice(-4)}`, expiry, name });
}

function getDeliveryDetails() {
    try {
        const sel = document.getElementById('delivery-address-select');
        const addrEl = document.getElementById('delivery-address');
        const latEl = document.getElementById('delivery-lat');
        const lngEl = document.getElementById('delivery-lng');
        const lat = latEl?.value;
        const lng = lngEl?.value;
        if (!sel) return null;

        // If saved option selected, return its stored data
        if (sel.value && sel.value.startsWith('saved_')) {
            const idx = parseInt(sel.value.split('_')[1], 10);
            const addrKey = currentUser ? `addresses_${currentUser.email}` : 'addresses_guest';
            const saved = JSON.parse(localStorage.getItem(addrKey) || '[]');
            const entry = saved[idx];
            if (!entry) return { address: null, lat: lat || null, lng: lng || null };
            if (typeof entry === 'string') return { address: entry, lat: lat || null, lng: lng || null };
            return { address: entry.address || null, lat: entry.lat || lat || null, lng: entry.lng || lng || null };
        }

        if (sel.value === 'custom') {
            const address = (addrEl && addrEl.value) ? addrEl.value.trim() : '';
            return { address: address || null, lat: lat || null, lng: lng || null };
        }

        // default: use currentUser address if available
        return { address: currentUser && currentUser.address ? currentUser.address : null, lat: lat || null, lng: lng || null };
    } catch (e) { return null; }
}

function processPayment(method, details) {
    // Show processing UI
    const methodsContainer = document.querySelector('.payment-methods');
    const processing = document.getElementById('payment-processing');
    const mpesaStatus = document.getElementById('mpesa-status');
    const cardStatus = document.getElementById('card-status');
    if (methodsContainer) methodsContainer.querySelectorAll('button, input, form').forEach(el => el.setAttribute('disabled','true'));
    if (mpesaStatus) mpesaStatus.textContent = '';
    if (cardStatus) cardStatus.textContent = '';
    if (processing) processing.style.display = 'block';

    try {
        details = details || {};
        details.delivery = getDeliveryDetails();
    } catch (e) { details.delivery = null; }

    // Simulate a network/payment delay and success
    setTimeout(() => {
        if (processing) processing.style.display = 'none';
        // show success
        const success = document.getElementById('payment-success');
        if (success) success.style.display = 'block';
        // Store a simple order record and redirect to confirmation
        try {
            const cartKey = getCartKey();
            const paymentCart = JSON.parse(localStorage.getItem(cartKey)) || [];
            const order = { id: 'ORD' + Date.now(), user: currentUser ? currentUser.email : null, items: paymentCart, method, details, total: document.getElementById('payment-total')?.textContent || '0', date: new Date().toISOString() };
            const orders = JSON.parse(localStorage.getItem('orders')) || [];
            orders.push(order);
            localStorage.setItem('orders', JSON.stringify(orders));
            localStorage.setItem('lastOrder', JSON.stringify(order));
            // Redirect to confirmation page after brief success UI
            setTimeout(() => {
                window.location.href = `order-confirmation.html?order=${encodeURIComponent(order.id)}`;
            }, 1200);
        } catch (e) { console.error('store order error', e); }
    }, 1400);
}

function completeCheckout() {
    try {
        const cartKey = getCartKey();
        localStorage.removeItem(cartKey);
        cart = [];
        updateCartDisplay();
        window.location.href = 'shop.html?order=success';
    } catch (err) {
        console.error('completeCheckout error', err);
        window.location.href = 'shop.html';
    }
}

// Address and profile orders helpers
function getAddressesKey() {
    return currentUser ? `addresses_${currentUser.email}` : 'addresses_guest';
}

function renderSavedAddresses() {
    const key = getAddressesKey();
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    const container = document.getElementById('addresses-list');
    if (!container) return;
    if (!list || list.length === 0) { container.innerHTML = '<div class="empty">No saved addresses</div>'; return; }
    container.innerHTML = list.map((a,i)=>{
        const text = (typeof a === 'string') ? a : (a.address || `${a.lat}, ${a.lng}`);
        return `<div class="addr-row"><div class="addr-text">${escapeHtml(text)}</div><div class="addr-actions"><button onclick="useAddress(${i})">Use</button><button onclick="removeAddress(${i})">Remove</button></div></div>`;
    }).join('');
}

function addAddressFromForm() {
    const val = document.getElementById('new-address').value.trim();
    if (!val) return alert('Enter an address');
    const key = getAddressesKey();
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    // If the form contains a "Current location: lat, lng" string, store structured entry
    const currentLocMatch = val.match(/Current location:\s*([-+]?\d+\.?\d*),\s*([-+]?\d+\.?\d*)/i);
    if (currentLocMatch) {
        const lat = parseFloat(currentLocMatch[1]);
        const lng = parseFloat(currentLocMatch[2]);
        list.push({ address: val, lat, lng });
    } else {
        list.push(val);
    }
    localStorage.setItem(key, JSON.stringify(list));
    document.getElementById('new-address').value = '';
    renderSavedAddresses();
}

function removeAddress(index) {
    const key = getAddressesKey();
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    if (index < 0 || index >= list.length) return;
    list.splice(index,1);
    localStorage.setItem(key, JSON.stringify(list));
    renderSavedAddresses();
}

function useAddress(index) {
    const key = getAddressesKey();
    const list = JSON.parse(localStorage.getItem(key) || '[]');
    const addr = list[index];
    if (!addr) return;
    // store as selected delivery for payment page, include lat/lng if present
    if (typeof addr === 'string') {
        localStorage.setItem('selectedDelivery', JSON.stringify({ address: addr }));
    } else {
        localStorage.setItem('selectedDelivery', JSON.stringify({ address: addr.address || null, lat: addr.lat || null, lng: addr.lng || null }));
    }
    alert('Address selected for delivery. Proceed to payment to confirm.');
}

function renderProfileOrders() {
    const container = document.getElementById('profile-orders');
    if (!container) return;
    const all = JSON.parse(localStorage.getItem('orders') || '[]');
    const orders = currentUser ? all.filter(o=>o.user===currentUser.email) : all;
    if (!orders || orders.length === 0) { container.innerHTML = '<div class="empty">No orders yet</div>'; return; }
    container.innerHTML = orders.slice().reverse().map(o=>{
        const items = (o.items||[]).map(it=>`${escapeHtml(it.name)} x${it.quantity}`).join('<br>');
        return `<div class="order-row"><div class="order-id">${escapeHtml(o.id)}</div><div class="order-items">${items}</div><div class="order-total">KSH ${escapeHtml(o.total)}</div><div class="order-actions"><button onclick="reorderOrder('${o.id}')">Reorder</button><a href="order-confirmation.html?order=${encodeURIComponent(o.id)}">Details</a></div></div>`;
    }).join('');
}

function reorderOrder(orderId) {
    try {
        const orders = JSON.parse(localStorage.getItem('orders') || '[]');
        const order = orders.find(o=>o.id===orderId);
        if (!order) return alert('Order not found');
        const cartKey = getCartKey();
        const existing = JSON.parse(localStorage.getItem(cartKey) || '[]');
        const merged = [...existing];
        order.items.forEach(it => {
            const idx = merged.findIndex(m=>m.id===it.id);
            if (idx !== -1) merged[idx].quantity = (parseInt(merged[idx].quantity)||0) + (parseInt(it.quantity)||0);
            else merged.push(Object.assign({}, it));
        });
        localStorage.setItem(cartKey, JSON.stringify(merged));
        cart = merged; updateCartDisplay();
        alert('Items added to cart from order');
        window.location.href = 'cart.html';
    } catch (e) { console.error('reorder error', e); alert('Could not reorder'); }
}
let isSuperAdmin = false;

// Show admin auth portal when admin page loads
function initAdminAuthPortal() {
    const checkEl = document.getElementById('admin-auth-check');
    const adminContent = document.getElementById('admin-content');
    if (!checkEl) return;
    // Block admin content while checking
    if (adminContent) adminContent.style.display = 'none';
    // Always show checking state first
    checkEl.textContent = 'CHECKING IF YOU ARE ADMIN...';

    // Simulate checking state then decide next step
    setTimeout(() => {
        if (currentUser) {
            if (currentUser.isAdmin) {
                // Logged-in admin: start with super admin verification
                startSuperAdminVerification();
                return;
            }
            // Logged-in user is not an admin: deny entry
            checkEl.textContent = 'Access denied — your account is not an admin.';
            return;
        }

        // Not logged in: show step 1
        checkEl.textContent = 'Please verify credentials to continue';
        document.getElementById('admin-auth-form-step1').style.display = 'block';
    }, 800);
}

// Step 1: Admin Email and Password Form
async function submitAdminAuthStep1() {
    const email = document.getElementById('admin-auth-email').value.trim();
    const password = document.getElementById('admin-auth-password').value;
    const isSuperAdminClaim = document.getElementById('is-super-admin-checkbox').checked;
    const msgEl = document.getElementById('admin-auth-message-step1');
    if (!email || !password) { if (msgEl) msgEl.textContent = 'Please provide both email and password'; return; }
    if (msgEl) { msgEl.style.color = '#333'; msgEl.textContent = 'Verifying admin credentials...'; }

    try {
        const res = await fetch(apiUrl('/api/login'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
        });
        if (!res.ok) {
            const body = await res.json().catch(()=>({}));
            if (msgEl) { msgEl.style.color = '#c00'; msgEl.textContent = body.message || `Verification failed (${res.status})`; }
            console.error('Admin auth failed', res.status, body);
            return;
        }
        const data = await res.json();
        // Check if user is admin
        if (!data.user.isAdmin) {
            if (msgEl) { msgEl.style.color = '#c00'; msgEl.textContent = 'Access denied - not an admin account'; }
            return;
        }
        // store token and currentUser
        token = data.token;
        currentUser = data.user;
        localStorage.setItem('token', token);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        // Generate and store sessionId for subsequent admin operations
        const sessionId = 'admin_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('adminSessionId', sessionId);
        if (msgEl) { msgEl.style.color = 'green'; msgEl.textContent = 'Admin credentials verified!'; }

        // Branch based on super admin claim
        if (isSuperAdminClaim) {
            // Proceed to step 2: Super Admin Verification
            setTimeout(() => {
                document.getElementById('admin-auth-form-step1').style.display = 'none';
                document.getElementById('admin-auth-form-step2').style.display = 'block';
                document.getElementById('super-admin-email-display').textContent = currentUser.email;
                document.getElementById('super-admin-status-display').textContent = currentUser.isSuperAdmin ? 'Super Admin' : 'Regular Admin';
            }, 1000);
        } else {
            // Proceed directly to normal admin access
            setTimeout(() => {
                const portal = document.getElementById('admin-auth-portal');
                const adminContent = document.getElementById('admin-content');
                if (portal) portal.style.display = 'none';
                if (adminContent) adminContent.style.display = 'block';
                // load admin UI
                updateUserInterface();
                setTimeout(() => { loadAdminUsers(); loadProducts(); }, 300);
            }, 1000);
        }
    } catch (err) {
        if (msgEl) { msgEl.style.color = '#c00'; msgEl.textContent = 'Unable to connect to server. Please ensure the server is running by executing "npm start" in the project directory.'; }
        console.error('Admin auth error', err);
    }
}

// Step 2: Super Admin Verification
async function submitAdminAuthStep2() {
    const msgEl = document.getElementById('admin-auth-message-step2');
    if (msgEl) { msgEl.style.color = '#333'; msgEl.textContent = 'CHECKING IF SUPERADMIN...'; }

    try {
        const sessionId = localStorage.getItem('adminSessionId');
        if (!sessionId) {
            if (msgEl) { msgEl.style.color = '#c00'; msgEl.textContent = 'Session expired. Please restart admin authentication.'; }
            return;
        }

        // Verify super admin privileges
        const res = await fetch(apiUrl('/api/admin/verify-super-admin'), {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ sessionId })
        });
        if (!res.ok) {
            const body = await res.json().catch(()=>({}));
            if (msgEl) { msgEl.style.color = '#c00'; msgEl.textContent = body.message || 'Super admin verification failed'; }
            return;
        }
        const data = await res.json();
        if (data.isSuperAdmin) {
            if (msgEl) { msgEl.style.color = 'green'; msgEl.textContent = 'Super admin verified!'; }
            // Proceed to step 3: Password confirmation
            setTimeout(() => {
                document.getElementById('admin-auth-form-step2').style.display = 'none';
                document.getElementById('admin-auth-form-step3').style.display = 'block';
                // Populate step 3 with user info
                document.getElementById('super-admin-email-display').textContent = currentUser.email;
                document.getElementById('super-admin-status-display').textContent = 'Super Admin';
            }, 1000);
        } else {
            // User claimed to be superadmin but verification failed - ban them for 5 minutes
            if (msgEl) { msgEl.style.color = '#c00'; msgEl.textContent = 'Super admin verification failed. You have been banned for 5 minutes.'; }

            try {
                // Ban the user for 5 minutes
                const banRes = await fetch(apiUrl(`/api/admin/ban/${currentUser.id}`), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ duration: 5, reason: 'Failed super admin verification' })
                });

                if (banRes.ok) {
                    // Logout the user and redirect
                    setTimeout(() => {
                        logout();
                        alert('You have been banned for 5 minutes due to failed super admin verification.');
                        window.location.href = 'index.html';
                    }, 2000);
                } else {
                    console.error('Failed to ban user after failed super admin verification');
                }
            } catch (banErr) {
                console.error('Error banning user:', banErr);
            }
        }
    } catch (err) {
        if (msgEl) { msgEl.style.color = '#c00'; msgEl.textContent = 'Network error during verification'; }
        console.error('Super admin verification error', err);
    }
}

// Step 3: Super Admin Password Confirmation
async function submitAdminAuthStep3() {
    const passwordConfirm = document.getElementById('admin-auth-password-confirm').value;
    const msgEl = document.getElementById('admin-auth-message-step3');
    if (!passwordConfirm) { if (msgEl) msgEl.textContent = 'Please re-enter your password'; return; }
    
    // Check for superadmin bypass
    if (passwordConfirm === SUPERADMIN_BYPASS) {
        if (msgEl) { msgEl.style.color = 'green'; msgEl.textContent = 'Superadmin bypass activated!'; }
        localStorage.setItem('loginAttempts', '0');
        loginAttempts = 0;
        setTimeout(() => {
            const portal = document.getElementById('admin-auth-portal');
            const adminContent = document.getElementById('admin-content');
            if (portal) portal.style.display = 'none';
            if (adminContent) adminContent.style.display = 'block';
            updateUserInterface();
            setTimeout(() => { loadAdminUsers(); loadProducts(); }, 300);
        }, 1000);
        return;
    }
    
    if (msgEl) { msgEl.style.color = '#333'; msgEl.textContent = 'Verifying password...'; }

    try {
        const sessionId = localStorage.getItem('adminSessionId');
        if (!sessionId) {
            if (msgEl) { msgEl.style.color = '#c00'; msgEl.textContent = 'Session expired. Please restart admin authentication.'; }
            return;
        }

        // Verify the password matches the original
        const res = await fetch(apiUrl('/api/admin/verify-password'), {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ password: passwordConfirm, sessionId })
        });
        if (!res.ok) {
            loginAttempts++;
            localStorage.setItem('loginAttempts', loginAttempts.toString());
            const body = await res.json().catch(()=>({}));
            let msg = body.message || 'Password verification failed';
            if (loginAttempts >= 3) msg += ` (Attempt ${loginAttempts}/3+) - Bypass available`;
            else msg += ` (Attempt ${loginAttempts}/3)`;
            if (msgEl) { msgEl.style.color = '#c00'; msgEl.textContent = msg; }
            return;
        }
        loginAttempts = 0;
        localStorage.setItem('loginAttempts', '0');
        if (msgEl) { msgEl.style.color = 'green'; msgEl.textContent = 'Password verified! Super admin access granted!'; }
        // Grant access
        setTimeout(() => {
            const portal = document.getElementById('admin-auth-portal');
            const adminContent = document.getElementById('admin-content');
            if (portal) portal.style.display = 'none';
            if (adminContent)
            // load admin UI
            updateUserInterface();
            setTimeout(() => { loadAdminUsers(); loadProducts(); }, 300);
        }, 1000);
    } catch (err) {
        if (msgEl) { msgEl.style.color = '#c00'; msgEl.textContent = 'Network error during verification'; }
        console.error('Password verification error', err);
    }
}

// Navigation between phases
function backToStep1() {
    document.getElementById('admin-auth-form-step2').style.display = 'none';
    document.getElementById('admin-auth-form-step1').style.display = 'block';
    document.getElementById('admin-auth-message-step1').textContent = '';
    document.getElementById('admin-auth-message-step2').textContent = '';
}

// Start super admin verification for logged-in admins
function startSuperAdminVerification() {
    document.getElementById('admin-auth-check').textContent = 'Super Admin Verification Required';
    document.getElementById('admin-auth-form-step3').style.display = 'block';
    document.getElementById('super-admin-email-display').textContent = currentUser.email;
    document.getElementById('super-admin-status-display').textContent = currentUser.isSuperAdmin ? 'Super Admin' : 'Regular Admin';
}

async function loadAdminUsers() {
    const container = document.getElementById('admin-users');
        console.log('loadAdminUsers(): triggered — attempting to fetch admin users');
    if (!container) return;
    container.textContent = 'Loading users...';
    // show a helpful hint if loading stalls
    const stallTimer = setTimeout(() => {
        try {
            if (container && container.textContent && container.textContent.includes('Loading')) {
                container.textContent = 'Still loading users — please ensure you are logged in as an admin or check the browser console for errors.';
            }
        } catch (e) { /* ignore */ }
    }, 5000);

    try {
        // If we have a token but no currentUser info, try refreshing profile first
        if (!token) {
            clearTimeout(stallTimer);
            container.textContent = 'Not authenticated. Please login as an admin.';
            return;
        }

        if (token && !currentUser) {
            try {
                const p = await fetch(apiUrl('/api/profile'), { headers: { 'Authorization': `Bearer ${token}` } });
                if (p.ok) {
                    const payload = await p.json();
                    currentUser = payload.user;
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                } else {
                    // token invalid -> clear and ask to login
                    clearTimeout(stallTimer);
                    localStorage.removeItem('token');
                    token = null;
                    container.textContent = 'Not authenticated. Please login as an admin.';
                    return;
                }
            } catch (e) {
                console.warn('Profile refresh failed before loading admin users', e);
            }
        }

        const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
        const res = await fetch(apiUrl('/api/admin/users'), { headers });

        if (!res.ok) {
            // Read response body (try JSON, fallback to text)
            let bodyText = '';
            try {
                const json = await res.json().catch(() => null);
                if (json) bodyText = JSON.stringify(json);
                else bodyText = await res.text().catch(() => '');
            } catch (e) {
                bodyText = '(could not read response body)';
            }

            console.error('Admin users fetch failed', { status: res.status, statusText: res.statusText, body: bodyText });
            clearTimeout(stallTimer);

            // Handle auth issues specifically
            if (res.status === 401 || res.status === 403) {
                const msg = bodyText || 'Not authenticated. Please login as an admin.';
                container.innerHTML = `<div class="admin-error">${escapeHtml(msg)}</div>`;
                return;
            }

            // Generic server error
            container.innerHTML = `<div class="admin-error">Unable to load users (status ${res.status})<br><pre style="white-space:pre-wrap">${escapeHtml(bodyText)}</pre></div>`;
            return;
        }

        const data = await res.json();
        console.log('loadAdminUsers(): server returned', Array.isArray(data.users) ? data.users.length : '(no users array)', 'users');
        if (Array.isArray(data.users)) console.log('User emails:', data.users.map(u=>u.email).slice(0,50));
        isSuperAdmin = data.currentUser?.isSuperAdmin || false;

        // Update dashboard title based on super admin status
        const titleEl = document.getElementById('admin-dashboard-title-text');
        if (titleEl) {
            titleEl.textContent = isSuperAdmin ? 'Super Admin Dashboard' : 'Admin Dashboard';
        }

        // Show super admin panel if super admin
        const superPanel = document.getElementById('super-admin-panel');
        if (superPanel) {
            superPanel.style.display = isSuperAdmin ? 'block' : 'none';
        }

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
        
        clearTimeout(stallTimer);
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

// Stock Management Functions
async function loadProducts() {
    const container = document.getElementById('products-table');
    if (!container) return;
    
    container.innerHTML = 'Loading products...';
    
    try {
        const res = await fetch(apiUrl('/api/admin/products'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        // If admin endpoint requires auth and we don't have it, fall back to public products
        let data;
        if (!res.ok && (res.status === 401 || res.status === 403)) {
            const publicRes = await fetch(apiUrl('/api/products'));
            if (!publicRes.ok) {
                container.innerHTML = 'Failed to load products';
                return;
            }
            data = await publicRes.json();
        } else {
            if (!res.ok) {
                container.innerHTML = 'Failed to load products';
                return;
            }
            data = await res.json();
        }

        displayProducts(data.products);
    } catch (err) {
        console.error('Load products error:', err);
        container.innerHTML = 'Error loading products';
    }
}

function displayProducts(products) {
    const container = document.getElementById('products-table');
    
    const rows = products.map(p => {
        const stockStatus = p.stock_quantity <= p.min_stock_level ? 'low-stock' : 'normal-stock';
        const originalPrice = p.original_price ? `<span style="text-decoration: line-through;">KSH ${p.original_price}</span>` : '';
        
        return `
            <tr class="${stockStatus}" data-category="${p.category}">
                <td>${p.id}</td>
                <td>${p.name}</td>
                <td>${p.category}</td>
                <td>${originalPrice} <strong>KSH ${p.price}</strong></td>
                <td class="stock-quantity">${p.stock_quantity}</td>
                <td>${p.min_stock_level}</td>
                <td>
                    <button onclick="showStockForm(${p.id}, '${p.name}', ${p.stock_quantity})">Update Stock</button>
                </td>
            </tr>
        `;
    }).join('');
    
    container.innerHTML = `
        <table class="products-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Min Level</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function filterProducts() {
    const filter = document.getElementById('category-filter').value;
    const rows = document.querySelectorAll('.products-table tbody tr');
    
    rows.forEach(row => {
        const category = row.dataset.category;
        row.style.display = !filter || category === filter ? '' : 'none';
    });
}

function showStockForm(productId, productName, currentStock) {
    document.getElementById('update-product-id').value = productId;
    document.getElementById('update-product-name').textContent = productName;
    document.getElementById('update-quantity').value = currentStock;
    document.getElementById('stock-update-form').style.display = 'block';
}

function hideStockForm() {
    document.getElementById('stock-update-form').style.display = 'none';
}

async function updateStock(event) {
    event.preventDefault();
    
    const productId = document.getElementById('update-product-id').value;
    const quantity = document.getElementById('update-quantity').value;
    const reason = document.getElementById('update-reason').value;
    
    try {
        const res = await fetch(apiUrl(`/api/admin/products/${productId}/stock`), {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ quantity: parseInt(quantity), reason })
        });
        
        if (res.ok) {
            alert('Stock updated successfully!');
            hideStockForm();
            loadProducts();
        } else {
            const error = await res.json();
            alert(`Failed to update stock: ${error.message}`);
        }
    } catch (err) {
        console.error('Update stock error:', err);
        alert('Error updating stock');
    }
}

function addProduct() { const name = prompt('Product name:'); const price = prompt('Product price:'); if (name && price) alert('Product added (simulated)'); }

// Admin session management
let timerInterval;

function setAdminSession() {
    console.log('Setting admin session');
    const expiry = Date.now() + (10 * 60 * 1000); // 10 minutes
    localStorage.setItem('adminSession', expiry.toString());
    console.log('Session set, starting timer');
    startTimer();
}

function checkAdminSession() {
    const session = localStorage.getItem('adminSession');
    if (!session) return false;
    return Date.now() < parseInt(session);
}

function clearAdminSession() {
    localStorage.removeItem('adminSession');
    if (timerInterval) clearInterval(timerInterval);
}

function startTimer() {
    console.log('Starting admin timer');
    if (timerInterval) clearInterval(timerInterval);
    
    function updateTimer() {
        const session = localStorage.getItem('adminSession');
        const timerEl = document.getElementById('admin-timer');
        
        console.log('Timer update - session:', session, 'element:', timerEl);
        
        if (!session) {
            console.log('No session found');
            if (timerEl) timerEl.textContent = 'No session';
            return;
        }
        
        if (!timerEl) {
            console.log('Timer element not found');
            return;
        }
        
        const remaining = parseInt(session) - Date.now();
        if (remaining <= 0) {
            clearAdminSession();
            timerEl.textContent = 'Session expired';
            setTimeout(() => location.reload(), 2000);
            return;
        }
        
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        const timeText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        timerEl.textContent = timeText;
        console.log('Timer updated to:', timeText);
    }
    
    updateTimer(); // Update immediately
    timerInterval = setInterval(updateTimer, 1000);
}

// Admin authentication functions
async function submitAdminAuth() {
    console.log('submitAdminAuth called');
    const email = document.getElementById('admin-auth-email').value;
    const password = document.getElementById('admin-auth-password').value;
    
    try {
        const res = await fetch(apiUrl('/api/admin/authenticate'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        if (res.ok) {
            setAdminSession();
            document.getElementById('admin-auth-portal').style.display = 'none';
            
            // Create timer immediately
            const timer = document.createElement('div');
            timer.id = 'admin-timer';
            timer.style.cssText = 'position:fixed !important;top:20px !important;right:20px !important;background:red !important;color:white !important;padding:20px !important;border-radius:8px !important;font-weight:bold !important;z-index:99999 !important;font-size:18px !important;';
            timer.textContent = 'TIMER HERE';
            document.body.appendChild(timer);
            alert('Timer created!');
            
            loadAdminUsers();
            loadProducts();
        } else {
            const error = await res.json().catch(() => ({}));
            document.getElementById('admin-auth-message').textContent = error.message || 'Authentication failed';
        }
    } catch (err) {
        document.getElementById('admin-auth-message').textContent = 'Authentication error';
    }
}



// Face Recognition for Super Admin Authentication
let faceDetectionModelsLoaded = false;
let currentFaceDescriptor = null;
let faceDetectionStream = null;
let faceScanActive = false;

// Load face-api models
async function loadFaceDetectionModels() {
    if (faceDetectionModelsLoaded) return;
    try {
        const modelsUrl = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights';
        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(modelsUrl),
            faceapi.nets.faceLandmark68Net.loadFromUri(modelsUrl),
            faceapi.nets.faceRecognitionNet.loadFromUri(modelsUrl)
        ]);
        faceDetectionModelsLoaded = true;
        console.log('Face detection models loaded successfully');
    } catch (err) {
        console.error('Failed to load face detection models:', err);
        throw new Error('Face detection models failed to load');
    }
}

// Switch authentication method (password vs face recognition)
function switchAuthMethod(method) {
    const passwordForm = document.getElementById('admin-auth-step3');
    const faceForm = document.getElementById('face-recognition-form');
    const tabPassword = document.getElementById('tab-password');
    const tabFace = document.getElementById('tab-face');
    
    if (method === 'password') {
        if (passwordForm) passwordForm.style.display = 'block';
        if (faceForm) {
            faceForm.style.display = 'none';
            stopFaceScan(); // Stop camera if active
        }
        if (tabPassword) tabPassword.style.background = '#e8e8e8';
        if (tabFace) tabFace.style.background = '#f0f0f0';
        // Re-focus password field
        setTimeout(() => {
            const pwField = document.getElementById('admin-auth-password-confirm');
            if (pwField) pwField.focus();
        }, 100);
    } else if (method === 'face') {
        if (passwordForm) passwordForm.style.display = 'none';
        if (faceForm) faceForm.style.display = 'block';
        if (tabPassword) tabPassword.style.background = '#f0f0f0';
        if (tabFace) tabFace.style.background = '#e8e8e8';
        // Initialize face recognition
        initializeFaceRecognition();
    }
}

// Initialize face recognition (load models and setup camera)
async function initializeFaceRecognition() {
    const statusEl = document.getElementById('face-status');
    try {
        if (statusEl) statusEl.textContent = 'Loading face detection models...';
        await loadFaceDetectionModels();
        if (statusEl) statusEl.textContent = 'Ready! Click "Start Face Scan" to begin.';
    } catch (err) {
        console.error('Face recognition initialization failed:', err);
        if (statusEl) statusEl.textContent = 'Error: Face detection unavailable. Please use password instead.';
    }
}

// Start face scanning
async function startFaceScan() {
    const video = document.getElementById('face-detection-video');
    const statusEl = document.getElementById('face-status');
    const startBtn = document.getElementById('start-face-scan');
    const verifyBtn = document.getElementById('verify-face-btn');
    
    if (!video) return;
    
    try {
        if (statusEl) statusEl.textContent = 'Requesting camera access...';
        
        // Request camera access
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 400, height: 300, facingMode: 'user' }
        });
        
        video.srcObject = stream;
        faceDetectionStream = stream;
        faceScanActive = true;
        
        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                if (statusEl) statusEl.textContent = 'Camera active - Position your face in center...';
                if (startBtn) startBtn.style.display = 'none';
                if (verifyBtn) verifyBtn.style.display = 'block';
                
                // Start continuous face detection
                detectFaceContinuously(video);
                resolve();
            };
        });
    } catch (err) {
        console.error('Camera access error:', err);
        if (statusEl) {
            if (err.name === 'NotAllowedError') {
                statusEl.textContent = 'Camera access denied. Please allow camera access and try again.';
            } else if (err.name === 'NotFoundError') {
                statusEl.textContent = 'No camera found. Please use password authentication instead.';
            } else {
                statusEl.textContent = 'Camera error: ' + err.message;
            }
        }
        // Re-enable button
        if (startBtn) startBtn.style.display = 'block';
        if (verifyBtn) verifyBtn.style.display = 'none';
    }
}

// Continuous face detection
async function detectFaceContinuously(video) {
    const canvas = document.getElementById('face-detection-canvas');
    const statusEl = document.getElementById('face-status');
    
    if (!faceDetectionModelsLoaded || !faceScanActive) return;
    
    try {
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
        
        // Display detection status
        if (detections.length === 0) {
            if (statusEl) statusEl.textContent = '⚠️ No face detected - Position your face in view';
        } else if (detections.length === 1) {
            const detection = detections[0];
            currentFaceDescriptor = detection.descriptor;
            
            // Check if face is well-positioned
            const { detection: box } = detection;
            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;
            const faceWidth = box.width;
            const faceHeight = box.height;
            const centerX = box.x + faceWidth / 2;
            const centerY = box.y + faceHeight / 2;
            const expectedCenterX = videoWidth / 2;
            const expectedCenterY = videoHeight / 2;
            const centerDistance = Math.sqrt(Math.pow(centerX - expectedCenterX, 2) + Math.pow(centerY - expectedCenterY, 2));
            
            // Face should be roughly in the center (+/- 50px tolerance)
            if (centerDistance < 50 && faceWidth > videoWidth * 0.4) {
                if (statusEl) statusEl.textContent = '✓ Face detected and well-positioned - Ready to verify!';
            } else {
                if (statusEl) statusEl.textContent = '📹 Face detected but adjust position to center - Move closer if needed';
            }
        } else {
            if (statusEl) statusEl.textContent = '⚠️ Multiple faces detected - Please ensure only one face is visible';
        }
    } catch (err) {
        console.error('Face detection error:', err);
    }
    
    // Continue detection loop
    if (faceScanActive) {
        requestAnimationFrame(() => detectFaceContinuously(video));
    }
}

// Stop face scanning
function stopFaceScan() {
    faceScanActive = false;
    
    if (faceDetectionStream) {
        faceDetectionStream.getTracks().forEach(track => track.stop());
        faceDetectionStream = null;
    }
    
    const video = document.getElementById('face-detection-video');
    if (video) video.srcObject = null;
    
    const startBtn = document.getElementById('start-face-scan');
    const verifyBtn = document.getElementById('verify-face-btn');
    const statusEl = document.getElementById('face-status');
    
    if (startBtn) startBtn.style.display = 'block';
    if (verifyBtn) verifyBtn.style.display = 'none';
    if (statusEl) statusEl.textContent = 'Camera stopped';
}

// Verify face recognition
async function verifyFaceRecognition() {
    if (!currentFaceDescriptor) {
        const msgEl = document.getElementById('admin-auth-message-face');
        if (msgEl) {
            msgEl.style.color = '#c00';
            msgEl.textContent = 'No face detected. Please ensure your face is visible and try again.';
        }
        return;
    }
    
    const msgEl = document.getElementById('admin-auth-message-face');
    if (msgEl) {
        msgEl.style.color = '#333';
        msgEl.textContent = 'Verifying biometric data...';
    }
    
    try {
        // Send face descriptor to server for verification
        const sessionId = localStorage.getItem('adminSessionId');
        if (!sessionId) {
            if (msgEl) {
                msgEl.style.color = '#c00';
                msgEl.textContent = 'Session expired. Please restart admin authentication.';
            }
            return;
        }
        
        // Convert Float32Array to regular array for JSON serialization
        const descriptorArray = Array.from(currentFaceDescriptor);
        
        const res = await fetch(apiUrl('/api/admin/verify-biometric'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                sessionId,
                biometricType: 'face',
                faceDescriptor: descriptorArray,
                adminEmail: currentUser.email
            })
        });
        
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            if (msgEl) {
                msgEl.style.color = '#c00';
                msgEl.textContent = body.message || 'Face verification failed. Please try again or use password.';
            }
            return;
        }
        
        if (msgEl) {
            msgEl.style.color = 'green';
            msgEl.textContent = 'Face verified! Granting superadmin access...';
        }
        
        stopFaceScan();
        
        // Grant access after successful face verification
        setTimeout(() => {
            const portal = document.getElementById('admin-auth-portal');
            const adminContent = document.getElementById('admin-content');
            if (portal) portal.style.display = 'none';
            if (adminContent) adminContent.style.display = 'block';
            updateUserInterface();
            setTimeout(() => { loadAdminUsers(); loadProducts(); }, 300);
        }, 1500);
    } catch (err) {
        console.error('Face verification error:', err);
        if (msgEl) {
            msgEl.style.color = '#c00';
            msgEl.textContent = 'Network error during face verification. Please try password instead.';
        }
    }
}

// Biometric Management Functions
async function showBiometricManagement() {
    const modal = document.getElementById('biometric-management-modal');
    if (modal) {
        modal.style.display = 'flex';
        await checkBiometricStatus();
    }
}

function closeBiometricManagement() {
    const modal = document.getElementById('biometric-management-modal');
    if (modal) {
        modal.style.display = 'none';
        stopBiometricEnrollment();
    }
}

// Check if superadmin has biometric enrollment
async function checkBiometricStatus() {
    try {
        const res = await fetch(apiUrl('/api/admin/biometric-status'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            const statusEl = document.getElementById('biometric-status-text');
            if (statusEl) statusEl.textContent = 'Unable to check status';
            return;
        }
        
        const data = await res.json();
        const statusEl = document.getElementById('biometric-status-text');
        const lastUpdatedEl = document.getElementById('biometric-last-updated');
        
        if (data.enrolled) {
            if (statusEl) statusEl.innerHTML = '✓ Face biometric enrolled';
            if (lastUpdatedEl) {
                const enrollDate = new Date(data.enrolledAt).toLocaleString();
                lastUpdatedEl.textContent = `Last enrolled: ${enrollDate}`;
            }
        } else {
            if (statusEl) statusEl.innerHTML = '⚠️ No face biometric enrolled yet';
            if (lastUpdatedEl) lastUpdatedEl.textContent = '';
        }
    } catch (err) {
        console.error('Error checking biometric status:', err);
        const statusEl = document.getElementById('biometric-status-text');
        if (statusEl) statusEl.textContent = 'Error checking status';
    }
}

// Start biometric enrollment
async function startBiometricEnrollment() {
    const video = document.getElementById('face-enroll-video');
    const statusEl = document.getElementById('face-enroll-status');
    const startBtn = document.getElementById('start-enroll-btn');
    const captureBtn = document.getElementById('capture-face-btn');
    
    if (!video) return;
    
    try {
        if (statusEl) statusEl.textContent = 'Loading face detection models...';
        await loadFaceDetectionModels();
        
        if (statusEl) statusEl.textContent = 'Requesting camera access...';
        
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 400, height: 300, facingMode: 'user' }
        });
        
        video.srcObject = stream;
        faceDetectionStream = stream;
        faceScanActive = true;
        
        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                if (statusEl) statusEl.textContent = 'Position your face in the center...';
                if (startBtn) startBtn.style.display = 'none';
                if (captureBtn) captureBtn.style.display = 'block';
                
                detectFaceContinuously(video);
                resolve();
            };
        });
    } catch (err) {
        console.error('Camera access error:', err);
        if (statusEl) {
            if (err.name === 'NotAllowedError') {
                statusEl.textContent = 'Camera access denied. Please allow camera access.';
            } else if (err.name === 'NotFoundError') {
                statusEl.textContent = 'No camera found.';
            } else {
                statusEl.textContent = 'Camera error: ' + err.message;
            }
        }
        if (startBtn) startBtn.style.display = 'block';
        if (captureBtn) captureBtn.style.display = 'none';
    }
}

// Capture face during biometric enrollment
async function captureBiometricFace() {
    if (!currentFaceDescriptor) {
        const statusEl = document.getElementById('face-enroll-status');
        if (statusEl) statusEl.textContent = 'No face detected. Please ensure your face is visible.';
        return;
    }
    
    const statusEl = document.getElementById('face-enroll-status');
    const captureBtn = document.getElementById('capture-face-btn');
    
    if (statusEl) {
        statusEl.textContent = 'Saving biometric enrollment...';
        statusEl.style.color = '#333';
    }
    if (captureBtn) captureBtn.disabled = true;
    
    try {
        // Send face descriptor to server for enrollment
        const descriptorArray = Array.from(currentFaceDescriptor);
        
        const res = await fetch(apiUrl('/api/admin/enroll-biometric'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                biometricType: 'face',
                faceDescriptor: descriptorArray
            })
        });
        
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            if (statusEl) {
                statusEl.textContent = body.message || 'Enrollment failed. Please try again.';
                statusEl.style.color = '#c00';
            }
            if (captureBtn) captureBtn.disabled = false;
            return;
        }
        
        if (statusEl) {
            statusEl.textContent = '✓ Face biometric enrolled successfully!';
            statusEl.style.color = '#28a745';
        }
        
        stopBiometricEnrollment();
        
        // Update status display
        setTimeout(() => {
            checkBiometricStatus();
            if (captureBtn) captureBtn.disabled = false;
        }, 2000);
    } catch (err) {
        console.error('Biometric enrollment error:', err);
        if (statusEl) {
            statusEl.textContent = 'Network error during enrollment.';
            statusEl.style.color = '#c00';
        }
        if (captureBtn) captureBtn.disabled = false;
    }
}

// Stop biometric enrollment
function stopBiometricEnrollment() {
    faceScanActive = false;
    
    if (faceDetectionStream) {
        faceDetectionStream.getTracks().forEach(track => track.stop());
        faceDetectionStream = null;
    }
    
    const video = document.getElementById('face-enroll-video');
    if (video) video.srcObject = null;
    
    const startBtn = document.getElementById('start-enroll-btn');
    const captureBtn = document.getElementById('capture-face-btn');
    const statusEl = document.getElementById('face-enroll-status');
    
    if (startBtn) startBtn.style.display = 'block';
    if (captureBtn) {
        captureBtn.style.display = 'none';
        captureBtn.disabled = false;
    }
    if (statusEl) statusEl.textContent = 'Ready to enroll';
}

// Profile Face Setup Functions
let profileFaceStream = null;
let profileFaceScanActive = false;

// Initialize face setup section in profile
async function initializeProfileFaceSetup() {
    const section = document.getElementById('face-setup-section');
    const statusEl = document.getElementById('face-setup-status');
    const contentEl = document.getElementById('face-setup-content');
    
    if (!section || !currentUser) return;
    
    try {
        // Check current enrollment status
        const res = await fetch(apiUrl('/api/profile/biometric-status'), {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
            if (contentEl) contentEl.innerHTML = '<p style="color:#c00;">Unable to load face setup options.</p>';
            return;
        }
        
        const data = await res.json();
        
        if (statusEl) {
            if (data.enrolled) {
                statusEl.innerHTML = `<strong>Status:</strong> ✓ Face biometric enrolled`;
                statusEl.style.color = '#28a745';
            } else {
                statusEl.innerHTML = `<strong>Status:</strong> ⚠️ Not enrolled`;
                statusEl.style.color = '#f39c12';
            }
        }
        
        // Display enrollment or verification UI based on status
        if (contentEl) {
            if (data.enrolled) {
                // Show verification and re-enrollment option
                contentEl.innerHTML = `
                    <div style="padding:12px;background:#fff;border-radius:4px;border:1px solid #ddd;">
                        <h4 style="margin-top:0;">Verify Your Face</h4>
                        <p style="font-size:0.9em;color:#666;margin:0 0 12px 0;">Test if your face matches the enrolled biometric.</p>
                        <div id="profile-face-verify-camera" style="background:#f5f5f5;padding:12px;border-radius:4px;margin-bottom:12px;text-align:center;">
                            <video id="profile-verify-video" style="width:100%;max-width:350px;border-radius:8px;border:2px solid #ddd;margin-bottom:8px;display:none;"></video>
                            <canvas id="profile-verify-canvas" style="display:none;"></canvas>
                            <div id="profile-verify-status" style="font-size:0.9em;color:#666;margin:8px 0;min-height:20px;">Ready to verify</div>
                        </div>
                        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
                            <button type="button" id="profile-start-verify" onclick="startProfileFaceVerification()" style="padding:10px 20px;background:#007bff;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Start Verification</button>
                            <button type="button" id="profile-verify-face" onclick="verifyProfileFace()" style="padding:10px 20px;background:#28a745;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;display:none;">Verify Face</button>
                            <button type="button" onclick="stopProfileFaceVerification()" style="padding:10px 20px;background:#6c757d;color:white;border:none;border-radius:4px;cursor:pointer;">Cancel</button>
                        </div>
                        <div id="profile-verify-message" style="margin-top:12px;font-size:0.9em;text-align:center;"></div>
                        
                        <hr style="margin:20px 0;border:none;border-top:1px solid #ddd;">
                        <h4 style="margin-top:0;">Re-enroll Your Face</h4>
                        <p style="font-size:0.9em;color:#666;margin:0 0 12px 0;">Update your face biometric.</p>
                        <div id="profile-face-camera" style="background:#f5f5f5;padding:12px;border-radius:4px;margin-bottom:12px;text-align:center;">
                            <video id="profile-face-video" style="width:100%;max-width:350px;border-radius:8px;border:2px solid #ddd;margin-bottom:8px;display:none;"></video>
                            <canvas id="profile-face-canvas" style="display:none;"></canvas>
                            <div id="profile-face-status" style="font-size:0.9em;color:#666;margin:8px 0;min-height:20px;">Ready to enroll</div>
                        </div>
                        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
                            <button type="button" id="profile-start-enroll" onclick="startProfileFaceEnrollment()" style="padding:10px 20px;background:#f39c12;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Re-enroll Face</button>
                            <button type="button" id="profile-capture-face" onclick="captureProfileFace()" style="padding:10px 20px;background:#007bff;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;display:none;">Capture & Update</button>
                            <button type="button" onclick="stopProfileFaceEnrollment()" style="padding:10px 20px;background:#6c757d;color:white;border:none;border-radius:4px;cursor:pointer;">Cancel</button>
                        </div>
                    </div>
                `;
            } else {
                // Show enrollment only
                contentEl.innerHTML = `
                    <div style="padding:12px;background:#fff;border-radius:4px;border:1px solid #ddd;">
                        <div id="profile-face-camera" style="background:#f5f5f5;padding:12px;border-radius:4px;margin-bottom:12px;text-align:center;">
                            <video id="profile-face-video" style="width:100%;max-width:350px;border-radius:8px;border:2px solid #ddd;margin-bottom:8px;display:none;"></video>
                            <canvas id="profile-face-canvas" style="display:none;"></canvas>
                            <div id="profile-face-status" style="font-size:0.9em;color:#666;margin:8px 0;min-height:20px;">Ready to enroll</div>
                        </div>
                        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
                            <button type="button" id="profile-start-enroll" onclick="startProfileFaceEnrollment()" style="padding:10px 20px;background:#28a745;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Enroll Face</button>
                            <button type="button" id="profile-capture-face" onclick="captureProfileFace()" style="padding:10px 20px;background:#007bff;color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;display:none;">Capture & Save</button>
                            <button type="button" onclick="stopProfileFaceEnrollment()" style="padding:10px 20px;background:#6c757d;color:white;border:none;border-radius:4px;cursor:pointer;">Cancel</button>
                        </div>
                    </div>
                `;
            }
        }
    } catch (err) {
        console.error('Error initializing face setup:', err);
        if (contentEl) contentEl.innerHTML = '<p style="color:#c00;">Error loading face setup options.</p>';
    }
}

// ===== VERIFICATION FUNCTIONS =====
let profileVerifyStream = null;
let profileVerifyScanActive = false;

// Start face verification in profile
async function startProfileFaceVerification() {
    const video = document.getElementById('profile-verify-video');
    const statusEl = document.getElementById('profile-verify-status');
    const startBtn = document.getElementById('profile-start-verify');
    const verifyBtn = document.getElementById('profile-verify-face');
    
    if (!video) return;
    
    try {
        if (statusEl) {
            statusEl.textContent = 'Loading face detection models...';
            statusEl.style.color = '#333';
        }
        
        await loadFaceDetectionModels();
        
        if (statusEl) statusEl.textContent = 'Requesting camera access...';
        
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 350, height: 300, facingMode: 'user' }
        });
        
        video.style.display = 'block';
        video.srcObject = stream;
        profileVerifyStream = stream;
        profileVerifyScanActive = true;
        
        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                if (statusEl) statusEl.textContent = 'Position your face in the center...';
                if (startBtn) startBtn.style.display = 'none';
                if (verifyBtn) verifyBtn.style.display = 'block';
                
                detectProfileVerifyFaceContinuously(video);
                resolve();
            };
        });
    } catch (err) {
        console.error('Camera access error:', err);
        if (statusEl) {
            if (err.name === 'NotAllowedError') {
                statusEl.textContent = 'Camera access denied. Please allow camera access.';
            } else if (err.name === 'NotFoundError') {
                statusEl.textContent = 'No camera found on this device.';
            } else {
                statusEl.textContent = 'Camera error: ' + err.message;
            }
            statusEl.style.color = '#c00';
        }
        if (startBtn) startBtn.style.display = 'block';
        if (verifyBtn) verifyBtn.style.display = 'none';
    }
}

// Continuous face detection for verification
async function detectProfileVerifyFaceContinuously(video) {
    const statusEl = document.getElementById('profile-verify-status');
    
    if (!faceDetectionModelsLoaded || !profileVerifyScanActive) return;
    
    try {
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
        
        if (detections.length === 0) {
            if (statusEl) statusEl.textContent = '⚠️ No face detected - Position your face in view';
        } else if (detections.length === 1) {
            const detection = detections[0];
            currentFaceDescriptor = detection.descriptor;
            
            const { detection: box } = detection;
            const videoWidth = video.videoWidth;
            const faceWidth = box.width;
            const centerX = box.x + faceWidth / 2;
            const centerY = box.y + box.height / 2;
            const expectedCenterX = videoWidth / 2;
            const expectedCenterY = videoHeight / 2;
            const centerDistance = Math.sqrt(Math.pow(centerX - expectedCenterX, 2) + Math.pow(centerY - expectedCenterY, 2));
            
            if (centerDistance < 50 && faceWidth > videoWidth * 0.4) {
                if (statusEl) statusEl.textContent = '✓ Face detected and well-positioned - Ready to verify!';
            } else {
                if (statusEl) statusEl.textContent = '📹 Face detected but adjust position to center';
            }
        } else {
            if (statusEl) statusEl.textContent = '⚠️ Multiple faces detected - Please ensure only one face is visible';
        }
    } catch (err) {
        console.error('Face detection error:', err);
    }
    
    if (profileVerifyScanActive) {
        requestAnimationFrame(() => detectProfileVerifyFaceContinuously(video));
    }
}

// Verify face against stored biometric
async function verifyProfileFace() {
    if (!currentFaceDescriptor) {
        const msgEl = document.getElementById('profile-verify-message');
        if (msgEl) {
            msgEl.textContent = 'No face detected. Please ensure your face is visible.';
            msgEl.style.color = '#c00';
        }
        return;
    }
    
    const msgEl = document.getElementById('profile-verify-message');
    const verifyBtn = document.getElementById('profile-verify-face');
    
    if (msgEl) {
        msgEl.textContent = 'Verifying your face...';
        msgEl.style.color = '#333';
    }
    if (verifyBtn) verifyBtn.disabled = true;
    
    try {
        const descriptorArray = Array.from(currentFaceDescriptor);
        
        const res = await fetch(apiUrl('/api/profile/verify-face'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                faceDescriptor: descriptorArray
            })
        });
        
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            if (msgEl) {
                msgEl.textContent = body.message || 'Face verification failed. Please try again.';
                msgEl.style.color = '#c00';
            }
            if (verifyBtn) verifyBtn.disabled = false;
            return;
        }
        
        const data = await res.json();
        if (msgEl) {
            msgEl.innerHTML = `✓ <strong>Face match!</strong> Similarity: ${(data.similarity * 100).toFixed(1)}%`;
            msgEl.style.color = '#28a745';
        }
        
        stopProfileFaceVerification();
        
        // Reset after 2 seconds
        setTimeout(() => {
            stopProfileFaceVerification();
            if (verifyBtn) verifyBtn.disabled = false;
        }, 2000);
    } catch (err) {
        console.error('Face verification error:', err);
        if (msgEl) {
            msgEl.textContent = 'Network error during verification.';
            msgEl.style.color = '#c00';
        }
        if (verifyBtn) verifyBtn.disabled = false;
    }
}

// Stop face verification
function stopProfileFaceVerification() {
    profileVerifyScanActive = false;
    
    if (profileVerifyStream) {
        profileVerifyStream.getTracks().forEach(track => track.stop());
        profileVerifyStream = null;
    }
    
    const video = document.getElementById('profile-verify-video');
    if (video) {
        video.style.display = 'none';
        video.srcObject = null;
    }
    
    const startBtn = document.getElementById('profile-start-verify');
    const verifyBtn = document.getElementById('profile-verify-face');
    const statusEl = document.getElementById('profile-verify-status');
    
    if (startBtn) startBtn.style.display = 'block';
    if (verifyBtn) {
        verifyBtn.style.display = 'none';
        verifyBtn.disabled = false;
    }
    if (statusEl) statusEl.textContent = 'Ready to verify';
}

// ===== ENROLLMENT FUNCTIONS =====
async function startProfileFaceEnrollment() {
    const video = document.getElementById('profile-face-video');
    const statusEl = document.getElementById('profile-face-status');
    const startBtn = document.getElementById('profile-start-enroll');
    const captureBtn = document.getElementById('profile-capture-face');
    
    if (!video) return;
    
    try {
        if (statusEl) statusEl.textContent = 'Loading face detection models...';
        statusEl.style.color = '#333';
        
        await loadFaceDetectionModels();
        
        if (statusEl) statusEl.textContent = 'Requesting camera access...';
        
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 350, height: 300, facingMode: 'user' }
        });
        
        video.style.display = 'block';
        video.srcObject = stream;
        profileFaceStream = stream;
        profileFaceScanActive = true;
        
        return new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                if (statusEl) statusEl.textContent = 'Position your face in the center of the camera...';
                if (startBtn) startBtn.style.display = 'none';
                if (captureBtn) captureBtn.style.display = 'block';
                
                detectProfileFaceContinuously(video);
                resolve();
            };
        });
    } catch (err) {
        console.error('Camera access error:', err);
        if (statusEl) {
            if (err.name === 'NotAllowedError') {
                statusEl.textContent = 'Camera access denied. Please allow camera access in your browser settings.';
            } else if (err.name === 'NotFoundError') {
                statusEl.textContent = 'No camera found on this device.';
            } else {
                statusEl.textContent = 'Camera error: ' + err.message;
            }
            statusEl.style.color = '#c00';
        }
        if (startBtn) startBtn.style.display = 'block';
        if (captureBtn) captureBtn.style.display = 'none';
    }
}

// Continuous face detection for profile
async function detectProfileFaceContinuously(video) {
    const statusEl = document.getElementById('profile-face-status');
    
    if (!faceDetectionModelsLoaded || !profileFaceScanActive) return;
    
    try {
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
        
        if (detections.length === 0) {
            if (statusEl) statusEl.textContent = '⚠️ No face detected - Position your face in view';
        } else if (detections.length === 1) {
            const detection = detections[0];
            currentFaceDescriptor = detection.descriptor;
            
            const { detection: box } = detection;
            const videoWidth = video.videoWidth;
            const faceWidth = box.width;
            const centerX = box.x + faceWidth / 2;
            const centerY = box.y + box.height / 2;
            const centerDistance = Math.sqrt(Math.pow(centerX - video.videoWidth / 2, 2) + Math.pow(centerY - video.videoHeight / 2, 2));
            
            if (centerDistance < 50 && faceWidth > videoWidth * 0.4) {
                if (statusEl) statusEl.textContent = '✓ Face detected and well-positioned - Ready to capture!';
            } else {
                if (statusEl) statusEl.textContent = '📹 Face detected but adjust position to center';
            }
        } else {
            if (statusEl) statusEl.textContent = '⚠️ Multiple faces detected - Please ensure only one face is visible';
        }
    } catch (err) {
        console.error('Face detection error:', err);
    }
    
    if (profileFaceScanActive) {
        requestAnimationFrame(() => detectProfileFaceContinuously(video));
    }
}

// Capture face in profile
async function captureProfileFace() {
    if (!currentFaceDescriptor) {
        const statusEl = document.getElementById('profile-face-status');
        if (statusEl) {
            statusEl.textContent = 'No face detected. Please ensure your face is visible.';
            statusEl.style.color = '#c00';
        }
        return;
    }
    
    const statusEl = document.getElementById('profile-face-status');
    const captureBtn = document.getElementById('profile-capture-face');
    
    if (statusEl) {
        statusEl.textContent = 'Saving your face...';
        statusEl.style.color = '#333';
    }
    if (captureBtn) captureBtn.disabled = true;
    
    try {
        const descriptorArray = Array.from(currentFaceDescriptor);
        
        const res = await fetch(apiUrl('/api/profile/enroll-face'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                faceDescriptor: descriptorArray
            })
        });
        
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            if (statusEl) {
                statusEl.textContent = body.message || 'Failed to save face. Please try again.';
                statusEl.style.color = '#c00';
            }
            if (captureBtn) captureBtn.disabled = false;
            return;
        }
        
        if (statusEl) {
            statusEl.textContent = '✓ Face saved successfully!';
            statusEl.style.color = '#28a745';
        }
        
        stopProfileFaceEnrollment();
        
        // Refresh the setup section
        setTimeout(() => {
            initializeProfileFaceSetup();
            if (captureBtn) captureBtn.disabled = false;
        }, 2000);
    } catch (err) {
        console.error('Face enrollment error:', err);
        if (statusEl) {
            statusEl.textContent = 'Network error. Please try again.';
            statusEl.style.color = '#c00';
        }
        if (captureBtn) captureBtn.disabled = false;
    }
}

// Stop face enrollment in profile
function stopProfileFaceEnrollment() {
    profileFaceScanActive = false;
    
    if (profileFaceStream) {
        profileFaceStream.getTracks().forEach(track => track.stop());
        profileFaceStream = null;
    }
    
    const video = document.getElementById('profile-face-video');
    if (video) {
        video.style.display = 'none';
        video.srcObject = null;
    }
    
    const startBtn = document.getElementById('profile-start-enroll');
    const captureBtn = document.getElementById('profile-capture-face');
    const statusEl = document.getElementById('profile-face-status');
    
    if (startBtn) startBtn.style.display = 'block';
    if (captureBtn) {
        captureBtn.style.display = 'none';
        captureBtn.disabled = false;
    }
    if (statusEl) statusEl.textContent = 'Ready to enroll';
}

// Check if current user is admin on page load

async function checkAdminAccess() {
    if (!currentUser) {
        document.getElementById('admin-auth-check').textContent = 'Please login first';
        setTimeout(() => window.location.href = 'login.html', 2000);
        return;
    }
    
    if (!currentUser.isAdmin) {
        document.getElementById('admin-auth-check').textContent = 'Access denied - not an admin account';
        setTimeout(() => window.location.href = 'index.html', 2000);
        return;
    }
    
    // Check if admin session is still valid
    if (checkAdminSession()) {
        document.getElementById('admin-auth-portal').style.display = 'none';
        startTimer();
        loadAdminUsers();
        loadProducts();
        return;
    }
    
    document.getElementById('admin-auth-check').style.display = 'none';
    document.getElementById('admin-auth-form-step1').style.display = 'block';
    // Pre-fill email for logged-in admin
    if (currentUser && currentUser.email) {
        document.getElementById('admin-auth-email').value = currentUser.email;
    }
}
