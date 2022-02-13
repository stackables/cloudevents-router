import axios from 'axios'
import { CloudEvent, HTTP } from "cloudevents"
import express from 'express'
import { AddressInfo, Server } from 'net'
import { CloudEventsRouter, getMiddleware } from '../src'

async function serverRoundtrip(server: Server, path: string, event: string, payload: any, method: 'POST' | 'GET' = 'POST') {
    const ce = new CloudEvent({
        type: event,
        source: '//local',
        data: payload
    })
    const message = HTTP.binary(ce)
    const addr = server.address() as AddressInfo

    const response = await axios({
        method: method,
        url: `http://localhost:${addr.port}${path}`,
        data: message.body,
        headers: message.headers as Record<string, string>,
        validateStatus: () => true
    });

    return {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
    }
}

let router: CloudEventsRouter<any>
let payload: CloudEvent<unknown>

beforeEach(() => {
    router = new CloudEventsRouter<any>()
    payload = {} as any

    router.on('local.test.1', (event) => {
        payload = event
    })

    router.on('local.test.2', (event) => {
        throw new Error('This should not be called')
    })
});


test('Using express', async () => {

    const app = express()
    app.use(getMiddleware(router))
    const server = app.listen(0)

    try {
        const resp1 = await serverRoundtrip(server, '/', 'local.test.1', 'test1')
        expect(resp1).toEqual({ data: 'OK', status: 200, statusText: 'OK' })
        expect(payload.data).toEqual('test1')

        const resp2 = await serverRoundtrip(server, '/', 'local.test.2', 'test2')
        expect(resp2).toEqual({ data: 'Internal Server Error', status: 500, statusText: 'Internal Server Error' })
        expect(payload.data).toEqual('test1')

        const resp3 = await serverRoundtrip(server, '/', 'local.test.3', 'test3')
        expect(resp3).toEqual({ data: 'Not Implemented', status: 501, statusText: 'Not Implemented' })
        expect(payload.data).toEqual('test1')
    } finally {
        server.close()
    }

})

test('Using express with route', async () => {

    router.onUnhandled((event) => {
        payload = event
    })

    const app = express()
    app.use('/webhooks', getMiddleware(router))
    const server = app.listen(0)

    try {
        const resp1 = await serverRoundtrip(server, '/webhooks', 'local.test.1', 'test1')
        expect(resp1).toEqual({ data: 'OK', status: 200, statusText: 'OK' })
        expect(payload.data).toEqual('test1')

        const resp2 = await serverRoundtrip(server, '/webhooks', 'local.test.2', 'test2')
        expect(resp2).toEqual({ data: 'Internal Server Error', status: 500, statusText: 'Internal Server Error' })

        const resp3 = await serverRoundtrip(server, '/webhooks', 'local.test.3', { test: 'test3' })
        expect(resp3).toEqual({ data: 'OK', status: 200, statusText: 'OK' })
        expect(payload.data).toEqual({ test: 'test3' })

        const resp4 = await serverRoundtrip(server, '/', 'local.test.1', 'test1')
        expect(resp4.status).toEqual(404)
        expect(resp4.statusText).toEqual('Not Found')
        expect(resp4.data).toContain('Cannot POST')

        const resp5 = await serverRoundtrip(server, '/', 'local.test.1', 'test1', 'GET')
        expect(resp5.status).toEqual(404)
        expect(resp5.statusText).toEqual('Not Found')
        expect(resp5.data).toContain('Cannot GET')
    } finally {
        server.close()
    }

})

test('Using express with middleware path and body parser', async () => {

    router.onUnhandled((event) => {
        payload = event
    })

    const app = express()

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

    app.use(getMiddleware(router, { path: '/webhooks' }))
    const server = app.listen(0)

    try {
        const resp1 = await serverRoundtrip(server, '/webhooks', 'local.test.1', 'test1')
        expect(resp1).toEqual({ data: 'OK', status: 200, statusText: 'OK' })
        expect(payload.data).toEqual('test1')

        const resp2 = await serverRoundtrip(server, '/webhooks', 'local.test.2', 'test2')
        expect(resp2).toEqual({ data: 'Internal Server Error', status: 500, statusText: 'Internal Server Error' })

        const resp3 = await serverRoundtrip(server, '/webhooks', 'local.test.3', { test: 'test3' })
        expect(resp3).toEqual({ data: 'OK', status: 200, statusText: 'OK' })
        expect(payload.data).toEqual({ test: 'test3' })

        const resp4 = await serverRoundtrip(server, '/', 'local.test.1', 'test1')
        expect(resp4.status).toEqual(404)
        expect(resp4.statusText).toEqual('Not Found')
        expect(resp4.data).toContain('Cannot POST')

        const resp5 = await serverRoundtrip(server, '/', 'local.test.1', 'test1', 'GET')
        expect(resp5.status).toEqual(404)
        expect(resp5.statusText).toEqual('Not Found')
        expect(resp5.data).toContain('Cannot GET')
    } finally {
        server.close()
    }

})