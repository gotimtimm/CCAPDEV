const express = require('express');
const mongoose = require('mongoose');
const { engine } = require('express-handlebars');
const flightRoutes = require('./src/routes/flightRoutes');
const Flight = require('./src/models/flightModel');
const Reservation = require('./src/models/reservationModel');
const User = require('./src/models/userModel');

const app = express();
const PORT = process.env.PORT || 3000;

// Helper function for safe number parsing
const safeParseInt = (value, defaultValue = 0) => {
    const parsed = parseInt(value);
    return isNaN(parsed) ? defaultValue : parsed;
};

let currentUserId = null; 
let currentUserRole = 'guest';

// Hardcoded credentials for an Admin account (created on startup)
const DEMO_ADMIN_EMAIL = "admin@lasalle.ph"; 
const DEMO_ADMIN_PASSWORD = "admin";

// --- 1. MONGODB CONNECTION ---
// !! IMPORTANT !!
// Replace this with your actual MongoDB connection string
const MONGO_URI = "mongodb://localhost:27017/flightDB";

mongoose.connect(MONGO_URI)
  .then(async () => {
      console.log("MongoDB Connected...");
      // Ensure a demo admin exists for testing admin routes
      await ensureDemoAdminExists();
  })
  .catch(err => console.error("MongoDB Connection Error:", err));

// Function to ensure demo admin exists (using upsert)
async function ensureDemoAdminExists() {
    console.log("Ensuring demo admin exists (email: admin@lasalle.ph)...");
    const adminData = {
        fullName: "Admin Account",
        email: DEMO_ADMIN_EMAIL,
        passportNumber: "ADM000000",
        password: DEMO_ADMIN_PASSWORD, // Plain text, will be hashed in M3
        role: "admin"
    };
    
    // Find by email, create/update if not found
    await User.findOneAndUpdate(
        { email: DEMO_ADMIN_EMAIL },
        adminData,
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();
    console.log("Demo admin user ensured.");
}
// -------------------------

// --- 2. MIDDLEWARE ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Global middleware to pass user context to Handlebars and track current user
app.use(async (req, res, next) => {
    res.locals.isLoggedIn = currentUserId !== null;
    res.locals.isAdmin = currentUserRole === 'admin';
    
    if (res.locals.isLoggedIn) {
        // Fetch current user details to make them available globally
        res.locals.currentUser = await User.findById(currentUserId).lean();
    } else {
        res.locals.currentUser = null;
    }
    
    next();
});

// Authentication Middleware
function ensureAuthenticated(req, res, next) {
    if (currentUserId) {
        return next();
    }
    res.redirect('/login');
}

// Admin Check Middleware
function ensureAdmin(req, res, next) {
    if (currentUserRole === 'admin') {
        return next();
    }
    res.status(403).send("Forbidden: Admins only.");
}

// --- 3. HANDLEBARS VIEW ENGINE ---
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

// --- 4. AUTH ROUTES (Register/Login/Logout) ---
app.get('/register', (req, res) => {
    res.render('register', { pageTitle: "Register" });
});

app.post('/register', async (req, res) => {
    try {
        const { fullName, email, passportNumber, password } = req.body;
        
        const newUser = new User({ fullName, email, passportNumber, password });
        await newUser.save();

        // Pseudo-login upon successful registration
        currentUserId = newUser._id;
        currentUserRole = newUser.role;
        
        res.redirect('/profile'); 
    } catch (err) {
        let errorMessage = "Registration failed.";
        if (err.code === 11000) {
            errorMessage = "Email or Passport Number is already registered.";
        }
        res.status(400).send(errorMessage + " | " + err.message);
    }
});

app.get('/login', (req, res) => {
    res.render('login', { pageTitle: "Login" });
});

app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email }).lean();

        if (!user || user.password !== password) {
            return res.status(401).send("Invalid email or password.");
        }

        // Pseudo-login successful
        currentUserId = user._id;
        currentUserRole = user.role;

        if (user.role === 'admin') {
            res.redirect('/admin/flights');
        } else {
            res.redirect('/profile');
        }
    } catch (err) {
        res.status(500).send("Login error: " + err.message);
    }
});

// GET /logout (Reset session)
app.get('/logout', (req, res) => {
    currentUserId = null;
    currentUserRole = 'guest';
    res.redirect('/');
});


// --- 5. CORE APPLICATION ROUTES ---

// APPLY ADMIN PROTECTION TO FLIGHT ROUTES
app.use('/admin/flights', ensureAdmin, flightRoutes); 

app.get('/', async (req, res) => {
  try {
    const flights = await Flight.find().lean();
    const locations = ['MANILA', 'CEBU', 'DAVAO'];

    res.render('landingpage', { 
      pageTitle: "Flight Search",
      flights: flights,
      locations: locations
    });
  } catch (err) {
    res.status(500).send("Error fetching flights for landing page: " + err.message);
  }
});

// GET Route to show Reservation Form 
app.get('/reservation-form', ensureAuthenticated, async (req, res) => { 
    try {
        const flightId = req.query.flightId;
        const departureDate = req.query.date;

        if (!flightId || !departureDate) {
            const flights = await Flight.find().lean();
            const selectedFlight = flights[0] || { _id: new mongoose.Types.ObjectId(), basePrice: 5000, flightNumber: 'FX-001', departureDate: '2025-11-01' }; 

            res.render('reservation_form', { 
                pageTitle: "Book Flight", 
                flight: selectedFlight,
                reservedDate: selectedFlight.departureDate
            });
            return;
        }
        
        const selectedFlight = await Flight.findById(flightId).lean();
        
        if (!selectedFlight) {
            return res.status(404).send("Flight not found.");
        }

        res.render('reservation_form', { 
            pageTitle: "Book Flight", 
            flight: selectedFlight,
            reservedDate: departureDate
        });
    } catch (err) {
         res.status(500).send("Error fetching flight for reservation: " + err.message);
    }
});

