import { CloudEvent } from 'cloudevents';

export type HandlerFunction<T> = (event: CloudEvent<T>) => Promise<void> | void;

export class CloudEventsRouter<D extends Record<string, any>> {
    #routes: Record<string, HandlerFunction<any>> = {}
    #unhandled: HandlerFunction<any> = () => {
        throw new Error('Not Implemented')
    };

    on<K extends keyof D>(event: K, handler: HandlerFunction<D[K]>) {
        const eventType = String(event)

        if (this.#routes[eventType]) {
            throw new Error(`Duplicate handler for event ${eventType}`)
        }

        this.#routes[eventType] = handler
        return this
    }

    onUnhandled(handler: HandlerFunction<any>) {
        this.#unhandled = handler
    }

    async process<T = unknown>(event: CloudEvent<T>) {
        let handler = this.#routes[event.type] || this.#unhandled

        return Promise.resolve(handler(event))
    }
}
