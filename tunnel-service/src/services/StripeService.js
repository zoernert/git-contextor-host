const stripe = require('../config/stripe');

// Stripe operations
class StripeService {
  async createCustomer(email, metadata = {}) {
    console.log(`Creating Stripe customer for ${email}`);
    const customer = await stripe.customers.create({
        email,
        metadata
    });
    return customer;
  }

  async createSubscription(customerId, priceId) {
    console.log(`Creating Stripe subscription for customer ${customerId} with price ${priceId}`);
    
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent']
    });
    
    return subscription;
  }

  async cancelSubscription(subscriptionId) {
    console.log(`Canceling Stripe subscription ${subscriptionId}`);
    
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true
    });
    
    return subscription;
  }

  async handleWebhook(event) {
    console.log(`Handling Stripe webhook: ${event.type}`);
    
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdate(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object);
        break;
      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }
  }

  async handleSubscriptionUpdate(subscription) {
    const User = require('../models/User');
    const Subscription = require('../models/Subscription');
    const plansConfig = require('../config/plans');
    
    // Find the plan based on price ID
    const priceId = subscription.items.data[0].price.id;
    const planName = Object.keys(plansConfig).find(key => 
      plansConfig[key].stripePriceId === priceId
    );
    
    if (!planName) {
      console.error(`No plan found for price ID: ${priceId}`);
      return;
    }
    
    // Update user plan
    await User.findOneAndUpdate(
      { stripeCustomerId: subscription.customer },
      { plan: planName }
    );
    
    // Update or create subscription record
    await Subscription.findOneAndUpdate(
      { stripeSubscriptionId: subscription.id },
      {
        userId: (await User.findOne({ stripeCustomerId: subscription.customer }))._id,
        stripeSubscriptionId: subscription.id,
        status: subscription.status,
        plan: planName,
        limits: plansConfig[planName].limits,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000)
      },
      { upsert: true }
    );
  }

  async handleSubscriptionDeleted(subscription) {
    const User = require('../models/User');
    const Subscription = require('../models/Subscription');
    
    // Revert user to free plan
    await User.findOneAndUpdate(
      { stripeCustomerId: subscription.customer },
      { plan: 'free' }
    );
    
    // Remove subscription record
    await Subscription.findOneAndDelete(
      { stripeSubscriptionId: subscription.id }
    );
  }

  async handlePaymentSucceeded(invoice) {
    // Handle successful payment
    console.log(`Payment succeeded for invoice: ${invoice.id}`);
  }

  async handlePaymentFailed(invoice) {
    // Handle failed payment
    console.log(`Payment failed for invoice: ${invoice.id}`);
  }

  async getUsage(customerId, period) {
    // Get usage statistics for billing
  }

  async calculateMRR() {
    let mrr = 0;
    let hasMore = true;
    let startingAfter;

    while (hasMore) {
      const subscriptions = await stripe.subscriptions.list({
        limit: 100,
        status: 'active',
        starting_after: startingAfter,
      });

      for (const sub of subscriptions.data) {
        if (sub.items.data.length > 0) {
            const price = sub.items.data[0].price;
            if (price && price.unit_amount && price.recurring) {
                if (price.recurring.interval === 'month') {
                    mrr += price.unit_amount;
                } else if (price.recurring.interval === 'year') {
                    mrr += price.unit_amount / 12;
                }
            }
        }
      }

      if (subscriptions.has_more) {
        startingAfter = subscriptions.data[subscriptions.data.length - 1].id;
      } else {
        hasMore = false;
      }
    }
    
    return mrr / 100; // Convert from cents to dollars
  }
}

module.exports = new StripeService();
