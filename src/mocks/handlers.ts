import { restHandlers } from './rest-handlers'
import { socketHandlers } from './socket-handlers'

export const handlers = [...restHandlers, ...socketHandlers]
