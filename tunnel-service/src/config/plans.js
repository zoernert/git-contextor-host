const plans = {
    free: {
        name: 'Free',
        price: '$0/mo',
        stripePriceId: null,
        limits: {
            maxTunnels: 1,
            maxDataTransfer: 1, // in GB
            maxQdrantCollections: 0
        },
        features: ['1 Tunnel', '1 GB Bandwidth/mo', 'Community Support']
    },
    basic: {
        name: 'Basic',
        price: '$5/mo',
        stripePriceId: process.env.STRIPE_BASIC_PLAN_PRICE_ID,
        limits: {
            maxTunnels: 5,
            maxDataTransfer: 10,
            maxQdrantCollections: 1
        },
        features: ['5 Tunnels', '10 GB Bandwidth/mo', 'Email Support']
    },
    pro: {
        name: 'Pro',
        price: '$15/mo',
        stripePriceId: process.env.STRIPE_PRO_PLAN_PRICE_ID,
        limits: {
            maxTunnels: 50, // Effectively unlimited for most
            maxDataTransfer: 50,
            maxQdrantCollections: 5
        },
        features: ['Unlimited Tunnels', '50 GB Bandwidth/mo', 'Priority Support']
    },
    enterprise: {
        name: 'Enterprise',
        price: 'Contact Us',
        stripePriceId: null,
        limits: {
            maxTunnels: -1, // unlimited
            maxDataTransfer: -1, // unlimited
            maxQdrantCollections: -1
        },
        features: ['Unlimited Tunnels', 'Custom Bandwidth', 'Dedicated Support', 'Custom Domains']
    }
};

module.exports = plans;
