const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../src/models/userModel');
const Flight = require('../src/models/flightModel');
const Reservation = require('../src/models/reservationModel');

const userAgent = request.agent(app);
const adminAgent = request.agent(app);

// Shared data for tests
let flightId;
let reservationId;

// Setup and Teardown
beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/flightDB");
    }
    
    await User.deleteMany({ email: { $in: ['test_jest@dlsu.edu.ph', 'admin@lasalle.ph'] } });
    await Flight.deleteMany({ flightNumber: 'JEST001' });
});

afterAll(async () => {
    await mongoose.connection.close();
});

describe('MCO3 Main Workflows', () => {

    // --- 1. USER AUTHENTICATION ---
    describe('User Authentication', () => {
        it('POST /register - should create a new user', async () => {
            const res = await userAgent
                .post('/register')
                .send({
                    fullName: 'Jest Test User',
                    email: 'test_jest@dlsu.edu.ph',
                    passportNumber: 'P999888777',
                    password: 'password123'
                });
            
            expect(res.statusCode).toEqual(302);
            expect(res.headers.location).toBe('/profile');
        });

        it('POST /login - should fail with invalid credentials', async () => {
            const res = await request(app)
                .post('/login')
                .send({
                    email: 'wrong@dlsu.edu.ph',
                    password: 'wrongpassword'
                });
            
            expect(res.statusCode).toEqual(200);
            expect(res.text).toContain("Invalid email or password");
        });

        it('POST /login - should login successfully as User', async () => {
            const res = await userAgent
                .post('/login')
                .send({
                    email: 'test_jest@dlsu.edu.ph',
                    password: 'password123'
                });
            
            expect(res.statusCode).toEqual(302);
            expect(res.headers.location).toBe('/profile');
        });
    });

    // --- 2. ADMIN FLIGHT MANAGEMENT ---
    describe('Admin Flight Creation', () => {
        it('Setup: Login as Admin', async () => {
            const res = await adminAgent
                .post('/login')
                .send({
                    email: 'admin@lasalle.ph',
                    password: 'admin'
                });
            expect(res.statusCode).toEqual(302);
            expect(res.headers.location).toBe('/admin/flights');
        });

        it('POST /admin/flights/create - should create a flight', async () => {
            const res = await adminAgent
                .post('/admin/flights/create')
                .send({
                    flightNumber: 'JEST001',
                    airlineName: 'Jest Airlines',
                    origin: 'MANILA',
                    destination: 'CEBU',
                    basePrice: 3500,
                    departureDate: '2025-12-25',
                    departureTime: '10:00',
                    arrivalDate: '2025-12-25',
                    arrivalTime: '11:30',
                    aircraftType: 'Airbus A320',
                    seatCapacity: 100
                });
            
            expect(res.statusCode).toEqual(302);
            
            const flight = await Flight.findOne({ flightNumber: 'JEST001' });
            expect(flight).not.toBeNull();
            flightId = flight._id.toString();
        });
    });

    // --- 3. RESERVATION MANAGEMENT ---
    describe('Reservation Management', () => {
        it('POST /reservation-form/create - should create a reservation', async () => {
            const res = await userAgent
                .post('/reservation-form/create')
                .send({
                    flightId: flightId,
                    fullName: 'Jest Passenger', 
                    passportNumber: 'P12345678', 
                    selectedSeat: '1A',
                    mealOption: 0,
                    extraBaggage: 20,
                    totalPrice: 5500,
                    reservedDate: '2025-12-25'
                });

            expect(res.statusCode).toEqual(302);

            const reservation = await Reservation.findOne({ selectedSeat: '1A', flight: flightId });
            expect(reservation).not.toBeNull();
            reservationId = reservation._id.toString();
        });

        it('POST /my-reservations/cancel/:id - should cancel a reservation', async () => {
            expect(reservationId).toBeDefined();

            const res = await userAgent
                .post(`/my-reservations/cancel/${reservationId}`);
            
            expect(res.statusCode).toEqual(302);
            
            const check = await Reservation.findById(reservationId);
            expect(check).toBeNull();
        });
    });
});