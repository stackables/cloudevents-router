[![npm](https://img.shields.io/npm/v/cloudevents-router?label=cloudevents-router&logo=npm)](https://www.npmjs.com/package/cloudevents-router)
[![codecov](https://codecov.io/gh/stackables/cloudevents-router/branch/main/graph/badge.svg?token=ynUW2JLulr)](https://codecov.io/gh/stackables/cloudevents-router)

# Cloud Events Router

The simplest typed [cloudevents](https://github.com/cloudevents/sdk-javascript) routing library for nodejs. Library has a single dependency to cloudevents npm library.

**Library does not provide any input validation, just routing and typecasting!**

## Install

```bash
npm install cloudevents-router
```

## Define types

```typescript
// Hand-code or use external events map
// [type: string]: T

import { MessagePublishedData } from "@google/events/cloud/pubsub/v1/MessagePublishedData";
import { BuildEventData } from "@google/events/cloud/cloudbuild/v1/BuildEventData";

type EventMap = {
	"google.cloud.pubsub.topic.v1.messagePublished": MessagePublishedData;
	"google.cloud.cloudbuild.build.v1.statusChanged": BuildEventData;
	"my.custom.event.v1": {
		username: string;
	};
};

/*
Google Cloud events are described in cloudevents-router-gcp package

  npm install cloudevents-router-gcp
  import type { GoogleEvents } from 'cloudevents-router-gcp'

*/
```

Other known compatible packages include:

- [cloudevents-router-gcp](https://github.com/stackables/cloudevents-router-gcp) - Google Cloud events
- [codegen-stackables-webhooks](https://github.com/stackables/codegen-stackables-webhooks) - Stackables Webhooks

## Consume events

```typescript
import { CloudEventsRouter } from "cloudevents-router";

const router = new CloudEventsRouter<EventMap>();

router.on("google.cloud.pubsub.topic.v1.messagePublished", async (event) => {
	console.log("PubSub ordering key", event.data.message?.orderingKey);
});

router.on("google.cloud.cloudbuild.build.v1.statusChanged", async (event) => {
	console.log("Build images array", event.artifacts?.images);

	if (!event.artifacts) {
		// Error in handler will return 500 error code to the producer
		throw new Error("Artifacts not present");
	}
});

router.onUnhandled((event) => {
	// This counts as normal consumer for any undefined event
	// ... so server will always return 200 status code
	// ... if you don't want to acknowledge events you need to throw from this handler
	console.log("Unknown event", event);
});
```

[See example for more useful PubSub handling](https://github.com/stackables/cloudevents-router/blob/main/test/republish.test.ts)

## Connect to http server

Using the [@whatwg-node/server](https://www.npmjs.com/package/@whatwg-node/server) server adapter

```typescript
import { getServerAdapter } from "cloudevents-router";
import http from "http";

const middleware = getServerAdapter(router);
const server = http.createServer(middleware);

server.listen(5000);
```

If you are using express and want have a specific path for cloudevents processing.

```typescript
import { getServerAdapter } from "cloudevents-router";
import express from "express";

const app = express();

app.post("/webhooks", getServerAdapter(router));

app.listen(5000);
```

See [@whatwg-node/server](https://www.npmjs.com/package/@whatwg-node/server) for many more integration options.

Return codes from server adapter:

- 200 - OK
- 405 - Method Not Allowed
- 501 - Not Implemented (event not listened, and no onUnhandled listener)
- 500 - Internal Server Error (error during processing)

## Manual server configuration

If you are not using a webserver at all or your framework is not supported by ``then you can always manually connect the CloudEventsRouter using the`process()` method.

See more integration examples at https://github.com/cloudevents/sdk-javascript

```typescript
import { HTTP } from "cloudevents"

const receivedEvent = HTTP.toEvent({ ... });
await router.process(receivedEvent)
```

## Thats it ...

... happy coding :)
