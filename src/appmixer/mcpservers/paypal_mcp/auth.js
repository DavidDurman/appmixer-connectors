'use strict';

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {
            auth: {
                'PAYPAL_ACCESS_TOKEN': {
                    'type': 'text',
                    'name': 'PAYPAL_ACCESS_TOKEN',
                    'tooltip': 'Follow the MCP documentation link to generate a PayPal access token from client ID and client Secret.'
                },
                'PAYPAL_ENVIRONMENT': {
                    'type': 'text',
                    'name': 'PAYPAL_ENVIRONMENT',
                    'tooltip': 'Set to either SANDBOX or PRODUCTION string.'
                }
            },

            validate: async (context) => {
                if (!context['PAYPAL_ACCESS_TOKEN']) {
                    throw new Error('Invalid credentials.');
                }
            },

            accountNameFromProfileInfo: (context) => {
                const name = context['PAYPAL_ACCESS_TOKEN'];
                return name.substr(0, 3) + '...' + name.substr(-3);
            }
        };
    }
};
