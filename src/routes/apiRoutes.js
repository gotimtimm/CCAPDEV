// src/routes/apiRoutes.js
const express = require('express');
const router = express.Router();
const Reservation = require('../models/reservationModel');
const Flight = require('../models/flightModel');

// POST /api/checkin
router.post('/checkin', async (req, res) => {
    try {
        const { pnr, lastName } = req.body;

        // 1. Find the reservation
        const reservation = await Reservation.findOne({ pnr: pnr }).populate('flight');

        if (!reservation) {
            return res.status(404).json({ success: false, message: "Booking not found." });
        }

        // 2. Validate Last Name (Simple check if fullName contains the last name)
        // We use .toLowerCase() to make it case-insensitive
        const storedName = reservation.fullName.toLowerCase();
        const inputName = lastName.toLowerCase().trim();

        if (!storedName.includes(inputName)) {
            return res.status(401).json({ success: false, message: "Last name does not match booking." });
        }

        // 3. Check if already checked in
        if (reservation.isCheckedIn) {
            return res.status(400).json({ success: false, message: "Already checked in." });
        }

        // 4. Generate Boarding Pass (Format: FLIGHT-SEAT-RANDOM)
        const bpNum = `BP-${reservation.flight.flightNumber}-${reservation.selectedSeat}`;
        
        // 5. Update Database
        reservation.isCheckedIn = true;
        reservation.boardingPassNumber = bpNum;
        await reservation.save();

        // 6. Return Success JSON
        return res.json({
            success: true,
            message: "Check-in successful!",
            data: {
                passenger: reservation.fullName,
                flight: reservation.flight.flightNumber,
                seat: reservation.selectedSeat,
                boardingPass: bpNum
            }
        });
        

    } catch (err) {
        console.error("API Error:", err);
        return res.status(500).json({ success: false, message: "Server error processing check-in." });
    }
});

router.get('/seats/:flightId', async (req, res) => {
    try {
        const flightId = req.params.flightId;
        // Find all active reservations for this flight
        const reservations = await Reservation.find({ 
            flight: flightId, 
            status: { $ne: 'Cancelled' } 
        }).select('selectedSeat');

        const occupiedSeats = reservations.map(r => r.selectedSeat);
        res.json({ success: true, occupiedSeats });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;