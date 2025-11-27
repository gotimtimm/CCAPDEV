const { body, validationResult, param } = require('express-validator');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const express = require('express');
const { create } = require('express-handlebars');
const mongoose = require('mongoose');
const session = require('express-session'); 

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
