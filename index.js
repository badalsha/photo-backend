const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;
const cors = require('cors');
const path = require('path');
require('dotenv').config(); 

app.use(express.json());
app.use(cors());

// Replace with your Cashfree credentials
const appId = process.env.APP_ID;
const secretKey = process.env.SECRET_KEY;

const headers = {
  'accept': 'application/json',
  'x-api-version': '2023-08-01',
  'content-type': 'application/json',
  'x-client-id': appId,
  'x-client-secret': secretKey,
};

app.get('/terms-and-conditions', (req, res) => {
  res.sendFile(path.join(__dirname, 'TnC.html'));
});
app.get('/privacy-policy', (req, res) => {
  res.sendFile(path.join(__dirname, 'Privacy.html'));
});

// In-memory storage for link_id (use a database in production)
const payments = {};

// Payment creation endpoint
// Payment creation endpoint
app.post('/api/create-payment-order', async (req, res) => {
  const { amount } = req.body;

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const linkId = `link_${Date.now()}`; // Unique link ID
  const orderAmount = amount;
  const orderCurrency = 'INR';
  const returnUrl = 'http://localhost:5173';
  const notifyUrl = 'http://localhost:3000/api/payment-notify';

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
      payments[createdLinkId] = linkId; // Store the linkId
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
app.get(`/api/payment-status/:linkId`, async (req, res) => {
  const { linkId } = req.params;

  if (!linkId || typeof linkId !== 'string') {
    return res.status(400).json({ error: 'Invalid link ID' });
  }

  const storedLinkId = payments[linkId];
  if (!storedLinkId) {
    return res.status(404).json({ error: 'Order not found' });
  }

  console.log(`Checking payment status for link ID: ${linkId}`);
  
  try {
    const response = await axios.get(`https://sandbox.cashfree.com/pg/links/${linkId}`, { headers });

    console.log('Response data:', response.data); // Log the response data

    // Check if the payment is successful
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

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
