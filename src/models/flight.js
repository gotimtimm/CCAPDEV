const mongoose = require('mongoose');

const flightSchema = new mongoose.Schema({
  flightNumber: {
    type: String,
    required: true,
    unique: true 
  },
  origin: {
    type: String,
    required: true
  },
  destination: {
    type: String,
    required: true
  },
  schedule: {
    type: Date,
    required: true
  },
  aircraftType: {
    type: String,
    default: 'Boeing 737'
  },
  seatCapacity: {
    type: Number,
    required: true,
    min: 50
  },
  seatsAvailable: {
    type: Number,
    required: true
  }
});

flightSchema.pre('save', function(next) {
  if (this.isNew) {
    this.seatsAvailable = this.seatCapacity;
  }
  next();
});

const Flight = mongoose.model('Flight', flightSchema);

module.exports = Flight;