const express = require('express');
const { create } = require('express-handlebars');
const mongoose = require('mongoose');
const session = require('express-session'); 

const { body, validationResult, param } = require('express-validator');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const flightRoutes = require('./src/routes/flight_routes');
const reservationRoutes = require('./src/routes/reservation_routes');
const userRoutes = require('./src/routes/user_routes');
const authRoutes = require('./src/routes/auth_routes'); 
const adminRoutes = require('./src/routes/admin_routes'); 

const Flight = require('./src/models/flight');
const Reservation = require('./src/models/reservation');
const User = require('./src/models/user');

const app = express();
const PORT = 3000;

const MONGO_URI = 'mongodb://127.0.0.1:27017/airlineDB'; 

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => console.error('MongoDB connection error:', err));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "https://code.jquery.com", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

app.use(express.static('public')); 
app.use(express.urlencoded({ extended: true })); 
app.use(express.json());

app.use(session({
  secret: 'milestone2-session',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.removeHeader('X-Powered-By');
  next();
});

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

const hbs = create({
  extname: '.hbs',
  defaultLayout: 'main',
  layoutsDir: __dirname + '/src/views/layouts',
  helpers: {
    eq: (v1, v2) => v1 === v2,
  }
});

app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', './src/views'); 

const validateUserRegistration = [
  body('fullName')
    .notEmpty().withMessage('Full name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2-100 characters')
    .matches(/^[A-Za-z\s]+$/).withMessage('Name can only contain letters and spaces'),
  
  body('email')
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  
  body('passportNumber')
    .notEmpty().withMessage('Passport number is required')
    .isLength({ min: 6, max: 20 }).withMessage('Passport number must be 6-20 characters')
    .matches(/^[A-Z0-9]+$/).withMessage('Passport number can only contain uppercase letters and numbers'),
  
  body('password')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
];

const validateUserLogin = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

const validateReservation = [
  body('selectedSeat')
    .notEmpty().withMessage('Seat selection is required')
    .matches(/^[A-D][1-9][0-5]?$/).withMessage('Invalid seat format (e.g., A1, B15)'),
  
  body('mealOption').isInt({ min: 0 }).withMessage('Invalid meal option'),
  body('extraBaggage').isInt({ min: 2, max: 20 }).withMessage('Baggage must be between 2-20 kg'),
  body('totalPrice').isFloat({ min: 0 }).withMessage('Invalid total price'),
  body('flightId').isMongoId().withMessage('Invalid flight ID')
];

const validateObjectId = [
  param('id').isMongoId().withMessage('Invalid ID format')
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    return res.status(400).json({
      success: false,
      errors: errorMessages
    });
  }
  next();
};

const checkSeatAvailability = async (flightId, seatNumber, reservedDate) => {
  try {
    const existingBooking = await Reservation.findOne({
      flight: flightId,
      selectedSeat: seatNumber.toUpperCase(),
      reservedDate: reservedDate,
      status: 'Booked'
    });
    
    return !existingBooking;
  } catch (error) {
    console.error('Error checking seat availability:', error);
    return false;
  }
};

