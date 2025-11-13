const express = require('express');
const router = express.Router();
const User = require('../models/user');

router.get('/register', (req, res) => {
  res.render('register', { layout: false });
});

router.get('/login', (req, res) => {
  res.render('login', { layout: false, error: null });
});

router.post('/register', async (req, res) => {
  try {
    const { fullName, email, passportNumber } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).render('register', { 
        layout: false, 
        error: 'Email already exists' 
      });
    }

    const newUser = new User({
      fullName,
      email,
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

router.post('/login', async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.render('login', { 
        layout: false, 
        error: 'User not found' 
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

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;

