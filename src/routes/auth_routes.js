const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/user');

// Register page
router.get('/register', (req, res) => {
  res.render('register', { layout: false });
});

// Login page
router.get('/login', (req, res) => {
  res.render('login', { layout: false, error: null });
});

// Register processing
router.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, passportNumber } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).render('register', { 
        layout: false, 
        error: 'Email already exists' 
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
      passportNumber
    });

    await newUser.save();
    req.session.user = {
      id: newUser._id,
      email: newUser.email,
      fullName: newUser.fullName,
      role: newUser.role
    };
    res.redirect('/');
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).send('Server Error');
  }
});

// Login processing
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.render('login', { 
        layout: false, 
        error: 'Invalid email or password' 
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.render('login', { 
        layout: false, 
        error: 'Invalid email or password' 
      });
    }

    req.session.user = {
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      role: user.role
    };

    res.redirect('/');
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).send('Server Error');
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;


module.exports = router;
