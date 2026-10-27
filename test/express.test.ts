import axios from "axios";
import { CloudEvent, HTTP } from "cloudevents";
import express from "express";
import assert from "node:assert/strict";
import type { AddressInfo, Server } from "node:net";
import { beforeEach, test } from "node:test";
import { CloudEventsRouter, getServerAdapter } from "../src/index.ts";

async function serverRoundtrip(
	server: Server,
	path: string,
	event: string,
	payload: any,
	method: "POST" | "GET" = "POST"
) {
	const ce = new CloudEvent({
		type: event,
		source: "//local",
		data: payload,
	});
	const message = HTTP.binary(ce);
	const addr = server.address() as AddressInfo;

	const response = await axios({
		method: method,
		url: `http://localhost:${addr.port}${path}`,
		data: message.body,
		headers: message.headers as Record<string, string>,
		validateStatus: () => true,
	});

	return {
		status: response.status,
		statusText: response.statusText,
		data: response.data,
	};
}

let router: CloudEventsRouter<any>;
let payload: CloudEvent<unknown>;

beforeEach(() => {
	router = new CloudEventsRouter<any>();
	payload = {} as any;

	router.on("local.test.1", (event) => {
		payload = event;
	});

	router.on("local.test.2", (event) => {
		throw new Error("This should not be called");
	});
});

test("Using express", async () => {
	const app = express();
	app.use(getServerAdapter(router));
	const server = app.listen(0);

	try {
		const resp1 = await serverRoundtrip(server, "/", "local.test.1", "test1");
		assert.deepEqual(resp1, { data: "OK", status: 200, statusText: "OK" });
		assert.deepEqual(payload.data, "test1");

		const resp2 = await serverRoundtrip(server, "/", "local.test.2", "test2");
		assert.deepEqual(resp2, {
			data: "Internal Server Error",
			status: 500,
			statusText: "Internal Server Error",
		});
		assert.deepEqual(payload.data, "test1");

		const resp3 = await serverRoundtrip(server, "/", "local.test.3", "test3");
		assert.deepEqual(resp3, {
			data: "Not Implemented",
			status: 501,
			statusText: "Not Implemented",
		});
		assert.deepEqual(payload.data, "test1");
	} finally {
		server.close();
	}
});

test("Using express with route", async () => {
	router.onUnhandled((event) => {
		payload = event;
	});

	const app = express();
	app.use("/webhooks", getServerAdapter(router));
	const server = app.listen(0);

	try {
		const resp1 = await serverRoundtrip(
			server,
			"/webhooks",
			"local.test.1",
			"test1"
		);
		assert.deepEqual(resp1, { data: "OK", status: 200, statusText: "OK" });
		assert.deepEqual(payload.data, "test1");

		const resp2 = await serverRoundtrip(
			server,
			"/webhooks",
			"local.test.2",
			"test2"
		);
		assert.deepEqual(resp2, {
			data: "Internal Server Error",
			status: 500,
			statusText: "Internal Server Error",
		});

		const resp3 = await serverRoundtrip(server, "/webhooks", "local.test.3", {
			test: "test3",
		});
		assert.deepEqual(resp3, { data: "OK", status: 200, statusText: "OK" });
		assert.deepEqual(payload.data, { test: "test3" });

		const resp4 = await serverRoundtrip(server, "/", "local.test.1", "test1");
		assert.deepEqual(resp4.status, 404);
		assert.deepEqual(resp4.statusText, "Not Found");
		assert.ok(resp4.data.includes("Cannot POST"));

		const resp5 = await serverRoundtrip(
			server,
			"/",
			"local.test.1",
			"test1",
			"GET"
		);
		assert.deepEqual(resp5.status, 404);
		assert.deepEqual(resp5.statusText, "Not Found");
		assert.ok(resp5.data.includes("Cannot GET"));
	} finally {
		server.close();
	}
});

test("Using express with middleware path and body parser", async () => {
	router.onUnhandled((event) => {
		payload = event;
	});

	const app = express();

	app.use((req, res, next) => {
		let data = "";

		req.setEncoding("utf8");
		req.on("data", function (chunk) {
			data += chunk;
		});

		req.on("end", function () {
			req.body = data;
			next();
		});
	});

	app.use("/webhooks", getServerAdapter(router));
	const server = app.listen(0);

	try {
		const resp1 = await serverRoundtrip(
			server,
			"/webhooks",
			"local.test.1",
			"test1"
		);
		assert.deepEqual(resp1, { data: "OK", status: 200, statusText: "OK" });
		assert.deepEqual(payload.data, "test1");

		const resp2 = await serverRoundtrip(
			server,
			"/webhooks",
			"local.test.2",
			"test2"
		);
		assert.deepEqual(resp2, {
			data: "Internal Server Error",
			status: 500,
			statusText: "Internal Server Error",
		});

		const resp3 = await serverRoundtrip(server, "/webhooks", "local.test.3", {
			test: "test3",
		});
		assert.deepEqual(resp3, { data: "OK", status: 200, statusText: "OK" });
		assert.deepEqual(payload.data, { test: "test3" });

		const resp4 = await serverRoundtrip(server, "/", "local.test.1", "test1");
		assert.deepEqual(resp4.status, 404);
		assert.deepEqual(resp4.statusText, "Not Found");
		assert.ok(resp4.data.includes("Cannot POST"));

		const resp5 = await serverRoundtrip(
			server,
			"/",
			"local.test.1",
			"test1",
			"GET"
		);
		assert.deepEqual(resp5.status, 404);
		assert.deepEqual(resp5.statusText, "Not Found");
		assert.ok(resp5.data.includes("Cannot GET"));
	} finally {
		server.close();
	}
});
