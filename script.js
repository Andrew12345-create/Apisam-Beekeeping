// Load navbar
function loadNavbar() {
    const navbarContainer = document.getElementById('navbar-container');
    if (!navbarContainer) {
        console.error('Navbar container not found');
        return;
    }

    fetch('navbar.html')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then(data => {
            navbarContainer.innerHTML = data;
            updateNavigation();
        })
        .catch(error => {
            console.error('Error loading navbar:', error);
            // Fallback: create navbar directly if fetch fails
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
                </nav>
            `;
            updateNavigation();
        });
}

// Cart functionality
let cart = JSON.parse(localStorage.getItem('cart')) || [];

function updateCartDisplay() {
    const cartItems = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');

    if (!cartItems || !cartTotal) return;

    cartItems.innerHTML = '';
    let total = 0;

    cart.forEach((item, index) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'cart-item';
        itemElement.innerHTML = `
            <span>${item.name} - $${item.price}</span>
            <button onclick="removeFromCart(${index})">Remove</button>
        `;
        cartItems.appendChild(itemElement);
        total += parseFloat(item.price);
    });

    cartTotal.textContent = total.toFixed(2);
    localStorage.setItem('cart', JSON.stringify(cart));
}

function addToCart(productId, productName, productPrice) {
    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        alert('Item already in cart!');
        return;
    }

    cart.push({ id: productId, name: productName, price: productPrice });
    updateCartDisplay();
    alert('Item added to cart!');
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartDisplay();
}

// User authentication simulation
let users = JSON.parse(localStorage.getItem('users')) || [];
let token = localStorage.getItem('token') || null;
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;

// API base URL: when static site is served from a different port (e.g., 5500),
// route API requests to backend at port 3001. If same origin/port, use relative paths.
const API_PORT = 3001;
const API_BASE = (location.port && String(location.port) !== String(API_PORT))
    ? `${location.protocol}//${location.hostname}:${API_PORT}`
    : '';

function apiUrl(path) {
    return API_BASE + path;
}

function updateNavigation() {
    const navUl = document.querySelector('nav ul');
    if (!navUl) return;

    const loginLi = navUl.querySelector('li a[href="login.html"]');
    const signupLi = navUl.querySelector('li a[href="signup.html"]');

    if (currentUser) {
        // Replace Login and Sign Up with Profile
        if (loginLi) loginLi.parentElement.innerHTML = '<a href="profile.html">Profile</a>';
        if (signupLi) signupLi.parentElement.remove();
    } else {
        // Ensure Login and Sign Up are present
        if (!loginLi) {
            const li = document.createElement('li');
            li.innerHTML = '<a href="login.html">Login</a>';
            navUl.appendChild(li);
        }
        if (!signupLi) {
            const li = document.createElement('li');
            li.innerHTML = '<a href="signup.html">Sign Up</a>';
            navUl.appendChild(li);
        }
    }
}

function updateUserInterface() {
    updateNavigation();

    const profileContent = document.getElementById('profile-content');
    const adminContent = document.getElementById('admin-content');

    if (profileContent) {
        if (currentUser) {
            profileContent.innerHTML = `
                <h2>Welcome, ${currentUser.name}!</h2>
                <p>Email: ${currentUser.email}</p>
                <h3>Account Settings</h3>
                <form id="profile-form">
                    <div class="form-group">
                        <label for="profile-name">Full Name:</label>
                        <input type="text" id="profile-name" value="${currentUser.name}" required>
                    </div>
                    <div class="form-group">
                        <label for="profile-email">Email:</label>
                        <input type="email" id="profile-email" value="${currentUser.email}" required>
                    </div>
                    <button type="submit">Update Profile</button>
                </form>
                <button onclick="logout()" style="margin-top: 1rem;">Logout</button>
                <div id="profile-message"></div>
            `;
        } else {
            profileContent.innerHTML = '<p>Please <a href="login.html">login</a> to view your profile.</p>';
        }
    }

    if (adminContent) {
        if (currentUser && currentUser.isAdmin) {
            adminContent.innerHTML = `
                <h2>Admin Controls</h2>
                <div class="admin-controls">
                    <h3>Product Management</h3>
                    <button onclick="addProduct()">Add New Product</button>
                    <h3>Order Management</h3>
                    <div id="orders-list">No orders yet.</div>
                </div>
            `;
        } else {
            adminContent.innerHTML = '<p>Please login as admin to access the dashboard.</p>';
        }
    }
}

async function login(email, password) {
    try {
        const res = await fetch(apiUrl('/api/login'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (res.ok) {
            const data = await res.json();
            token = data.token;
            currentUser = data.user;
            localStorage.setItem('token', token);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            return true;
        }
        return false;
    } catch (err) {
        // Fallback to localStorage simulation when API not reachable
        const user = users.find(u => u.email === email && u.password === password);
        if (user) {
            currentUser = user;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            return true;
        }
        return false;
    }
}

async function signup(name, email, password) {
    try {
        const res = await fetch(apiUrl('/api/signup'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        if (res.ok || res.status === 201) {
            const data = await res.json();
            token = data.token;
            currentUser = data.user;
            localStorage.setItem('token', token);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            return true;
        }
        return false;
    } catch (err) {
        // Fallback to local simulation
        if (users.find(u => u.email === email)) return false;
        const newUser = { name, email, password, isAdmin: false };
        users.push(newUser);
        localStorage.setItem('users', JSON.stringify(users));
        currentUser = newUser;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        return true;
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    updateUserInterface();
    window.location.href = 'index.html';
}

// Form handlers
document.addEventListener('DOMContentLoaded', function() {
    // Ensure navbar loads first
    setTimeout(() => {
        loadNavbar();
        updateCartDisplay();
        updateUserInterface();
    }, 100);

    // Login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            const ok = await login(email, password);
            if (ok) {
                document.getElementById('login-message').textContent = 'Login successful!';
                document.getElementById('login-message').style.color = 'green';
                updateUserInterface();
                setTimeout(() => window.location.href = 'profile.html', 1000);
            } else {
                document.getElementById('login-message').textContent = 'Invalid credentials!';
                document.getElementById('login-message').style.color = 'red';
            }
        });
    }

    // Signup form
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const password = document.getElementById('signup-password').value;
            const confirmPassword = document.getElementById('signup-confirm-password').value;

            if (password !== confirmPassword) {
                document.getElementById('signup-message').textContent = 'Passwords do not match!';
                document.getElementById('signup-message').style.color = 'red';
                return;
            }

            const ok = await signup(name, email, password);
            if (ok) {
                document.getElementById('signup-message').textContent = 'Account created successfully!';
                document.getElementById('signup-message').style.color = 'green';
                updateUserInterface();
                setTimeout(() => window.location.href = 'login.html', 1000);
            } else {
                document.getElementById('signup-message').textContent = 'Email already exists!';
                document.getElementById('signup-message').style.color = 'red';
            }
        });
    }

    // Profile form
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
        profileForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const name = document.getElementById('profile-name').value;
            const email = document.getElementById('profile-email').value;

            // Try updating via API
            try {
                const res = await fetch(apiUrl('/api/profile'), {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ''
                    },
                    body: JSON.stringify({ name, email })
                });

                if (res.ok) {
                    currentUser.name = name;
                    currentUser.email = email;
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    document.getElementById('profile-message').textContent = 'Profile updated successfully!';
                    document.getElementById('profile-message').style.color = 'green';
                    updateUserInterface();
                    return;
                }
            } catch (err) {
                console.warn('Profile update failed, falling back to local update');
            }

            // Fallback: local update
            currentUser.name = name;
            currentUser.email = email;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            const userIndex = users.findIndex(u => u.email === currentUser.email);
            if (userIndex !== -1) {
                users[userIndex] = currentUser;
                localStorage.setItem('users', JSON.stringify(users));
            }
            document.getElementById('profile-message').textContent = 'Profile updated successfully!';
            document.getElementById('profile-message').style.color = 'green';
        });
    }

    // Contact form
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            document.getElementById('contact-message').textContent = 'Message sent successfully!';
            document.getElementById('contact-message').style.color = 'green';
            contactForm.reset();
        });
    }

    // Add to cart buttons
    document.querySelectorAll('.add-to-cart').forEach(button => {
        button.addEventListener('click', function() {
            const product = this.closest('.product');
            const id = product.dataset.id;
            const name = product.dataset.name;
            const price = product.dataset.price;
            addToCart(id, name, price);
        });
    });

    // Checkout button
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', function() {
            if (cart.length === 0) {
                alert('Your cart is empty!');
                return;
            }
            if (!currentUser) {
                alert('Please login to checkout!');
                window.location.href = 'login.html';
                return;
            }
            alert('Checkout successful! Thank you for your purchase.');
            cart = [];
            updateCartDisplay();
        });
    }
});

// Admin functions
function addProduct() {
    const name = prompt('Product name:');
    const price = prompt('Product price:');
    if (name && price) {
        alert('Product added (simulated)');
    }
}
