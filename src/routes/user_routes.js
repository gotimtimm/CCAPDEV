const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { isAuthenticated } = require('../middleware/auth');

// GET profile page
router.get('/profile', isAuthenticated, async (req, res) => {
  try {
    const user = await User.findById(req.session.user.id);
    res.render('profile', { 
      user: user,
      layout: 'main'
    });
  } catch (err) {
    console.error("Error fetching profile:", err);
    res.status(500).send('Server Error');
  }
});

// UPDATE profile
router.post('/update', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    const { fullName, email, passportNumber } = req.body;
    
    await User.findByIdAndUpdate(userId, {
      fullName,
      email,
      passportNumber
    });
    
    // Update session data
    req.session.user.fullName = fullName;
    req.session.user.email = email;
    
    res.redirect('/user/profile');
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
