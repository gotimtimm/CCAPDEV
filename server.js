require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const { engine } = require('express-handlebars');
const morgan = require('morgan');
const bcrypt = require('bcrypt');
const session = require('express-session');

// Import of Logger
const logger = require('./src/utils/logger'); 

const flightRoutes = require('./src/routes/flightroutes');
const Flight = require('./src/models/flightModel');
const Reservation = require('./src/models/reservationModel');
const User = require('./src/models/userModel');

// Import the API routes
const apiRoutes = require('./src/routes/apiRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

const SESSION_SECRET = process.env.SESSION_SECRET || 'default_secret'; 
const MONGO_URI = "mongodb://localhost:27017/flightDB";

// Number Parsing
const safeParseInt = (value, defaultValue = 0) => {
    const parsed = parseInt(value);
    return isNaN(parsed) ? defaultValue : parsed;
};

// MonggoDB Connection
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

// Middleware
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Register the API Routes
app.use('/api', apiRoutes);

// Session Setup
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 1000 * 60 * 60 * 24, 
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
            logger.error(`Error loading session user: ${err.message}`); 
            res.locals.currentUser = null;
        }
    } else {
        res.locals.currentUser = null;
    }
    next();
});

// Route to render the Check-in Page
app.get('/checkin', (req, res) => {
    res.render('checkin', { pageTitle: "Online Check-in" });
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

// Handlebars Setup
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

// AUTH Routes
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
        
        logger.info(`New user registered: ${email}`);

        res.redirect('/profile'); 
    } catch (err) {
        logger.error(`Registration Error: ${err.message}`); 
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

        logger.info(`User logged in: ${email}`);

        if (user.role === 'admin') {
            res.redirect('/admin/flights');
        } else {
            res.redirect('/profile');
        }
    } catch (err) {
        logger.error(`Login Error: ${err.message}`); 
        res.status(500).send("Login error: " + err.message);
    }
});

// Logout Logic
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) logger.error("Logout error:", err);
        res.redirect('/');
    });
});

// Core Routes
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
        const pax = parseInt(req.query.pax) || 1;

        if (!flightId || !departureDate) return res.redirect('/');
        
        const selectedFlight = await Flight.findById(flightId).lean();
        if (!selectedFlight) return res.status(404).send("Flight not found.");

        const existingReservations = await Reservation.find({ flight: flightId }).select('selectedSeat');
        const occupiedSeats = existingReservations.map(r => r.selectedSeat);

        res.render('reservation_form', { 
            pageTitle: "Book Flight", 
            flight: selectedFlight,
            reservedDate: departureDate,
            pax: pax,
            occupiedSeats: JSON.stringify(occupiedSeats)
        });
    } catch (err) {
         res.status(500).send("Error: " + err.message);
    }
});

// CREATE RESERVATION (Protected & Linked to User)
app.post('/reservation-form/create', ensureAuthenticated, async (req, res) => { 
    try {
        const toArray = (val) => Array.isArray(val) ? val : [val];

        const { flightId, reservedDate } = req.body;
        const fullNames = toArray(req.body.fullName);
        const passports = toArray(req.body.passportNumber);
        const meals = toArray(req.body.mealOption);
        const baggages = toArray(req.body.extraBaggage);
        const seats = toArray(req.body.selectedSeat);
        
        const flight = await Flight.findById(flightId);
        
        const user = await User.findById(req.session.userId).lean();
        if (!user) return res.redirect('/login');

        for (let i = 0; i < fullNames.length; i++) {
            
            const conflict = await Reservation.findOne({ flight: flightId, selectedSeat: seats[i] });
            if (conflict) {
                return res.status(400).send(`Seat ${seats[i]} is already taken. Please try again.`);
            }

            let baggageCost = 0;
            if(parseInt(baggages[i]) == 5) baggageCost = 500;
            if(parseInt(baggages[i]) == 10) baggageCost = 1000;
            if(parseInt(baggages[i]) == 15) baggageCost = 1500;
            if(parseInt(baggages[i]) == 20) baggageCost = 2000;
            
            let total = flight.basePrice + parseInt(meals[i]) + baggageCost;

            const newReservation = new Reservation({
                user: req.session.userId,
                fullName: fullNames[i], 
                email: user.email,
                passportNumber: passports[i],
                
                flight: flightId, 
                selectedSeat: seats[i],
                mealOption: safeParseInt(meals[i]),
                extraBaggage: safeParseInt(baggages[i], 2),
                totalPrice: total,
                reservedDate
            });

            await newReservation.save();
        }

        logger.info(`Reservations created by ${user.email} for flight ${flightId}`);
        res.redirect('/my-reservations');
    } catch (err) {
        logger.error(`Create Reservation Error: ${err.message}`); 
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
        logger.error(`My Reservations Error: ${err.message}`);
        res.status(500).send("Error fetching reservations.");
    }
});

