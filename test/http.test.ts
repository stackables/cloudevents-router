import axios from 'axios'
import { CloudEvent, HTTP } from "cloudevents"
import http, { Server } from 'http'
import { AddressInfo } from 'net'
import { CloudEventsRouter, getMiddleware } from '../src'

async function serverRoundtrip(server: Server, path: string, event: string, payload: any) {
    const ce = new CloudEvent({
        type: event,
        source: '//local',
        data: payload
    })
    const message = HTTP.binary(ce)
    const addr = server.address() as AddressInfo

    const response = await axios({
        method: 'POST',
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

test('Using build in http server', async () => {

    const router = new CloudEventsRouter<any>()
    let payload: CloudEvent = {} as any

    router.on('local.test.1', (event) => {
        payload = event
    })

    router.on('local.test.2', (event) => {
        throw new Error('This should not be called')
    })

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

test('Using build in http server with unhandled handler', async () => {

    const router = new CloudEventsRouter<any>()
    let payload: CloudEvent = {} as any

    router.on('local.test.1', (event) => {
        payload = event
    })

    expect(() => {
        router.on('local.test.1', (event) => {
            payload = event
        })
    }).toThrow()

    router.on('local.test.2', (event) => {
        throw new Error('This should not be called')
    })

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
        expect(payload.data).toEqual('test1')

        const resp3 = await serverRoundtrip(server, '/webhooks', 'local.test.3', 'test3')
        expect(resp3).toEqual({ data: 'OK', status: 200, statusText: 'OK' })
        expect(payload.data).toEqual('test3')

        const resp4 = await serverRoundtrip(server, '/', 'local.test.1', 'test1')
        expect(resp4).toEqual({ data: 'Not Found', status: 404, statusText: 'Not Found' })
        expect(payload.data).toEqual('test3')

        const addr = server.address() as AddressInfo
        const resp5 = await axios({
            method: 'GET',
            url: `http://localhost:${addr.port}/`,
            validateStatus: () => true
        });
        expect(resp5.status).toEqual(405)
    } finally {
        server.close()
    }

})