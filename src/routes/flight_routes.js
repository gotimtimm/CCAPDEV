const express = require('express');
const router = express.Router();
const Flight = require('../models/flight');

router.get('/', async (req, res) => {
  try {
    const flights = await Flight.find({}); 
    
    res.render('admin_flights', { 
        flights: flights, 
        layout: 'main'
    }); 
  } catch (err) {
    console.error("Error in /flights route:", err);
    res.status(500).send('Server Error. Check terminal for details.');
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
    console.error("Error in /flights/add route:", err);
    res.status(500).send('Server Error. Check terminal for details.');
  }
});

router.post('/delete/:id', async (req, res) => {
  try {
    const flightId = req.params.id;
    await Flight.findByIdAndDelete(flightId);
    res.redirect('/flights');
  } catch (err) {
    console.error("Error in /flights/delete route:", err);
    res.status(500).send('Server Error. Check terminal for details.');
  }
});

module.exports = router;