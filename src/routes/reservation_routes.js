const express = require('express');
const router = express.Router();
const Reservation = require('../models/reservation');
const Flight = require('../models/flight');

router.post('/book', async (req, res) => {
  try {
    const { flightId, passengerName, passengerEmail, passengerPassport, mealOption, extraBaggage, selectedSeat, totalCost } = req.body;
    
    const newReservation = new Reservation({
      flightId,
      passengerName,
      passengerEmail,
      passengerPassport,
      mealOption,
      extraBaggage,
      selectedSeat,
      totalCost
    });
    await newReservation.save();

    await Flight.findByIdAndUpdate(flightId, { $inc: { seatsAvailable: -1 } });

    res.redirect('/my-reservations');
  } catch (err) {
    console.error("Error booking flight:", err);
    res.status(500).send('Server Error');
  }
});

router.post('/cancel/:id', async (req, res) => {
  try {
    const reservationId = req.params.id;
    
    const reservation = await Reservation.findById(reservationId);
    if (!reservation) {
      return res.status(404).send('Reservation not found');
    }

    reservation.bookingStatus = 'Cancelled';
    await reservation.save();
    
    await Flight.findByIdAndUpdate(reservation.flightId, { $inc: { seatsAvailable: 1 } });

    res.redirect('/my-reservations');
  } catch (err) {
    console.error("Error cancelling reservation:", err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;