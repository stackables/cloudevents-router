import axios from "axios";
import { CloudEvent, HTTP } from "cloudevents";
import http, { Server } from "http";
import { AddressInfo } from "net";
import { CloudEventsRouter, getServerAdapter } from "../src";

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

test("Using build in http server", async () => {
	const server = http.createServer(getServerAdapter(router));
	server.listen(0);

	try {
		const resp1 = await serverRoundtrip(server, "/", "local.test.1", "test1");
		expect(resp1).toEqual({ data: "OK", status: 200, statusText: "OK" });
		expect(payload.data).toEqual("test1");

		const resp2 = await serverRoundtrip(server, "/", "local.test.2", "test2");
		expect(resp2).toEqual({
			data: "Internal Server Error",
			status: 500,
			statusText: "Internal Server Error",
		});
		expect(payload.data).toEqual("test1");

		const resp3 = await serverRoundtrip(server, "/", "local.test.3", "test3");
		expect(resp3).toEqual({
			data: "Not Implemented",
			status: 501,
			statusText: "Not Implemented",
		});
		expect(payload.data).toEqual("test1");
	} finally {
		server.close();
	}
});

test("Error on multiple definitions", async () => {
	expect(() => {
		router.on("local.test.1", (event) => {});
	}).toThrow();
});
