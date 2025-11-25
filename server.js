require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const { engine } = require('express-handlebars');
const morgan = require('morgan');
const bcrypt = require('bcrypt');
const session = require('express-session');

const flightRoutes = require('./src/routes/flightroutes');
const Flight = require('./src/models/flightModel');
const Reservation = require('./src/models/reservationModel');
const User = require('./src/models/userModel');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURATION ---
const SESSION_SECRET = process.env.SESSION_SECRET;
const MONGO_URI = "mongodb://localhost:27017/flightDB";

// Helper function for safe number parsing
const safeParseInt = (value, defaultValue = 0) => {
    const parsed = parseInt(value);
    return isNaN(parsed) ? defaultValue : parsed;
};

// --- 1. MONGODB CONNECTION ---
mongoose.connect(MONGO_URI)
  .then(async () => {
      console.log("MongoDB Connected...");
      await ensureDemoAdminExists();
  })
  .catch(err => console.error("MongoDB Connection Error:", err));

async function ensureDemoAdminExists() {
    const adminEmail = "admin@lasalle.ph";
    const adminPassword = "admin";

    let user = await User.findOne({ email: adminEmail });
    
    if (!user) {
        console.log("Creating demo admin account...");
        // CREATE NEW ADMIN
        user = new User({
            fullName: "Admin Account",
            email: adminEmail,
            passportNumber: "ADM000000",
            password: adminPassword,
            role: "admin"
        });
    } else {
        console.log("Resetting demo admin password...");
        user.password = adminPassword; 
    }
    
    await user.save();
    console.log("Demo admin ready (admin@lasalle.ph / admin).");
}

// --- 2. MIDDLEWARE ---
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Session Setup
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        httpOnly: true 
    }
}));

// Global Variables for Handlebars (derived from Session)
app.use(async (req, res, next) => {
    res.locals.isLoggedIn = !!req.session.userId;
    res.locals.isAdmin = req.session.userRole === 'admin';

    if (req.session.userId) {
        try {
            res.locals.currentUser = await User.findById(req.session.userId).lean();
        } catch (err) {
            console.error("Error loading session user:", err);
            res.locals.currentUser = null;
        }
    } else {
        res.locals.currentUser = null;
    }
    next();
});

// Prevents guests from accessing protected routes
const ensureAuthenticated = (req, res, next) => {
    if (!req.session.userId) {
        return res.redirect('/login');
    }
    next();
};

// Prevents non-admins from accessing admin routes
const ensureAdmin = (req, res, next) => {
    if (req.session.userRole !== 'admin') {
        return res.status(403).send("Access Denied: Admins Only.");
    }
    next();
};

// --- 3. HANDLEBARS SETUP ---
app.engine('hbs', engine({
  extname: '.hbs',
  defaultLayout: 'main',
  layoutsDir: './src/views/layouts',
  helpers: {
    eq: function(v1, v2) { return v1 === v2; },
    isBooked: function(status) { return status === 'Booked'; }
  }
}));

app.set('view engine', 'hbs');
app.set('views', './src/views');

// --- 4. AUTH ROUTES ---

// Register Page
app.get('/register', (req, res) => {
    res.render('register', { pageTitle: "Register" });
});

// Register Logic
app.post('/register', async (req, res) => {
    try {
        const { fullName, email, passportNumber, password } = req.body;
        
        const newUser = new User({ 
            fullName, 
            email, 
            passportNumber, 
            password: password,
            role: 'user' 
        });
        await newUser.save();

        req.session.userId = newUser._id;
        req.session.userRole = newUser.role;
        
        res.redirect('/profile'); 
    } catch (err) {
        console.error("Registration Error:", err);
        let errorMessage = "Registration failed.";
        if (err.code === 11000) errorMessage = "Email or Passport already exists.";
        res.render('register', { errorMessage });
    }
});

// Login Page
app.get('/login', (req, res) => {
    res.render('login', { pageTitle: "Login" });
});

// Login Logic
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email });

        if (!user) {
            return res.render('login', { errorMessage: "Invalid email or password" });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.render('login', { errorMessage: "Invalid email or password" });
        }

        req.session.userId = user._id;
        req.session.userRole = user.role;

        if (user.role === 'admin') {
            res.redirect('/admin/flights');
        } else {
            res.redirect('/profile');
        }
    } catch (err) {
        console.error("Login Error:", err);
        res.status(500).send("Login error: " + err.message);
    }
});

// Logout Logic
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error("Logout error:", err);
        res.redirect('/');
    });
});


// --- 5. CORE ROUTES ---

// Admin Routes (Protected by ensureAdmin)
app.use('/admin/flights', ensureAdmin, flightRoutes); 

app.get('/admin/users', ensureAdmin, async (req, res) => { 
    try {
        const users = await User.find().lean();
        res.render('admin_users', { pageTitle: "User Management", users });
    } catch (err) {
        res.status(500).send("Error: " + err.message);
    }
});

