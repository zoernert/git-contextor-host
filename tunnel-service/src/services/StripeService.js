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
    // Create subscription with plan limits
  }

  async handleWebhook(event) {
    // Handle subscription updates, cancellations, etc.
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
