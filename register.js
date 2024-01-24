document.addEventListener('DOMContentLoaded', function () {
    const registrationForm = document.getElementById('registrationForm');

    registrationForm.addEventListener('submit', function (event) {
        event.preventDefault();

        const username = document.getElementById('username').value;
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Check if passwords match
        if (password !== confirmPassword) {
            alert("Passwords do not match.");
            return;
        }

        // Create a user object
        const user = {
            username: username,
            name: name,
            email: email,
            password: password,
        };

        // Store user object in sessionStorage
        storeUser(user);

        // Redirect to a confirmation page or your home page
        window.location.href = 'index.html';
    });

    function storeUser(user) {
        // Retrieve existing users from sessionStorage
        const existingUsers = JSON.parse(sessionStorage.getItem('users')) || [];

        // Add the new user to the array
        existingUsers.push(user);

        // Store the updated array back in sessionStorage
        sessionStorage.setItem('users', JSON.stringify(existingUsers));
    }
});
