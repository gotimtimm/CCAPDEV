const express = require('express');
const { create } = require('express-handlebars');
const mongoose = require('mongoose');

const flightRoutes = require('./src/routes/flight_routes');
const reservationRoutes = require('./src/routes/reservation_routes');
const userRoutes = require('./src/routes/user_routes');

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
    const flights = await Flight.find({});
    res.render('landingpage', { 
      layout: 'main',
      flights: flights
    });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

app.get('/my-reservations', async (req, res) => {
  try {
    const reservations = await Reservation.find({}).populate('flightId');
    res.render('my_reservations', { 
      layout: 'main',
      reservations: reservations
    });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

app.get('/reservation-form', (req, res) => {
  res.render('reservation_form', { 
    layout: 'main',
    flightId: req.query.flightId 
  });
});

app.get('/profile', async (req, res) => {
  try {
    const user = await User.findOne({});
    res.render('profile', { 
      layout: 'main',
      user: user
    });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

app.get('/admin/users', async (req, res) => {
  try {
    const users = await User.find({});
    res.render('admin_users', { 
      layout: 'main',
      users: users
    });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

app.use('/flights', flightRoutes);
app.use('/reservations', reservationRoutes);
app.use('/user', userRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});