// Landing Page (Public)
app.get('/', async (req, res) => {
  try {
    const { origin, destination, departure_date, arrival_date, pax } = req.query;
    
    const filter = {};
    if (origin) filter.origin = origin.toUpperCase();
    if (destination) filter.destination = destination.toUpperCase();
    if (departure_date) filter.departureDate = departure_date;
    if (arrival_date) filter.arrivalDate = arrival_date;

    const flights = await Flight.find(filter).lean();
    const locations = ['MANILA', 'CEBU', 'DAVAO'];

    res.render('landingpage', { 
      pageTitle: "Flight Search",
      flights,
      locations,
      query: req.query
    });
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

// Reservation Form (Protected)
app.get('/reservation-form', ensureAuthenticated, async (req, res) => { 
    try {
        const flightId = req.query.flightId;
        const departureDate = req.query.date;

        if (!flightId || !departureDate) return res.redirect('/');
        
        const selectedFlight = await Flight.findById(flightId).lean();
        if (!selectedFlight) return res.status(404).send("Flight not found.");

        res.render('reservation_form', { 
            pageTitle: "Book Flight", 
            flight: selectedFlight,
            reservedDate: departureDate
        });
    } catch (err) {
         res.status(500).send("Error: " + err.message);
    }
});

// CREATE RESERVATION (Protected & Linked to User)
app.post('/reservation-form/create', ensureAuthenticated, async (req, res) => { 
    try {
        const { flightId, selectedSeat, mealOption, extraBaggage, totalPrice, reservedDate } = req.body;
        
        const user = await User.findById(req.session.userId).lean();
        if (!user) return res.redirect('/login');

        const newReservation = new Reservation({
            user: req.session.userId,
            fullName: user.fullName, 
            email: user.email,
            passportNumber: user.passportNumber,
            
            flight: flightId, 
            selectedSeat,
            mealOption: safeParseInt(mealOption),
            extraBaggage: safeParseInt(extraBaggage, 2),
            totalPrice: safeParseInt(totalPrice),
            reservedDate
        });

        await newReservation.save();
        res.redirect('/my-reservations');
    } catch (err) {
        console.error("Create Reservation Error:", err);
        res.status(500).send("Error creating reservation: " + err.message);
    }
});

// MY RESERVATIONS (Protected & Filtered by User)
app.get('/my-reservations', ensureAuthenticated, async (req, res) => { 
    try {
        // Find reservations belonging to THIS user only
        const reservations = await Reservation.find({ 
            user: req.session.userId 
        })
        .populate('flight')
        .lean();
        
        res.render('my_reservations', { 
            pageTitle: "My Reservations",
            reservations: reservations
        });
    } catch (err) {
        console.error("My Reservations Error:", err);
        res.status(500).send("Error fetching reservations.");
    }
});

// Update Reservation (Protected)
app.post('/my-reservations/update/:id', ensureAuthenticated, async (req, res) => { 
    try {
        const reservationId = req.params.id;
        const { selectedSeat, mealOption, extraBaggage, totalPrice } = req.body; 

        // Security Note: Ideally check if (reservation.user == req.session.userId)
        await Reservation.findByIdAndUpdate(reservationId, {
            selectedSeat,
            mealOption: safeParseInt(mealOption),
            extraBaggage: safeParseInt(extraBaggage, 2),
            totalPrice: safeParseInt(totalPrice),
        }, { new: true, runValidators: true });

        res.redirect('/my-reservations'); 
    } catch (err) {
        res.status(500).send("Error updating reservation: " + err.message);
    }
});

// Cancel Reservation (Protected)
app.post('/my-reservations/cancel/:id', ensureAuthenticated, async (req, res) => { 
    try {
        await Reservation.findByIdAndDelete(req.params.id);
        res.redirect('/my-reservations');
    } catch (err) {
        res.status(500).send("Error deleting reservation: " + err.message);
    }
});

// User Profile (Protected)
app.get('/profile', ensureAuthenticated, async (req, res) => { 
    try {
        const user = await User.findById(req.session.userId).lean();
        res.render('profile', { pageTitle: "User Profile", user });
    } catch (err) {
        res.status(500).send("Error fetching profile: " + err.message);
    }
});

// Update Profile (Protected)
app.post('/profile/update', ensureAuthenticated, async (req, res) => { 
    try {
        const { fullName, email, passportNumber } = req.body;
        await User.findByIdAndUpdate(req.session.userId, {
            fullName, email, passportNumber
        }, { new: true, runValidators: true });
        res.redirect('/profile'); 
    } catch (err) {
        res.status(400).send("Update failed. Email/Passport may be taken.");
    }
});

// --- 6. START THE SERVER ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});