const express = require('express');
const router = express.Router();
const Flight = require('../models/flight'); 

router.get('/', async (req, res) => {
  try {
    const flights = await flight.find({});
    res.render('admin_flights', { 
        flights: flights, 
        layout: 'main' // Specify layout
    }); 
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

router.post('/add', async (req, res) => {
  try {
    const { flightNumber, origin, destination, schedule, aircraftType, seatCapacity } = req.body;
    
    const newFlight = new Flight({
      flightNumber,
      origin,
      destination,
      schedule,
      aircraftType,
      seatCapacity
    });

    await newFlight.save();
    res.redirect('/flights'); 
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

router.post('/delete/:id', async (req, res) => {
  try {
    const flightId = req.params.id;
    await Flight.findByIdAndDelete(flightId);
    res.redirect('/flights');
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;