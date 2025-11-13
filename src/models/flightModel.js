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
  airlineName: {
    type: String,
    required: true,
    trim: true,
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
  basePrice: {
    type: Number,
    required: true,
    min: 0
  },
  departureDate: {
    type: String,
    required: true
  },
  departureTime: {
    type: String,
    required: true
  },
  arrivalDate: {
    type: String,
    required: true
  },
  arrivalTime: {
    type: String,
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