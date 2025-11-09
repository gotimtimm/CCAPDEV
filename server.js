const express = require('express');
const { create } = require('express-handlebars');
const mongoose = require('mongoose');

const flightRoutes = require('./src/routes/flight_routes');

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
  layoutsDir: __dirname + '/src/views/layouts'
});
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');
app.set('views', './src/views'); 

app.get('/', (req, res) => {
  res.render('landingpage', { layout: 'main' }); 
});

app.use('/flights', flightRoutes);

app.get('/my-reservations', (req, res) => {
  res.render('my_reservations', { layout: 'main' });
});

app.get('/reservation-form', (req, res) => {
  res.render('reservation_form', { layout: 'main' });
});

app.get('/profile', (req, res) => {
  res.render('profile', { layout: 'main' });
});

app.get('/admin/users', (req, res) => {
  res.render('admin_users', { layout: 'main' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});