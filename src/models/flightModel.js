
// flightModel.js
const mongoose = require('mongoose');

const flightSchema = new mongoose.Schema({
  flightNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  origin: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  destination: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  schedule: {
    type: String, // Using String for flexibility (e.g., "08:00 Daily")
    required: true
  },
  aircraftType: {
    type: String,
    required: true,
    trim: true
  },
  seatCapacity: {
    type: Number,
    required: true,
    min: 1
  }
});

// Create the model from the schema
const Flight = mongoose.model('Flight', flightSchema);

// Export the model
module.exports = Flight;
