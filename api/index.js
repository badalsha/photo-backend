const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config(); // To use environment variables

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cashfree credentials from environment variables
const appId = process.env.APP_ID;
const secretKey = process.env.SECRET_KEY;

const headers = {
  'accept': 'application/json',
  'x-api-version': '2023-08-01',
  'content-type': 'application/json',
  'x-client-id': appId,
  'x-client-secret': secretKey,
};

// Serve static HTML files
app.get('/terms-and-conditions', (req, res) => {
  res.sendFile(path.join(__dirname, '../TnC.html'));  // Adjusted to point one level up
});

app.get('/privacy-policy', (req, res) => {
  res.sendFile(path.join(__dirname, '../Privacy.html'));  // Adjusted to point one level up
});

// In-memory storage for payment link IDs
const payments = {};

// Payment creation endpoint
app.post('/api/create-payment-order', async (req, res) => {
  const { amount } = req.body;

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const linkId = `link_${Date.now()}`; // Unique link ID
  const orderAmount = amount;
  const orderCurrency = 'INR';
  const returnUrl = 'https://presizer-app.netlify.app/';  // Adjust to your frontend URL
  const notifyUrl = 'http://localhost:3000/api/payment-notify';  // Adjust to Vercel endpoint after deployment

  try {
    const response = await axios.post('https://sandbox.cashfree.com/pg/links', {
      link_id: linkId,
      link_amount: orderAmount,
      link_currency: orderCurrency,
      link_purpose: 'Payment',
      link_notify: { send_sms: false, send_email: false },
      customer_email: 'customer@example.com',
      customer_details: { customer_phone: '9999999999' },
      return_url: returnUrl,
      notify_url: notifyUrl,
    }, { headers });

    const createdLinkId = response.data.link_id;
    console.log(`Created payment order with link ID: ${createdLinkId}`);

    if (createdLinkId && response.data.link_url) {
      payments[createdLinkId] = linkId;
      res.json({ paymentLink: response.data.link_url, link_id: createdLinkId });
    } else {
      res.status(400).json({ error: 'Failed to create payment' });
    }
  } catch (error) {
    console.error('Error creating payment order:', error.response?.data || error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Payment status check endpoint
app.get('/api/payment-status/:linkId', async (req, res) => {
  const { linkId } = req.params;

  if (!linkId || typeof linkId !== 'string') {
    return res.status(400).json({ error: 'Invalid link ID' });
  }

  const storedLinkId = payments[linkId];
  if (!storedLinkId) {
    return res.status(404).json({ error: 'Order not found' });
  }

  try {
    const response = await axios.get(`https://sandbox.cashfree.com/pg/links/${linkId}`, { headers });

    if (response.data.link_status === 'PAID') {
      res.json({ status: 'success' });
    } else {
      res.json({ status: 'pending' });
    }
  } catch (error) {
    console.error('Error checking payment status:', error.response?.data || error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Export the app (for Vercel serverless function)
module.exports = app;
