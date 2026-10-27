import type {
	Message,
	MessagePublishedData,
} from "@google/events/cloud/pubsub/v1/MessagePublishedData";
import { CloudEvent } from "cloudevents";
import assert from "node:assert/strict";
import { test } from "node:test";
import { CloudEventsRouter } from "../src/index.ts";

// This is a bit hackish
//      as the resulting type for message will be intersection with string
//      but its simple to demonstrate the idea
type MessagePublishedDataExtended1 = MessagePublishedData & {
	message: {
		data: {
			currentTime: Date;
		};
	};
};

// A more complete example would be something like this
//      but im sure there is some more generic typescript mgic that we can use
//      if anyone can figure out how to reaplce string with object in nested types
//      pease update this example :)
type MessagePublishedDataWithoutMessage = Omit<MessagePublishedData, "message">;
type MessageWithoutData = Omit<Message, "data">;
type MessagePublishedDataExtended2 = MessagePublishedDataWithoutMessage & {
	message: MessageWithoutData & {
		data: {
			user: string;
		};
	};
};

type EventsMap = {
	"google.cloud.pubsub.topic.v1.messagePublished": MessagePublishedData;
	"local.pubsub.topic.build-events-1": MessagePublishedDataExtended1;
	"local.pubsub.topic.build-events-2": MessagePublishedDataExtended2;
};

test("Republish PubSub example", async () => {
	let called = 0;
	const router = new CloudEventsRouter<EventsMap>();

	/**
	 * A more generic PubSub message handler
	 *
	 * Based on your queue structure you need to define the local routing, usually this is on of:
	 *    - type per topic
	 *    - type based on message attributes
	 *    - type based on some data in the actual payload
	 */
	router.on("google.cloud.pubsub.topic.v1.messagePublished", (event) => {
		// HACK: bnVsbA== is base64 encoded JSON null
		const e = event.cloneWith({
			type: "local.pubsub.topic." + event.source,
			data: {
				...event.data,
				message: {
					...event.data?.message,
					data: JSON.parse(
						Buffer.from(
							event.data?.message?.data || "bnVsbA==",
							"base64"
						).toString()
					),
				},
			},
		});
		return router.process(e);
	});

	/**
	 * Local handlers still get the original event but message.data is parsed
	 */
	router.on("local.pubsub.topic.build-events-1", (event) => {
		assert(event.data);
		assert.equal(event.data.subscription, "subscription");
		assert.equal(event.data.message.messageId, "my-message-id");
		assert.deepEqual(
			new Date(event.data.message.data.currentTime),
			new Date("2021-08-08T07:45:45.190Z")
		);
		called++;
	});

	router.on("local.pubsub.topic.build-events-2", (event) => {
		assert(event.data);
		assert.equal(event.data.subscription, "subscription");
		assert.equal(event.data.message.messageId, "my-message-id");
		assert.equal(event.data.message.data.user, "test user");
		called++;
	});

	function publishFakeEvent(source: string, payload: any) {
		const ce = new CloudEvent({
			type: "google.cloud.pubsub.topic.v1.messagePublished",
			source: source,
			data: {
				message: {
					data: Buffer.from(JSON.stringify(payload)).toString("base64"),
					messageId: "my-message-id",
					publishTime: "2020-08-14T20:50:04.994Z",
				},
				subscription: "subscription",
			},
		});

		return router.process(ce);
	}

	await publishFakeEvent("build-events-1", {
		currentTime: new Date("2021-08-08T07:45:45.190Z"),
	});
	await publishFakeEvent("build-events-2", { user: "test user" });

	assert.equal(called, 2);
});
