import { MessagePublishedData } from '@google/events/cloud/pubsub/v1/MessagePublishedData'
import { CloudEvent } from "cloudevents"
import { CloudEventsRouter } from '../src'

type MessagePublishedDataExtended = MessagePublishedData & {
    message: {
        data: {
            currentTime: Date
        }
    }
}

test('Republish PubSub example', async () => {

    type EventsMap = {
        'google.cloud.pubsub.topic.v1.messagePublished': MessagePublishedData,
        'local.pubsub.topic.build-events': MessagePublishedDataExtended
    }

    let called = false
    const router = new CloudEventsRouter<EventsMap>()

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

    router.on('local.pubsub.topic.build-events', (event) => {
        expect(new Date(event.data.message.data.currentTime)).toEqual(new Date('2021-08-08T07:45:45.190Z'))
        called = true
    })

    // The real payload in the message
    const payload = {
        currentTime: new Date('2021-08-08T07:45:45.190Z')
    }

    // Event set to webhook
    const ce = new CloudEvent({
        type: 'google.cloud.pubsub.topic.v1.messagePublished',
        source: 'build-events',
        data: {
            message: {
                data: Buffer.from(JSON.stringify(payload)).toString('base64'),
                messageId: 'my-message-id',
                publishTime: '2020-08-14T20:50:04.994Z',
            },
            subscription: '//subscription',
        }
    })

    await router.process(ce)
    expect(called).toBeTruthy()
})
