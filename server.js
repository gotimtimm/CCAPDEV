const express = require('express');
const mongoose = require('mongoose');
const { engine } = require('express-handlebars');
const flightRoutes = require('./routes/flightRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// --- 1. MONGODB CONNECTION ---
// !! IMPORTANT !!
// Replace this with your actual MongoDB connection string
const MONGO_URI = "YOUR_MONGODB_CONNECTION_STRING_GOES_HERE";

mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB Connected..."))
  .catch(err => console.error("MongoDB Connection Error:", err));

// --- 2. MIDDLEWARE ---
// Parses form data from POST requests
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- 3. HANDLEBARS VIEW ENGINE ---
// Set up Handlebars
app.engine('hbs', engine({
  extname: '.hbs',
  defaultLayout: 'main' // This is the 'main.hbs' file
}));
app.set('view engine', 'hbs');
app.set('views', './views'); // Point to the 'views' folder

// --- 4. ROUTES ---
// Mount the flight routes for the admin panel
// All routes in flightRoutes.js will be prefixed with /admin/flights
app.use('/admin/flights', flightRoutes);

// Simple home page route to make sure it's working
app.get('/', (req, res) => {
  // Redirect to the admin flights page
  res.redirect('/admin/flights');
});

// --- 5. START THE SERVER ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
