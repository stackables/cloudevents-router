import { createServerAdapter as csa } from "@whatwg-node/server";
import { CloudEvent, HTTP } from "cloudevents";
import { CloudEventsRouter } from ".";

interface RuntimeOptions {
	onError: (error: Error) => void;
}

export function getServerAdapter(router: CloudEventsRouter<any>, ops?: RuntimeOptions) {
	return csa(async (request: Request) => {
		if (request.method !== "POST") {
			return new Response(`Method Not Allowed`, { status: 405 });
		}

		try {
			const body = await request.text();
			let receivedEvent = HTTP.toEvent({
				headers: Object.fromEntries(request.headers.entries()),
				body,
			}) as CloudEvent<unknown> | CloudEvent<unknown>[];

			if (!Array.isArray(receivedEvent)) {
				receivedEvent = [receivedEvent];
			}

			// Process the event.
			await Promise.all(receivedEvent.map((event) => router.process(event)));

			return new Response(`OK`, { status: 200, statusText: "OK" });
		} catch (error: any) {
			if (error.message === "Not Implemented") {
				return new Response(`Not Implemented`, { status: 501, statusText: "Not Implemented" });
			}
			ops?.onError?.(error);
			return new Response(`Internal Server Error`, { status: 500, statusText:'Internal Server Error' });
		}
	});
}
