const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  flightId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Flight',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  passengerName: {
    type: String,
    required: true
  },
  passengerEmail: {
    type: String,
    required: true
  },
  passengerPassport: {
    type: String,
    required: true
  },
  mealOption: {
    type: String,
    default: 'None'
  },
  extraBaggage: {
    type: Number,
    default: 0
  },
  selectedSeat: {
    type: String,
    required: true
  },
  totalCost: {
    type: String,
    required: true
  },
  bookingStatus: {
    type: String,
    enum: ['Confirmed', 'Cancelled'],
    default: 'Confirmed'
  }
});

const Reservation = mongoose.model('Reservation', reservationSchema);
module.exports = Reservation;
