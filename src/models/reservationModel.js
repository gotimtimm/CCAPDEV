// src/models/reservationModel.js
const mongoose = require('mongoose');

// Helper to generate a random 6-character PNR
const generatePNR = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const reservationSchema = new mongoose.Schema({
  // Passenger Details
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  passportNumber: { type: String, required: true },
  
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Flight Reference
  flight: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Flight',
    required: true
  },
  
  selectedSeat: { type: String, required: true },
  mealOption: { type: Number, required: true, default: 0 },
  extraBaggage: { type: Number, required: true, default: 2 },
  totalPrice: { type: Number, required: true, min: 0 },
  reservedDate: { type: String, required: true },
  
  // New Status Field
  status: {
    type: String,
    enum: ['Booked', 'Cancelled'],
    default: 'Booked'
  },
  
  pnr: { 
    type: String, 
    unique: true, 
    default: generatePNR // Auto-generates on creation
  },
  isCheckedIn: { type: Boolean, default: false },
  boardingPassNumber: { type: String }
});

const Reservation = mongoose.model('Reservation', reservationSchema);

module.exports = Reservation;
