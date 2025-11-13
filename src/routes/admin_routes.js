const express = require('express');
const router = express.Router();
const User = require('../models/user');

// Admin users page
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({});
    res.render('admin_users', { 
      users: users
    });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).send('Server Error');
  }
});

// Delete user
router.post('/users/delete/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.redirect('/admin/users');
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;