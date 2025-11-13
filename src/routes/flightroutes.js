// flightroutes.js
const express = require('express');
const router = express.Router();
const Flight = require('../models/flightModel');

// Define locations once
const locations = ['MANILA', 'CEBU', 'DAVAO'];

// --- 1. READ (View All Flights) ---
// GET /admin/flights
router.get('/', async (req, res) => {
  try {
    const flights = await Flight.find().lean();
    res.render('admin_flights', { 
      flights: flights,
      pageTitle: "Flight Management"
    });
  } catch (err) {
    res.status(500).send("Error fetching flights: " + err.message);
  }
});

// --- 2. CREATE (Show "Add Flight" Form) ---
// GET /admin/flights/new
router.get('/new', (req, res) => {
  res.render('add_flight', {
    pageTitle: "Add New Flight",
    locations: locations
  });
});

// --- 3. CREATE (Handle Form Submission) ---
// POST /admin/flights/create
router.post('/create', async (req, res) => {
  try {
    // req.body contains the data from the 'add_flight.hbs' form
    const newFlight = new Flight({
      flightNumber: req.body.flightNumber,
      airlineName: req.body.airlineName,
      origin: req.body.origin,
      destination: req.body.destination,
      basePrice: req.body.basePrice,
      departureDate: req.body.departureDate,
      departureTime: req.body.departureTime,
      arrivalDate: req.body.arrivalDate,  
      arrivalTime: req.body.arrivalTime,
      aircraftType: req.body.aircraftType,
      seatCapacity: req.body.seatCapacity
    });
    
    await newFlight.save();
    res.redirect('/admin/flights'); // Redirect back to the list
  } catch (err) {
    res.status(500).send("Error creating flight: " + err.message);
  }
});

// --- 4. UPDATE (Show "Edit Flight" Form) ---
// GET /admin/flights/edit/:id
router.get('/edit/:id', async (req, res) => {
  try {
    const flight = await Flight.findById(req.params.id).lean();
    if (!flight) {
      return res.status(404).send("Flight not found");
    }
    res.render('edit_flight', {
      flight: flight,
      pageTitle: "Edit Flight",
      locations: locations
    });
  } catch (err) {
    res.status(500).send("Error fetching flight: " + err.message);
  }
});

// --- 5. UPDATE (Handle Form Submission) ---
// POST /admin/flights/update/:id
router.post('/update/:id', async (req, res) => {
  try {
    // req.body now contains airlineName, departureTime, and arrivalTime
    await Flight.findByIdAndUpdate(req.params.id, req.body);
    res.redirect('/admin/flights'); // Redirect back to the list
  } catch (err) {
    res.status(500).send("Error updating flight: " + err.message);
  }
});

// --- 6. DELETE (Handle Delete Action) ---
// POST /admin/flights/delete/:id
router.post('/delete/:id', async (req, res) => {
  try {
    await Flight.findByIdAndDelete(req.params.id);
    res.redirect('/admin/flights'); // Redirect back to the list
  } catch (err) {
    res.status(500).send("Error deleting flight: " + err.message);
  }
});

module.exports = router;