// src/models/reservationModel.js
const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  // Passenger Details
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  passportNumber: { type: String, required: true },
  
  // Flight Reference
  flight: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Flight',
    required: true
  },
  
  selectedSeat: { type: String, required: true },
  mealOption: { type: Number, required: true, default: 0 }, // Stores cost in PHP
  extraBaggage: { type: Number, required: true, default: 2 }, // Stores weight in KG
  totalPrice: { type: Number, required: true, min: 0 },
  reservedDate: { type: String, required: true },
  
  // New Status Field
  status: {
    type: String,
    enum: ['Booked', 'Cancelled'],
    default: 'Booked'
  }
});

const Reservation = mongoose.model('Reservation', reservationSchema);

module.exports = Reservation;