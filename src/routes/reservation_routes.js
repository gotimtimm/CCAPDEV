const express = require('express');
const router = express.Router();
const Reservation = require('../models/reservation');
const Flight = require('../models/flight');
const { isAuthenticated } = require('../middleware/auth');

// GET reservation form
router.get('/reservation-form', isAuthenticated, async (req, res) => {
  try {
    const flightId = req.query.flightId;
    const flight = await Flight.findById(flightId);
    
    if (!flight) {
      return res.status(404).send('Flight not found');
    }
    
    res.render('reservation_form', { 
      flightId: flightId,
      flight: flight,
      layout: 'main'
    });
  } catch (err) {
    console.error("Error loading reservation form:", err);
    res.status(500).send('Server Error');
  }
});

// CREATE reservation
router.post('/book', isAuthenticated, async (req, res) => {
  try {
    const { flightId, passengerName, passengerEmail, passengerPassport, mealOption, extraBaggage, selectedSeat, totalCost } = req.body;
    
    // Check if seat is already taken
    const existingReservation = await Reservation.findOne({
      flightId,
      selectedSeat,
      bookingStatus: 'Confirmed'
    });
    
    if (existingReservation) {
      return res.status(400).send('Seat already taken. Please choose another seat.');
    }
    
    const newReservation = new Reservation({
      flightId,
      passengerName,
      passengerEmail,
      passengerPassport,
      mealOption,
      extraBaggage: parseInt(extraBaggage),
      selectedSeat,
      totalCost: parseInt(totalCost),
      userId: req.session.user.id // Link reservation to user
    });
    
    await newReservation.save();
    await Flight.findByIdAndUpdate(flightId, { $inc: { seatsAvailable: -1 } });

    res.redirect('/reservations/my-reservations');
  } catch (err) {
    console.error("Error booking flight:", err);
    res.status(500).send('Server Error');
  }
});

// READ user reservations
router.get('/my-reservations', isAuthenticated, async (req, res) => {
  try {
    const reservations = await Reservation.find({ userId: req.session.user.id }).populate('flightId');

    res.render('my_reservations', { 
      reservations: reservations,
      layout: 'main'
    });
  } catch (err) {
    console.error("Error fetching reservations:", err);
    res.status(500).send('Server Error');
  }
});

// UPDATE reservation form
router.get('/edit/:id', isAuthenticated, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.id).populate('flightId');
    
    // Check if reservation belongs to user
    if (reservation.userId.toString() !== req.session.user.id) {
      return res.status(403).send('Access denied');
    }
    
    res.render('edit_reservation', { 
      reservation: reservation,
      layout: 'main'
    });
  } catch (err) {
    console.error("Error fetching reservation:", err);
    res.status(500).send('Server Error');
  }
});

// UPDATE reservation
router.post('/update/:id', isAuthenticated, async (req, res) => {
  try {
    const { passengerName, passengerEmail, passengerPassport, mealOption, extraBaggage, selectedSeat } = req.body;

    // Check if new seat is available
    if (selectedSeat) {
      const reservation = await Reservation.findById(req.params.id);
      const existingReservation = await Reservation.findOne({
        flightId: reservation.flightId,
        selectedSeat,
        bookingStatus: 'Confirmed',
        _id: { $ne: req.params.id } // Exclude current reservation
      });
      
      if (existingReservation) {
        return res.status(400).send('Seat already taken. Please choose another seat.');
      }
    }

    await Reservation.findByIdAndUpdate(req.params.id, {
      passengerName,
      passengerEmail,
      passengerPassport,
      mealOption,
      extraBaggage: parseInt(extraBaggage),
      selectedSeat
    });

    res.redirect('/reservations/my-reservations');
  } catch (err) {
    console.error("Error updating reservation:", err);
    res.status(500).send('Server Error');
  }
});

// DELETE reservation (cancel)
router.post('/cancel/:id', isAuthenticated, async (req, res) => {
  try {
    const reservationId = req.params.id;
    
    const reservation = await Reservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).send('Reservation not found');
    }
    
    // Check if reservation belongs to user
    if (reservation.userId.toString() !== req.session.user.id) {
      return res.status(403).send('Access denied');
    }

    reservation.bookingStatus = 'Cancelled';
    await reservation.save();
    
    await Flight.findByIdAndUpdate(reservation.flightId, { $inc: { seatsAvailable: 1 } });

    res.redirect('/reservations/my-reservations');
  } catch (err) {
    console.error("Error cancelling reservation:", err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
