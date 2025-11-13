const express = require('express');
const mongoose = require('mongoose');
const { engine } = require('express-handlebars');
const flightRoutes = require('./src/routes/flightRoutes');
const Flight = require('./src/models/flightModel');

const app = express();
const PORT = process.env.PORT || 3000;

// --- 1. MONGODB CONNECTION ---
// !! IMPORTANT !!
// Replace this with your actual MongoDB connection string
const MONGO_URI = "mongodb://localhost:27017/flightDB";

mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB Connected..."))
  .catch(err => console.error("MongoDB Connection Error:", err));

// --- 2. MIDDLEWARE ---
// Parses form data from POST requests
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// --- 3. HANDLEBARS VIEW ENGINE ---
// Set up Handlebars
app.engine('hbs', engine({
  extname: '.hbs',
  defaultLayout: 'main',
  layoutsDir: './src/views/layouts',
  // Add 'eq' helper used in admin_flights.hbs
  helpers: {
    eq: function(v1, v2) { return v1 === v2; }
  }
}));

app.set('view engine', 'hbs');
app.set('views', './src/views');

// --- 4. ROUTES ---
// Mount the flight routes for the admin panel
app.use('/admin/flights', flightRoutes);

// Main Application Routes (User-facing pages)
app.get('/', async (req, res) => {
  try {
    // Fetch all flights to display on the landing page
    const flights = await Flight.find().lean();
    
    res.render('landingpage', { 
      pageTitle: "Flight Search",
      flights: flights // Pass flights to the template
    });
  } catch (err) {
    res.status(500).send("Error fetching flights for landing page: " + err.message);
  }
});

// Added routes for other pages
app.get('/reservation-form', (req, res) => {
    res.render('reservation_form', { pageTitle: "Book Flight" });
});

app.get('/my-reservations', (req, res) => {
    res.render('my_reservations', { pageTitle: "My Reservations" });
});

app.get('/profile', (req, res) => {
    res.render('profile', { pageTitle: "User Profile" });
});

app.get('/admin/users', (req, res) => {
    res.render('admin_users', { pageTitle: "User Management" });
});

// --- 5. START THE SERVER ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});