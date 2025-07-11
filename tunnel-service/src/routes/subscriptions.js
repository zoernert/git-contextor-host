const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const plansConfig = require('../config/plans');
const stripe = require('../config/stripe');

// Dummy plan data. In a real app, this would come from Stripe.
const plans = Object.keys(plansConfig).map(key => ({
    id: key,
    name: plansConfig[key].name,
    price: plansConfig[key].price,
    features: plansConfig[key].features
}));

// @route   GET api/subscriptions/plans
// @desc    Get available subscription plans
// @access  Private
router.get('/plans', auth, (req, res) => {
    res.json(plans);
});

// @route   GET api/subscriptions/current
// @desc    Get user's current subscription
// @access  Private
router.get('/current', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        res.json({
            plan: user.plan,
            // more subscription details would go here
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/subscriptions/create-checkout-session
// @desc    Create Stripe checkout session for subscribing
// @access  Private
router.post('/create-checkout-session', auth, async (req, res) => {
    const { planId } = req.body;
    const plan = plansConfig[planId];

    if (!plan || !plan.stripePriceId) {
        return res.status(400).json({ msg: 'Invalid or free plan selected.' });
    }

    try {
        const user = await User.findById(req.user.id);
        const successUrl = `${process.env.FRONTEND_URL}/subscription?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${process.env.FRONTEND_URL}/subscription`;
        
        const session = await stripe.checkout.sessions.create({
            customer: user.stripeCustomerId,
            payment_method_types: ['card'],
            line_items: [{ price: plan.stripePriceId, quantity: 1 }],
            mode: 'subscription',
            success_url: successUrl,
            cancel_url: cancelUrl,
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error('Stripe checkout session error:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/subscriptions/webhook
// @desc    Stripe webhook handler
// @access  Public
router.post('/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Stripe webhook signature error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            const subscription = await stripe.subscriptions.retrieve(session.subscription);
            const planId = Object.keys(plansConfig).find(key => plansConfig[key].stripePriceId === subscription.items.data[0].price.id);

            if (planId) {
                await User.findOneAndUpdate(
                    { stripeCustomerId: session.customer },
                    { plan: planId }
                );
                console.log(`User with customer ID ${session.customer} subscribed to plan: ${planId}`);
            }
            break;
        }
        case 'customer.subscription.deleted': {
             const subscription = event.data.object;
             // The subscription was canceled. Revert user to free plan.
             await User.findOneAndUpdate(
                { stripeCustomerId: subscription.customer },
                { plan: 'free' }
             );
             console.log(`User ${subscription.customer} subscription canceled, reverted to free.`);
             break;
        }
        default:
            // console.log(`Unhandled Stripe event type ${event.type}`);
    }

    res.json({ received: true });
});

module.exports = router;
