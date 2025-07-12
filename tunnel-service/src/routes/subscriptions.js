const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const plansConfig = require('../config/plans');
const stripe = require('../config/stripe');
const StripeService = require('../services/StripeService');
const { body, validationResult } = require('express-validator');

// @route   GET api/subscriptions/plans
// @desc    Get available subscription plans
// @access  Public
router.get('/plans', (req, res) => {
    // Return plans as an array for frontend mapping
    const formattedPlans = Object.keys(plansConfig).map(key => ({
        id: key,
        name: plansConfig[key].name,
        price: plansConfig[key].price,
        features: plansConfig[key].features,
        limits: plansConfig[key].limits
    }));
    res.json(formattedPlans);
});

// @route   POST api/subscriptions/create
// @desc    Create a new subscription
// @access  Private
router.post('/create', [
    auth,
    body('priceId').notEmpty().withMessage('Price ID is required')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ msg: 'Price ID is required' });
    }

    try {
        const { priceId } = req.body;
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Create subscription via Stripe
        const stripeSubscription = await StripeService.createSubscription(user.stripeCustomerId, priceId);
        
        // Find the plan based on price ID
        const planName = Object.keys(plansConfig).find(key => 
            plansConfig[key].stripePriceId === priceId
        );
        
        if (!planName) {
            return res.status(400).json({ msg: 'Invalid price ID' });
        }

        // Create subscription record
        const subscription = new Subscription({
            userId: user._id,
            stripeSubscriptionId: stripeSubscription.id,
            status: stripeSubscription.status,
            plan: planName,
            limits: plansConfig[planName].limits,
            currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
            currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000)
        });

        await subscription.save();

        // Update user plan
        await User.findByIdAndUpdate(user._id, { plan: planName });

        res.json({ subscription });
    } catch (err) {
        console.error('Subscription creation error:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/subscriptions/current
// @desc    Get user's current subscription
// @access  Private
router.get('/current', auth, async (req, res) => {
    try {
        const subscription = await Subscription.findOne({ userId: req.user.id });
        
        if (!subscription) {
            return res.status(404).json({ msg: 'No subscription found' });
        }

        res.json(subscription);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/subscriptions/cancel
// @desc    Cancel user's subscription
// @access  Private
router.post('/cancel', auth, async (req, res) => {
    try {
        const subscription = await Subscription.findOne({ userId: req.user.id });
        
        if (!subscription) {
            return res.status(404).json({ msg: 'No subscription found' });
        }

        // Cancel subscription via Stripe
        await StripeService.cancelSubscription(subscription.stripeSubscriptionId);

        res.json({ msg: 'Subscription canceled successfully' });
    } catch (err) {
        console.error('Subscription cancellation error:', err.message);
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
        return res.status(400).json({ msg: 'Webhook signature verification failed' });
    }

    try {
        // Handle the event using StripeService
        await StripeService.handleWebhook(event);
        res.json({ received: true });
    } catch (err) {
        console.error('Webhook processing error:', err.message);
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

module.exports = router;
