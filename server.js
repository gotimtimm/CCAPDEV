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

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => console.error('MongoDB connection error:', err));

app.use(express.static('public')); 
app.use(express.urlencoded({ extended: true })); 

app.use(session({
  secret: 'milestone2-session',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

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

app.use('/auth', authRoutes); 
app.use('/admin', adminRoutes); 
app.use('/flights', flightRoutes);
app.use('/reservations', reservationRoutes);
app.use('/user', userRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