const bookSeatAtomically = async (bookingData) => {
  const session = await mongoose.startSession();
  
  try {
    let result;
    
    await session.withTransaction(async () => {
      const isAvailable = await checkSeatAvailability(
        bookingData.flight, 
        bookingData.selectedSeat, 
        bookingData.reservedDate
      );
      
      if (!isAvailable) {
        throw new Error('Seat is no longer available');
      }

      const reservation = new Reservation(bookingData);
      result = await reservation.save({ session });

      const conflictingReservation = await Reservation.findOne({
        flight: bookingData.flight,
        selectedSeat: bookingData.selectedSeat,
        reservedDate: bookingData.reservedDate,
        status: 'Booked',
        _id: { $ne: result._id }
      }).session(session);

      if (conflictingReservation) {
        throw new Error('Double booking detected');
      }
    });
    
    await session.commitTransaction();
    return result;
    
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

app.get('/', async (req, res) => {
  try {
    const flights = await Flight.find({}).lean(); 
    res.render('landingpage', { 
      layout: 'main',
      flights: flights
    });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

app.post('/secure-register', 
  validateUserRegistration, 
  handleValidationErrors, 
  async (req, res) => {
    try {
      const { fullName, email, passportNumber, password } = req.body;
      
      const existingUser = await User.findOne({ 
        $or: [
          { email: email.toLowerCase().trim() },
          { passportNumber: passportNumber.toUpperCase().trim() }
        ]
      });
      
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email or passport number already exists'
        });
      }
      
      const newUser = new User({ 
        fullName: fullName.trim(), 
        email: email.toLowerCase().trim(), 
        passportNumber: passportNumber.toUpperCase().trim(), 
        password: password 
      });
      
      await newUser.save();
      
      req.session.user = {
        id: newUser._id,
        email: newUser.email,
        name: newUser.fullName
      };
      
      res.json({ 
        success: true, 
        message: 'Registration successful',
        user: {
          id: newUser._id,
          name: newUser.fullName,
          email: newUser.email
        }
      });
      
    } catch (err) {
      console.error('Registration Error:', err);
      res.status(500).json({ success: false, message: 'Registration failed' });
    }
});

app.post('/secure-reservations', 
  validateReservation,
  handleValidationErrors,
  async (req, res) => {
    try {
      const { flightId, selectedSeat, mealOption, extraBaggage, totalPrice, reservedDate } = req.body;

      if (!req.session.user) {
        return res.status(401).json({
          success: false,
          message: 'Please login to make a reservation'
        });
      }

      if (!/^[A-D][1-9][0-5]?$/.test(selectedSeat)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid seat format. Please select a valid seat (A1-D15).'
        });
      }

      const isSeatAvailable = await checkSeatAvailability(flightId, selectedSeat, reservedDate);
      
      if (!isSeatAvailable) {
        return res.status(400).json({
          success: false,
          message: 'Selected seat is no longer available. Please choose another seat.'
        });
      }

      const user = await User.findById(req.session.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const bookingData = {
        user: req.session.user.id,
        fullName: user.fullName,
        email: user.email,
        passportNumber: user.passportNumber,
        flight: flightId,
        selectedSeat: selectedSeat.toUpperCase().trim(),
        mealOption: parseInt(mealOption) || 0,
        extraBaggage: parseInt(extraBaggage) || 2,
        totalPrice: parseFloat(totalPrice) || 0,
        reservedDate
      };

      const reservation = await bookSeatAtomically(bookingData);
      
      res.json({ 
        success: true, 
        message: 'Reservation created successfully',
        reservation: {
          id: reservation._id,
          seat: selectedSeat,
          reference: reservation.bookingReference
        }
      });
      
    } catch (err) {
      console.error('Reservation Error:', err);
      
      if (err.message.includes('duplicate key') || err.message.includes('Double booking') || err.message.includes('no longer available')) {
        return res.status(400).json({
          success: false,
          message: 'This seat was just taken by another passenger. Please select a different seat.'
        });
      }
      
      res.status(500).json({ success: false, message: 'Error creating reservation' });
    }
});

app.use('/auth', authRoutes); 
app.use('/admin', adminRoutes); 
app.use('/flights', flightRoutes);
app.use('/reservations', reservationRoutes);
app.use('/user', userRoutes);

app.use((err, req, res, next) => {
  console.error('System Error:', err.message);
  
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ success: false, message: 'Something went wrong!' });
  } else {
    res.status(500).json({ 
      success: false, 
      message: err.message
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('System Hardening Features Enabled:');
  console.log('   - Input Validation');
  console.log('   - Double Booking Prevention');
  console.log('   - Security Headers');
  console.log('   - Rate Limiting');
});
