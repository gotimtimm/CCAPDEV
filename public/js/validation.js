// Client-side validation
document.addEventListener('DOMContentLoaded', function() {
  // Registration form validation
  const registerForm = document.querySelector('form[action="/register"]');
  if (registerForm) {
    registerForm.addEventListener('submit', function(e) {
      const fullName = document.getElementById('fullName').value;
      const email = document.getElementById('email').value;
      const passportNumber = document.getElementById('passportNumber').value;
      const password = document.getElementById('password').value;
      
      let isValid = true;
      let errorMessage = '';

      // Name validation
      if (!/^[A-Za-z\s]{2,}$/.test(fullName)) {
        errorMessage = 'Name must contain only letters and spaces, and be at least 2 characters long.';
        isValid = false;
      }
      // Email validation
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errorMessage = 'Please enter a valid email address.';
        isValid = false;
      }
      // Passport validation
      else if (!/^[A-Z0-9]{6,}$/.test(passportNumber)) {
        errorMessage = 'Passport must be at least 6 uppercase alphanumeric characters.';
        isValid = false;
      }
      // Password validation
      else if (password.length < 6) {
        errorMessage = 'Password must be at least 6 characters long.';
        isValid = false;
      }

      if (!isValid) {
        e.preventDefault();
        alert(errorMessage);
        return false;
      }
    });
  }

  const passportInput = document.getElementById('passportNumber');
  if (passportInput) {
    passportInput.addEventListener('input', function() {
      this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    });
  }

  const nameInput = document.getElementById('fullName');
  if (nameInput) {
    nameInput.addEventListener('input', function() {
      this.value = this.value.replace(/[^A-Za-z\s]/g, '');
    });
  }
});
