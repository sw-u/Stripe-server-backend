const express = require('express');
const Stripe = require('stripe');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

// ✅ Middleware for everything EXCEPT webhook
app.use(cors());
app.use(express.static('public'));

// 💡 This handles JSON input for create-checkout-session etc.
app.use(bodyParser.json());

// 🔁 Create Checkout Session
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
          price: 'price_1RgNZrPp4PBsdqwr2MlLPPko',
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

// ⚠️ SPECIAL CASE: Webhook uses raw body — must be declared LAST and SEPARATELY!
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
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

app.get('/card-status', (req, res) => {
  const userID = req.query.userID;
  const purchased = unlockStatus[userID] || false;
  res.json({ purchased });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
