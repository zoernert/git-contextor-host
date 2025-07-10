const plans = {
    free: {
        name: 'Free',
        price: '$0/mo',
        limits: {
            maxTunnels: 1,
            maxDataTransfer: 1 // in GB
        },
        features: ['1 Tunnel', '1 GB Bandwidth/mo', 'Community Support']
    },
    basic: {
        name: 'Basic',
        price: '$5/mo',
        limits: {
            maxTunnels: 5,
            maxDataTransfer: 10
        },
        features: ['5 Tunnels', '10 GB Bandwidth/mo', 'Email Support']
    },
    pro: {
        name: 'Pro',
        price: '$15/mo',
        limits: {
            maxTunnels: 50, // Effectively unlimited for most
            maxDataTransfer: 50
        },
        features: ['Unlimited Tunnels', '50 GB Bandwidth/mo', 'Priority Support']
    },
    enterprise: {
        name: 'Enterprise',
        price: 'Contact Us',
        limits: {
            maxTunnels: -1, // unlimited
            maxDataTransfer: -1 // unlimited
        },
        features: ['Unlimited Tunnels', 'Custom Bandwidth', 'Dedicated Support', 'Custom Domains']
    }
};

module.exports = plans;
