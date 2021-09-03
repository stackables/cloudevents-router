# Cloud Events Router

The simplest typed  [cloudevents](https://github.com/cloudevents/sdk-javascript) routing library for nodejs. Library has a single dependency to cloudevents npm library.

**Library does not provide any input validation, just routing and typecasting!**

## Install

```bash
npm install cloudevents-router
```

## Define types

```typescript
// Hand-code or use external events map
// [type: string]: T

import { MessagePublishedData } from '@google/events/cloud/pubsub/v1/MessagePublishedData';
import { BuildEventData } from '@google/events/cloud/cloudbuild/v1/BuildEventData';

type EventMap = {
    'google.cloud.pubsub.topic.v1.messagePublished': MessagePublishedData
    'google.cloud.cloudbuild.build.v1.statusChanged': BuildEventData,
    'my.custom.event.v1': {
        username: string
    }
}

/*
Google Cloud events are described in cloudevents-router-gcp package

  npm install cloudevents-router-gcp
  import type { GoogleEvents } from 'cloudevents-router-gcp'

*/
```

Other known compatible packages include:

 - [cloudevents-router-gcp](https://github.com/stackables/cloudevents-router-gcp) - Google Cloud events

## Consume events

```typescript
import { CloudEventsRouter } from 'cloudevents-router'

const router = new CloudEventsRouter<EventMap>()

router.on('google.cloud.pubsub.topic.v1.messagePublished', async (event) => {
    console.log('PubSub ordering key', event.data.message?.orderingKey)
})

router.on('google.cloud.cloudbuild.build.v1.statusChanged', async (event) => {
    console.log('Build images array', event.artifacts?.images)

    if (!event.artifacts) {
        // Error in handler will return 500 error code to the producer
        throw new Error('Artifacts not present')
    }
})

router.onUnhandled((event) => {
    // This counts as normal consumer for any undefined event
    // ... so server will always return 200 status code
    // ... if you don't want to acknowledge events you need to throw from this handler
    console.log('Unknown event', event)
})
```

[See example for more useful PubSub handling](https://github.com/stackables/cloudevents-router/blob/main/test/republish.test.ts)

## Connect to http server

Using the middleware

```typescript
import { getMiddleware } from "cloudevents-router"
import http from "http"

const middleware = getMiddleware(router, { path: '/' })
const server = http.createServer(middleware)

server.listen(5000);
```

For express you can use the middleware without path configuration

```typescript
import { getMiddleware } from "cloudevents-router"
import express from "express"

const app = express()

app.post('/webhooks', getMiddleware(router))

app.listen(5000)
```

Return codes from middleware:

- 200 - OK
- 405 - Method Not Allowed (not POST request, and not express)
- 404 - Not Found (path defined and not matching, and not express)
- 501 - Not Implemented (event not listened, and no onUnhandled listener)
- 500 - Internal Server Error (error during processing)

## Manual server configuration

If you are not using a webserver or your framework does not use middleware then you can always manually connect the CloudEventsRouter using the `process()` method. 

See more integration examples at https://github.com/cloudevents/sdk-javascript

```typescript
import { HTTP } from "cloudevents"

const receivedEvent = HTTP.toEvent({ ... });
await router.process(receivedEvent)
```

## Thats it ...

... happy coding :)
