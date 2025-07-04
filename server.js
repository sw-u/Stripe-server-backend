const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY); // Replace with your Stripe secret key


app.use(cors());
app.use(bodyParser.json()); 
app.use(express.static('public'));

const unlockStatus = {}; // In-memory storage for demo: { userID: true }

// 🔁 Create Checkout Session
app.post('/create-checkout-session', async (req, res) => {
  const { userID } = req.body;

  const session = await stripe.checkout.sessions.create({
    
    mode: 'payment',
    success_url: 'https://stripe-server-backend.onrender.com/success',
    cancel_url: 'https://stripe-server-backend.onrender.com/cancel',
    metadata: { userID },
  });

  res.json({ url: session.url });
});

// 🔁 Stripe Webhook (must use raw body)
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET; // Your Stripe webhook secret
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log('Webhook signature verification failed.');
    return res.sendStatus(400);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userID = session.metadata.userID;
    unlockStatus[userID] = true;
    console.log(`✅ Purchase complete for userID: ${userID}`);
  }

  res.sendStatus(200);
});

// 🔁 Check unlock status
app.get('/card-status', (req, res) => {
  const userID = req.query.userID;
  const purchased = unlockStatus[userID] || false;
  res.json({ purchased });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
