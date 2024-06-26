import { CloudEvent, HTTP } from "cloudevents";
import type { IncomingMessage, ServerResponse } from "http";
import { URL } from "url";
import { CloudEventsRouter } from "./router";

interface MiddlewareOptions {
	path?: string;
}

async function readBody(req: IncomingMessage) {
	// express and friends
	const untyped = req as any;
	if (untyped.body) {
		return Promise.resolve(untyped.body);
	}

	// read data from request body
	return new Promise((resolve, reject) => {
		let data = "";

		req.setEncoding("utf8");

		/* istanbul ignore next */
		req.on("error", (error: Error) => reject(error));
		req.on("data", (chunk: string) => (data += chunk));
		req.on("end", () => {
			resolve(data);
		});
	});
}

/**
 * @deprecated getMiddleware() is deprecated and will be removed in the next major version. Use createServerAdapter() instead.
 */
export function getMiddleware(
	router: CloudEventsRouter<any>,
	opts: MiddlewareOptions = {}
) {
	console.error(
		"[cloudevents-router] getMiddleware() is deprecated and will be removed in the next major version. Use createServerAdapter() instead."
	);

	return async (req: IncomingMessage, res: ServerResponse, next?: Function) => {
		// Cloud Events travel via POST methods.
		if (req.method !== "POST") {
			if (next) {
				return next();
			} else {
				res.writeHead(405, "Method Not Allowed");
				res.end("Method Not Allowed");
				return;
			}
		}

		// If path is set then it will be respected.
		const { pathname } = new URL(req.url as string, "http://localhost");

		if (opts.path && pathname !== opts.path) {
			if (next) {
				return next();
			} else {
				res.writeHead(404, "Not Found");
				res.end("Not Found");
				return;
			}
		}

		// Process message
		try {
			// Read message body.
			const body = await readBody(req);
			let receivedEvent = HTTP.toEvent({ headers: req.headers, body }) as
				| CloudEvent<unknown>
				| CloudEvent<unknown>[];

			if (!Array.isArray(receivedEvent)) {
				receivedEvent = [receivedEvent];
			}

			// Process the event.
			await Promise.all(receivedEvent.map((event) => router.process(event)));
			res.writeHead(200, "OK");
			return res.end("OK");
		} catch (error: any) {
			if (error.message === "Not Implemented") {
				res.writeHead(501, "Not Implemented");
				return res.end("Not Implemented");
			}

			res.writeHead(500, "Internal Server Error");
			return res.end("Internal Server Error");
		}
	};
}
