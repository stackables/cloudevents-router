import axios from 'axios'
import { CloudEvent, HTTP } from "cloudevents"
import http, { Server } from 'http'
import { AddressInfo } from 'net'
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
        headers: message.headers,
        validateStatus: () => true
    });

    return {
        status: response.status,
        statusText: response.statusText,
        data: response.data,
    }
}

let router: CloudEventsRouter<any>
let payload: CloudEvent

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


test('Using build in http server', async () => {

    const server = http.createServer(getMiddleware(router))
    server.listen(0)

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

test('Error on multiple definitions', async () => {

    expect(() => {
        router.on('local.test.1', (event) => { })
    }).toThrow()

})

test('Using build in http server with unhandled handler', async () => {

    router.onUnhandled((event) => {
        payload = event
    })

    const server = http.createServer(getMiddleware(router, { path: '/webhooks' }))
    server.listen(0)

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
        expect(resp4).toEqual({ data: 'Not Found', status: 404, statusText: 'Not Found' })

        const resp5 = await serverRoundtrip(server, '/', 'local.test.1', 'test1', 'GET')
        expect(resp5).toEqual({ data: 'Method Not Allowed', status: 405, statusText: 'Method Not Allowed' })
    } finally {
        server.close()
    }

})