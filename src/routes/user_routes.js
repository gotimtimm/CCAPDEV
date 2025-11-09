const express = require('express');
const router = express.Router();
const User = require('../models/user');

router.post('/update', async (req, res) => {
  try {
    const userId = "654cbb1f9d4f1b2b8c9a6a8d"; 
    
    const { fullName, email, passportNumber } = req.body;
    
    await User.findByIdAndUpdate(userId, {
      fullName,
      email,
      passportNumber
    });
    
    res.redirect('/profile');
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;