const request = require('supertest');
const app = require('../server'); // Imports your server instance
const mongoose = require('mongoose');

// Connect to real DB, you might want to connect/disconnect in beforeAll/afterAll
// or use a separate test database. 

describe('MCO3 Main Workflows', () => {

    //  User Authentication Tests 
    describe('User Authentication', () => {
        it('POST /login - should fail with invalid credentials', async () => {
            const res = await request(app)
                .post('/login') // Update accordingly if need be, after the connection of DB
                .send({
                    email: 'wrong@dlsu.edu.ph',
                    password: 'wrongpassword'
                });
            expect(res.statusCode).not.toEqual(200); 
        });

        it('POST /register - should create a new user', async () => {
            const res = await request(app)
                .post('/register')
                .send({
                    name: 'Test User',
                    email: 'test_jest@dlsu.edu.ph',
                    password: 'password123'
                });
            expect([200, 201, 302]).toContain(res.statusCode);
        });
    });

    // Flight Creation (Admin)
    describe('Admin Flight Creation', () => {
        it('POST /admin/flights - should create a flight', async () => {
            // You may need to mock admin login here depending on your middleware
            const res = await request(app)
                .post('/admin/flights/create') // Update with your actual route
                .send({
                    flightNumber: 'JEST001',
                    origin: 'MNL',
                    destination: 'CEB',
                    price: 5000,
                    schedule: '2025-12-25 10:00:00'
                });
            expect([200, 201, 302]).toContain(res.statusCode);
        });
    });

    // Reservation Creation & Cancellation 
    describe('Reservation Management', () => {
        it('POST /book - should create a reservation', async () => {
            const res = await request(app)
                .post('/book')
                .send({
                    flightId: 'dummy_flight_id', // Add actual ID from DB once connected.
                    seat: '1A'
                });
            expect([200, 201, 302]).toContain(res.statusCode);
        });

        it('POST /cancel - should cancel a reservation', async () => {
            const res = await request(app)
                .post('/cancel')
                .send({
                    bookingId: 'dummy_booking_id'
                });
            expect([200, 201, 302]).toContain(res.statusCode);
        });
    });
});