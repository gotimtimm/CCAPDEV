const express = require('express');
const router = express.Router();
const Flight = require('../models/flight');

// READ all flights
router.get('/', async (req, res) => {
  try {
    const flights = await Flight.find({}).lean();
    
    res.render('admin_flights', { 
        flights: flights, 
        layout: 'main'
    }); 
  } catch (err) {
    console.error("Error in /flights route:", err);
    res.status(500).send('Server Error. Check terminal for details.');
  }
});

// CREATE a new flight
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

// DELETE a flight
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

// GET route to show the edit page
router.get('/edit/:id', async (req, res) => {
  try {
    const flight = await Flight.findById(req.params.id).lean();
    res.render('admin_edit_flight', { 
      flight: flight,
      layout: 'main' 
    });
  } catch (err) {
    console.error("Error getting flight to edit:", err);
    res.status(500).send('Server Error');
  }
});

// POST route to save the updated flight
router.post('/update/:id', async (req, res) => {
  try {
    const flightId = req.params.id;
    const { flightNumber, origin, destination, schedule, aircraftType, seatCapacity } = req.body;

    await Flight.findByIdAndUpdate(flightId, {
      flightNumber,
      origin,
      destination,
      schedule,
      aircraftType,
      seatCapacity
    });

    res.redirect('/flights');
  } catch (err) {
    console.error("Error updating flight:", err);
    res.status(500).send('Server Error');
  }
});

module.exports = router;