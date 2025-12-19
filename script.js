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
let API_BASE = '';
// If the page is opened via file:// or there's no port, point API requests at localhost:3000
if (location.protocol === 'file:' || !location.port) {
    API_BASE = `http://localhost:${API_PORT}`;
} else if (String(location.port) !== String(API_PORT)) {
    API_BASE = `${location.protocol}//${location.hostname}:${API_PORT}`;
} else {
    API_BASE = '';
}
console.log('apiUrl base:', API_BASE);
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
        
        const logoutLi = document.createElement('li');
        logoutLi.innerHTML = '<a href="#" onclick="logout()">Logout</a>';
        navUl.appendChild(logoutLi);
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

function logout() {
    currentUser = null;
    token = null;
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    localStorage.removeItem('adminSession');
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

// Shop products loading
async function loadShopProducts() {
    try {
        // Test server connectivity first
        console.log('Testing server connectivity...');
        const testRes = await fetch(apiUrl('/api/test'));
        if (!testRes.ok) {
            throw new Error('Server not responding');
        }
        console.log('Server is responding');
        
        // Now fetch products
        console.log('Fetching products from:', apiUrl('/api/products/full'));
        const res = await fetch(apiUrl('/api/products/full'));
        if (res.ok) {
            const data = await res.json();
            console.log('Database products received:', data.products?.length || 0, 'products');
            if (data.products && data.products.length > 0) {
                console.log('First product:', data.products[0]);
                displayShopProducts(data.products);
            } else {
                document.getElementById('shop-products').innerHTML = 'No products found in database';
            }
        } else {
            console.error('Failed to fetch products:', res.status, res.statusText);
            document.getElementById('shop-products').innerHTML = `Error loading products: ${res.status}`;
        }
    } catch (err) {
        console.error('Error loading products:', err);
        document.getElementById('shop-products').innerHTML = `Error: ${err.message}`;
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
            const originalPrice = product.original_price ? `<span style="text-decoration: line-through; color: #999;">KSH ${product.original_price.toLocaleString()}</span> ` : '';
            const imageHTML = product.image_url ? `<img src="${product.image_url}" alt="${product.name}">` : '';
            
            return `
                <div class="product" data-id="${product.id}" data-name="${product.name}" data-price="${product.price}">
                    ${imageHTML}
                    <h2>${product.name}</h2>
                    <p>${product.description}</p>
                    <p class="stock-info"><strong>Stock Info:</strong> <span class="${stockClass}">${product.stock_quantity || 0} available</span></p>
                    <p class="price">${originalPrice}<strong>KSH ${product.price.toLocaleString()}</strong></p>
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
    
    // Bind add-to-cart buttons
    document.querySelectorAll('.add-to-cart').forEach(btn => {
        btn.addEventListener('click', function() {
            const product = this.closest('.product');
            if (product) {
                addToCart(product.dataset.id, product.dataset.name, product.dataset.price);
            }
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
    loadNavbar(); updateCartDisplay(); updateNavigation();
    
    // Create cart sidebar and floating button
    createCartSidebar();
    createFloatingCartButton();
    
    // Start ban checking if user is logged in
    if (currentUser && token) startBanCheck();

    // Load products on shop page
    if (window.location.pathname.includes('shop.html')) {
        setTimeout(loadShopProducts, 500);
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
                const email = document.getElementById('login-email').value.trim();
                const password = document.getElementById('login-password').value;
                const res = await fetch(apiUrl('/api/login'), { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) });
                const msgEl = document.getElementById('login-message');
                if (res.ok) {
                    const data = await res.json();
                    token = data.token;
                    currentUser = data.user;
                    localStorage.setItem('token', token);
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    msgEl.textContent = 'Login successful!'; msgEl.style.color = 'green';
                    updateNavigation();
                    setTimeout(() => window.location.href = 'shop.html', 1000);
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
        if (msgEl) { msgEl.style.color = '#c00'; msgEl.textContent = 'Network error during verification'; }
        console.error('Admin auth error', err);
    }
}

// Step 2: Super Admin Verification
async function submitAdminAuthStep2() {
    const msgEl = document.getElementById('admin-auth-message-step2');
    if (msgEl) { msgEl.style.color = '#333'; msgEl.textContent = 'Confirming super admin access...'; }

    try {
        // Verify super admin privileges
        const res = await fetch(apiUrl('/api/admin/verify-super-admin'), {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
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
            if (msgEl) { msgEl.style.color = '#c00'; msgEl.textContent = 'Access denied - insufficient privileges'; }
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
    if (msgEl) { msgEl.style.color = '#333'; msgEl.textContent = 'Verifying password...'; }

    try {
        // Verify the password matches the original
        const res = await fetch(apiUrl('/api/admin/verify-password'), {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ password: passwordConfirm })
        });
        if (!res.ok) {
            const body = await res.json().catch(()=>({}));
            if (msgEl) { msgEl.style.color = '#c00'; msgEl.textContent = body.message || 'Password verification failed'; }
            return;
        }
        if (msgEl) { msgEl.style.color = 'green'; msgEl.textContent = 'Password verified! Super admin access granted!'; }
        // Grant access
        setTimeout(() => {
            const portal = document.getElementById('admin-auth-portal');
            const adminContent = document.getElementById('admin-content');
            if (portal) portal.style.display = 'none';
            if (adminContent) adminContent.style.display = 'block';
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
    document.getElementById('admin-auth-form').style.display = 'block';
}
