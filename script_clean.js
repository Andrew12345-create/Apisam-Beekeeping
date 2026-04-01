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
                    <button class="remove-btn" onclick="removeFromCart(${i})">Ã—</button>
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
// Superadmin bypass
const SUPERADMIN_BYPASS = 'coder1234';
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
                        <div id="profile-orders">Loading ordersâ€¦</div>
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
            msgEl.textContent = 'Unable to connect to server. Please ensure the server is running by executing "npm start" in the project directory.';
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
    button.innerHTML = 'ðŸ›’';
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
        'Hives & Equipment': 'ðŸ ',
        'Hive Components': 'ðŸ”§',
        'Protective Equipment': 'ðŸ›¡ï¸',
        'Tools & Equipment': 'ðŸ”¨',
        'Honey Processing': 'ðŸ¯',
        'Storage & Containers': 'ðŸ“¦',
        'Specialty Items': 'âœ¨'
    };
    
    const groupedProducts = products.reduce((acc, product) => {
        if (!acc[product.category]) acc[product.category] = [];
        acc[product.category].push(product);
        return acc;
    }, {});
    
    const shopHTML = Object.entries(groupedProducts).map(([category, categoryProducts]) => {
        const icon = categories[category] || 'ðŸ“¦';
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
    loadNavbar(); loadCart(); updateCartDisplay(); updateNavigation(); updateUserInterface();
    
    // Create cart sidebar and floating button
