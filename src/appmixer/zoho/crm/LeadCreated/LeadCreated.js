'use strict';
const ZohoNotifiable = require('../../ZohoNotifiable');

class LeadCreated extends ZohoNotifiable {

    async receive(context) {

        let { ids } = context.messages.webhook.content.data;
        ids = ids.join(',');
        const moduleName = 'Leads';
        const allAtOnce = true;
        const { records } = await context.componentStaticCall(
            'appmixer.zoho.crm.ListRecords',
            'out',
            {
                messages: { in: { moduleName, allAtOnce, ids } }
            }
        );
        for (const lead of records) {
            await context.sendJson(lead, 'lead');
        }

    }
}

const events = [
    'Leads.create'
];

/**
 * Component which triggers whenever new lead is created
 */
module.exports = new LeadCreated(events);
