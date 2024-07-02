'use strict';

module.exports = {

    start(context) {

        const { flowId, componentId, auth } = context;
        return context.callAppmixer({
            endPoint: '/plugins/appmixer/kafka/producers',
            method: 'POST',
            body: {
                flowId,
                componentId,
                auth
            }
        });
    },

    async stop(context) {

        return context.callAppmixer({
            endPoint: `/plugins/appmixer/kafka/producers/${context.flowId}/${context.componentId}`,
            method: 'DELETE'
        });
    },

    async receive(context) {

        const {
            topic,
            key,
            value,
            acks,
            timeout,
            partition,
            timestamp,
            headers
        } = context.messages.in.content;

        const message = {
            value,
            partition,
            timestamp: timestamp && new Date(timestamp).getTime(),
            headers: headers && JSON.parse(headers)
        };

        if (key) {
            message.key = key;
        }

        const payload = {
            topic,
            messages: [message],
            acks,
            timeout
        };

        await context.callAppmixer({

            endPoint: `/plugins/appmixer/kafka/producers/${context.flowId}/${context.componentId}/send`,
            method: 'POST',
            body: payload
        });

        return context.sendJson(context.messages.in.content, 'out');
    }
};
