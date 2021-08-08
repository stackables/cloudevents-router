import { MessagePublishedData } from '@google/events/cloud/pubsub/v1/MessagePublishedData'
import { CloudEvent } from "cloudevents"
import { CloudEventsRouter } from '../src'

type MessagePublishedDataExtended1 = MessagePublishedData & {
    message: {
        data: {
            currentTime: Date
        }
    }
}

type MessagePublishedDataExtended2 = MessagePublishedData & {
    message: {
        data: {
            user: string
        }
    }
}

type EventsMap = {
    'google.cloud.pubsub.topic.v1.messagePublished': MessagePublishedData,
    'local.pubsub.topic.build-events-1': MessagePublishedDataExtended1
    'local.pubsub.topic.build-events-2': MessagePublishedDataExtended2
}

test('Republish PubSub example', async () => {

    let called = 0
    const router = new CloudEventsRouter<EventsMap>()

    /**
     * A more generic PubSub message handler
     * 
     * Based on your queue structure you need to define the local routing, usually this is on of:
     *    - type per topic
     *    - type based on message attributes
     *    - type based on some data in the actual payload
     */
    router.on('google.cloud.pubsub.topic.v1.messagePublished', (event) => {
        // HACK: bnVsbA== is base64 encoded JSON null
        const e = event.cloneWith({
            type: 'local.pubsub.topic.' + event.source,
            data: {
                ...event.data,
                message: {
                    data: JSON.parse(Buffer.from(event.data.message?.data || 'bnVsbA==', 'base64').toString())
                }
            }
        })
        return router.process(e)
    })

    /**
     * Local handlers still get the original event but message.data is parsed
     */
    router.on('local.pubsub.topic.build-events-1', (event) => {
        expect(new Date(event.data.message.data.currentTime)).toEqual(new Date('2021-08-08T07:45:45.190Z'))
        called++
    })

    router.on('local.pubsub.topic.build-events-2', (event) => {
        expect(event.data.message.data.user).toEqual('test user')
        called++
    })


    function publishFakeEvent(source: string, payload: any) {
        const ce = new CloudEvent({
            type: 'google.cloud.pubsub.topic.v1.messagePublished',
            source: source,
            data: {
                message: {
                    data: Buffer.from(JSON.stringify(payload)).toString('base64'),
                    messageId: 'my-message-id',
                    publishTime: '2020-08-14T20:50:04.994Z',
                },
                subscription: '//subscription',
            }
        })

        return router.process(ce)
    }

    await publishFakeEvent('build-events-1', { currentTime: new Date('2021-08-08T07:45:45.190Z') })
    await publishFakeEvent('build-events-2', { user: 'test user' })

    expect(called).toEqual(2)
})
