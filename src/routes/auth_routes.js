const express = require('express');
const router = express.Router();
const User = require('../models/user');

// Register page
router.get('/register', (req, res) => {
  res.render('register', { layout: false });
});

// Register processing
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
    res.redirect('/');
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;