// POST Route to handle Reservation Form Submission (CREATE)
app.post('/reservation-form/create', ensureAuthenticated, async (req, res) => { 
    try {
        const { flightId, selectedSeat, mealOption, extraBaggage, totalPrice, reservedDate } = req.body;
        
        const user = await User.findById(currentUserId).lean();

        if (!user || !flightId || !selectedSeat || !reservedDate) {
            return res.status(400).send("Missing user or required reservation fields.");
        }

        const newReservation = new Reservation({
            // Populate reservation using data from the logged-in user (Milestone 2/3 prep)
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
        res.status(500).send("Error creating reservation: " + err.message);
    }
});


// GET Route to show My Reservations (READ)
app.get('/my-reservations', ensureAuthenticated, async (req, res) => { 
    try {
        const user = await User.findById(currentUserId).lean();
        if (!user) {
            return res.redirect('/logout');
        }
        
        // FILTER reservations by the current user's passportNumber
        const reservations = await Reservation.find({ 
            passportNumber: user.passportNumber 
        })
        .populate('flight')
        .lean();
        
        res.render('my_reservations', { 
            pageTitle: "My Reservations",
            reservations: reservations
        });
    } catch (err) {
        res.status(500).send("Error fetching reservations: " + err.message);
    }
});

// POST Route to handle Reservation Update (UPDATE)
app.post('/my-reservations/update/:id', ensureAuthenticated, async (req, res) => { 
    try {
        const reservationId = req.params.id;
        const { selectedSeat, mealOption, extraBaggage, totalPrice } = req.body; 

        const updatedReservation = await Reservation.findByIdAndUpdate(reservationId, {
            selectedSeat,
            mealOption: safeParseInt(mealOption),
            extraBaggage: safeParseInt(extraBaggage, 2),
            totalPrice: safeParseInt(totalPrice),
        }, { new: true, runValidators: true });

        if (!updatedReservation) {
            return res.status(404).send("Reservation not found.");
        }
        
        res.redirect('/my-reservations'); 
    } catch (err) {
        res.status(500).send("Error updating reservation: " + err.message);
    }
});

// POST Route to handle Reservation Cancellation (DELETE)
app.post('/my-reservations/cancel/:id', ensureAuthenticated, async (req, res) => { 
    try {
        const reservationId = req.params.id;
        const deletedReservation = await Reservation.findByIdAndDelete(reservationId);

        if (!deletedReservation) {
            return res.status(404).send("Reservation not found.");
        }
        
        res.redirect('/my-reservations');
    } catch (err) {
        res.status(500).send("Error deleting reservation: " + err.message);
    }
});


// GET Route to show Profile (READ User from DB)
app.get('/profile', ensureAuthenticated, async (req, res) => { 
    try {
        const user = await User.findById(currentUserId).lean();
        if (!user) {
            return res.redirect('/logout');
        }
        res.render('profile', { 
            pageTitle: "User Profile",
            user: user
        });
    } catch (err) {
        res.status(500).send("Error fetching profile: " + err.message);
    }
});

// POST Route to update Profile (UPDATE User in DB)
app.post('/profile/update', ensureAuthenticated, async (req, res) => { 
    try {
        const { fullName, email, passportNumber } = req.body;
        
        const updatedUser = await User.findByIdAndUpdate(currentUserId, {
            fullName,
            email,
            passportNumber
        }, { new: true, runValidators: true });
        
        if (!updatedUser) {
             return res.status(404).send("User profile not found.");
        }

        res.redirect('/profile'); 
    } catch (err) {
        let errorMessage = "Profile update failed.";
        if (err.code === 11000) {
            errorMessage = "Email or Passport Number is already registered.";
        }
        res.status(400).send(errorMessage + " | " + err.message);
    }
});

// GET /admin/users (Admin Management)
app.get('/admin/users', ensureAdmin, async (req, res) => { 
    try {
        const users = await User.find().lean();
        res.render('admin_users', { 
            pageTitle: "User Management",
            users: users
        });
    } catch (err) {
        res.status(500).send("Error fetching users: " + err.message);
    }
});

// GET /
app.get('/', async (req, res) => {
  try {
    const { origin, destination, departure_date, arrival_date, pax } = req.query;
    
    const filter = {};
    
    // Build the query filter based on input parameters
    if (origin) {
        filter.origin = origin.toUpperCase();
    }
    if (destination) {
        filter.destination = destination.toUpperCase();
    }
    
    // Filter by exact date match (date is stored as string 'YYYY-MM-DD')
    if (departure_date) {
        filter.departureDate = departure_date;
    }
    if (arrival_date) {
        filter.arrivalDate = arrival_date;
    }

    // Fetch flights based on the constructed filter
    const flights = await Flight.find(filter).lean();
    const locations = ['MANILA', 'CEBU', 'DAVAO'];

    res.render('landingpage', { 
      pageTitle: "Flight Search",
      flights: flights,
      locations: locations,
      query: req.query
    });
  } catch (err) {
    res.status(500).send("Error fetching flights for landing page: " + err.message);
  }
});

// --- 6. START THE SERVER ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});