// Update Reservation 
app.post('/my-reservations/update/:id', ensureAuthenticated, async (req, res) => { 
    try {
        const reservationId = req.params.id;
        const { selectedSeat, mealOption, extraBaggage, totalPrice } = req.body; 

        await Reservation.findByIdAndUpdate(reservationId, {
            selectedSeat,
            mealOption: safeParseInt(mealOption),
            extraBaggage: safeParseInt(extraBaggage, 2),
            totalPrice: safeParseInt(totalPrice),
        }, { new: true, runValidators: true });

        res.redirect('/my-reservations'); 
    } catch (err) {
        logger.error(`Reservation Update Error: ${err.message}`);
        res.status(500).send("Error updating reservation: " + err.message);
    }
});

// Cancel Reservation (Protected)
app.post('/my-reservations/cancel/:id', ensureAuthenticated, async (req, res) => { 
    try {
        await Reservation.findByIdAndDelete(req.params.id);
        logger.info(`Reservation cancelled: ${req.params.id}`);
        res.redirect('/my-reservations');
    } catch (err) {
        logger.error(`Reservation Cancel Error: ${err.message}`);
        res.status(500).send("Error deleting reservation: " + err.message);
    }
});

// User Profile
app.get('/profile', ensureAuthenticated, async (req, res) => { 
    try {
        const user = await User.findById(req.session.userId).lean();
        res.render('profile', { pageTitle: "User Profile", user });
    } catch (err) {
        res.status(500).send("Error fetching profile: " + err.message);
    }
});

// Update Profile
app.post('/profile/update', ensureAuthenticated, async (req, res) => { 
    try {
        const { fullName, email, passportNumber } = req.body;
        await User.findByIdAndUpdate(req.session.userId, {
            fullName, email, passportNumber
        }, { new: true, runValidators: true });
        res.redirect('/profile'); 
    } catch (err) {
        logger.error(`Profile Update Error: ${err.message}`);
        res.status(400).send("Update failed. Email/Passport may be taken.");
    }
});

// --- ADMIN USER MANAGEMENT ROUTES ---

//GET: Show "Edit User" Form
app.get('/admin/users/edit/:id', ensureAdmin, async (req, res) => {
    try {
        const userToEdit = await User.findById(req.params.id).lean();
        if (!userToEdit) return res.status(404).send("User not found");
        
        res.render('admin_edit_user', { 
            pageTitle: "Edit User",
            userToEdit: userToEdit 
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

//POST: Update User Details
app.post('/admin/users/update/:id', ensureAdmin, async (req, res) => {
    try {
        const { fullName, email } = req.body;
        await User.findByIdAndUpdate(req.params.id, { fullName, email }, { runValidators: true });
        logger.info(`Admin updated user ${req.params.id}`);
        res.redirect('/admin/users');
    } catch (err) {
        res.status(500).send("Error updating user: " + err.message);
    }
});

//GET: View a specific User's Reservations
app.get('/admin/users/:id/reservations', ensureAdmin, async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.id).lean();
        if (!targetUser) return res.status(404).send("User not found");

        const reservations = await Reservation.find({ user: req.params.id })
            .populate('flight')
            .lean();

        res.render('admin_user_reservations', {
            pageTitle: `Reservations for ${targetUser.fullName}`,
            targetUser: targetUser,
            reservations: reservations
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

//POST: Admin Update Reservation (Redirects back to User's List)
app.post('/admin/reservations/update/:id', ensureAdmin, async (req, res) => {
    try {
        const reservationId = req.params.id;
        const reservation = await Reservation.findById(reservationId);
        
        if (!reservation) return res.status(404).send("Reservation not found");

        const { selectedSeat, mealOption, extraBaggage } = req.body;
        const flight = await Flight.findById(reservation.flight);
        
        let baggageCost = 0;
        const bagWeight = parseInt(extraBaggage);
        if(bagWeight == 5) baggageCost = 500;
        if(bagWeight == 10) baggageCost = 1000;
        if(bagWeight == 15) baggageCost = 1500;
        if(bagWeight == 20) baggageCost = 2000;
        
        const newTotal = flight.basePrice + parseInt(mealOption) + baggageCost;

        await Reservation.findByIdAndUpdate(reservationId, {
            selectedSeat,
            mealOption: parseInt(mealOption),
            extraBaggage: bagWeight,
            totalPrice: newTotal
        });

        logger.info(`Admin updated reservation ${reservationId}`);
        
        res.redirect(`/admin/users/${reservation.user}/reservations`);
    } catch (err) {
        res.status(500).send("Error updating reservation: " + err.message);
    }
});

app.post('/admin/reservations/cancel/:id', ensureAdmin, async (req, res) => {
    try {
        const reservationId = req.params.id;
        const reservation = await Reservation.findById(reservationId);
        if (!reservation) return res.status(404).send("Reservation not found");
        
        const userId = reservation.user;

        await Reservation.findByIdAndDelete(reservationId);
        logger.info(`Admin cancelled reservation ${reservationId}`);

        res.redirect(`/admin/users/${userId}/reservations`);
    } catch (err) {
        res.status(500).send("Error cancelling reservation: " + err.message);
    }
});

app.use((err, req, res, next) => {
    logger.error(`System Error: ${err.message} \nStack: ${err.stack}`);
    res.status(500).send("Something went wrong!");
});

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
}

module.exports = app;
