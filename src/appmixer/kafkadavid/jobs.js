'use strict';

const connections = require('./connections');

let isConnectionSyncInProgress = false;

module.exports = async (context) => {

    const config = require('./config')(context);

    // This job synchronizes the connections between the cluster nodes.
    await context.scheduleJob('syncConnectionsJob', config.syncConnectionsJob.schedule, async () => {

        connections.debug(context, {
            type: 'syncConnectionsJob',
            status: 'running',
            isConnectionSyncInProgress
        });

        if (isConnectionSyncInProgress) {
            await context.log('info', 'Kafka connections sync job is already in progress. Skipping...');
            return;
        }

        isConnectionSyncInProgress = true;

        try {
            // All registered connections, throughout the cluster.
            const registeredConnections = await context.service.loadState(); // [{key, value}]
            // Live connections that are registered in this specific node of the cluster.
            const openConnections = connections.listConnections();

            connections.debug(context, {
                type: 'syncConnectionsJob',
                status: 'syncing',
                registeredConnections,
                openConnections
            });

            await Promise.allSettled(registeredConnections.forEach(async (conn) => {
                const connectionId = conn.key;
                const connectionParameters = conn.value;
                if (!openConnections[connectionId]) {
                    // The connection is not created on this node in the cluster. Create it but before that check
                    // if it's really needed (still registered in the cluster).
                    const stillNeeded = await context.service.stateGet(connectionId);

                    connections.debug(context, {
                        type: 'syncConnectionsJob',
                        status: 'notopen-creating',
                        conn
                    });

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
            await Promise.allSettled(Object.keys(openConnections).forEach(async (connectionId) => {
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

