# TODO: Implement User-Specific Cart and Ban Login Prevention

## Tasks
- [x] Modify cart storage to be user-specific using 'cart_' + userEmail keys
- [x] Add helper functions for getting current cart key and loading/saving cart
- [x] Update updateCartDisplay to use user-specific storage
- [x] Update addToCart, changeQuantity, removeFromCart to work with user-specific cart
- [x] Add cart loading on login and saving on logout
- [x] Prevent banned users from attempting login by checking localStorage 'banned' flag
- [x] Test login blocking for banned users (requires manual testing)
- [x] Test cart isolation between different accounts (requires manual testing)
