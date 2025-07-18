const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
require('dotenv').config();

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ In-memory storage for game unlocks
const unlockStatus = {};

// ✅ 1. Raw body middleware for Stripe webhook (must come before anything else)
app.post('/webhook', express.raw({ type: 'application/json' }));

// ✅ 2. Apply JSON middleware AFTER raw webhook handler
app.use((req, res, next) => {
  if (req.originalUrl === '/webhook') {
    next(); // skip parsing
  } else {
    express.json()(req, res, next); // parse JSON for everything else
  }
});

app.use(cors());
app.use(express.static('public'));
app.get('/', (req, res) => {
  res.send('✅ Stripe backend is running!');
});
// ✅ Checkout session
app.post('/create-checkout-session', async (req, res) => {
  const { userID } = req.body;

  if (!userID) {
    return res.status(400).json({ error: "Missing userID" });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: 'https://stripe-server-backend.onrender.com/success.html',
      cancel_url: 'https://stripe-server-backend.onrender.com/cancel.html',
      metadata: { userID },
      line_items: [
        {
          price: 'price_1RmEBCPGqi2HuONzPmscbqGd',  //price ID
          quantity: 1,
        }
      ],
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("❌ Stripe session error:", err.message);
    res.status(500).json({ error: "Stripe session creation failed" });
  }
});

// ✅ Stripe Webhook — placed LAST, uses raw body
app.post('/webhook', (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  console.log('📡 Webhook triggered');
  console.log('📦 req.body is buffer?', Buffer.isBuffer(req.body)); // Must be true

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    console.log('✅ Webhook verified:', event.type);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userID = session.metadata.userID;
    unlockStatus[userID] = true;
    console.log(`🎉 Purchase completed for userID: ${userID}`);
  }

  res.sendStatus(200);
});

// ✅ Status check for Unity polling
app.get('/card-status', (req, res) => {
  const userID = req.query.userID;
  const purchased = unlockStatus[userID] || false;
  res.json({ purchased });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
