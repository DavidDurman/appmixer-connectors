/*
'use strict';
const connections = require('./connections');
const pLimit = require('p-limit');

let isConnectionSyncInProgress = false;

module.exports = async (context) => {

    const config = require('./config')(context);
    const limit = pLimit(parseInt(context.config.syncConnectionsJobConcurrency, 10) || 30);

    await context.scheduleJob('syncConnectionsJob', config.syncConnectionsJob.schedule, async () => {

        if (isConnectionSyncInProgress) {
            await context.log('info', 'Connection sync job is already in progress. Skipping...');
            return;
        }

        isConnectionSyncInProgress = true;

        try {
            const registeredComponents = await context.service.loadState();
            const registeredComponentsKeys = new Set(registeredComponents.map(item => item.key));
            const existingConnections = connections.listConnections();

            const connectComponent = async (component) => {

                const connectionId = `${component.value.flowId}:${component.value.componentId}`;
                if (!existingConnections.includes(connectionId)) {
                    const latestState = await context.service.stateGet(connectionId);
                    // Check if the component is still registered
                    if (latestState) {
                        await context.log('info', `Connecting component: ${connectionId}`);
                        await connections.addConnection(context, component.value, component.value.mode);
                    }
                }
            };

            await Promise.allSettled(registeredComponents.map(component => limit(() => connectComponent(component))));

            await Promise.allSettled(existingConnections.map(connectionId => limit(async () => {
                if (!registeredComponentsKeys.has(connectionId)) {
                    const latestState = await context.service.stateGet(connectionId);
                    if (!latestState) {
                        await context.log('info', `Disconnecting component: ${connectionId}`);
                        const [flowId, componentId] = connectionId.split(':');
                        await connections.removeConnection({ flowId, componentId });
                    }
                }
            })));

        } catch (error) {
            await context.log('error', `Error occurred during connection sync job: ${error.message}`);
        } finally {
            isConnectionSyncInProgress = false;
        }
    });
};
*/

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

'use strict';
const connections = require('./connections');

let isConnectionSyncInProgress = false;

module.exports = async (context) => {

    const config = require('./config')(context);

    // This job synchronizes the connections between the cluster nodes.
    await context.scheduleJob('syncConnectionsJob', config.syncConnectionsJob.schedule, async () => {

        if (isConnectionSyncInProgress) {
            await context.log('info', 'Kafka connections sync job is already in progress. Skipping...');
            return;
        }

        isConnectionSyncInProgress = true;

        try {
            // All registered connections, throughout the cluster.
            const registeredConnections = await context.service.loadState(); // [{key, value}]
            // Live connections that are registered in this specific node of the cluster.
            const existingConnections = connections.listConnections();

            await Promise.allSettled(registeredConnections.forEach(async (conn) => {
                const connectionId = conn.key;
                const connectionParameters = conn.value;
                if (!existingConnections[connectionId]) {
                    // The connection is not created on this node in the cluster. Create it but before that check
                    // if it's really needed (still registered in the cluster).
                    const stillNeeded = await context.service.stateGet(connectionId);
                    if (stillNeeded) {
                        await context.log('info', `Connecting component: ${connectionId}`);
                        if (connectionId.startsWith('consumer:')) {
                            await connections.addConsumer(
                                context,
                                connectionParameters.topics,
                                connectionParameters.flowId,
                                connectionParameters.componentId,
                                connectionParameters.groupId,
                                connectionParameters.fromBeginning,
                                connectionParameters.auth
                            );
                        } else {
                            await connections.addProducer(
                                context,
                                connectionParameters.flowId,
                                connectionParameters.componentId,
                                connectionParameters.auth
                            );
                        }
                    }
                }
            }));

            // If the connection is live on this node but it is not desired anymore (not registered in the cluster), remove it.
            await Promise.allSettled(existingConnections.keys().forEach(async (connectionId) => {
                const conn = await context.service.stateGet(connectionId);
                if (!conn) {
                    if (connectionId.startsWith('consumer')) {
                        await connections.removeConsumer(context, conn.flowId, conn.componentId);
                    } else {
                        await connections.removeProducer(context, conn.flowId, conn.componentId);
                    }
                }
            }));

        } catch (error) {
            await context.log('error', `Error occurred during connection sync job: ${error.message}`);
        } finally {
            isConnectionSyncInProgress = false;
        }
    });
};

