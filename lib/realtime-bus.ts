import { EventEmitter } from 'events';
import type { RealtimeEvent } from './realtime';

const globalForBus = global as unknown as {
  __teaderRealtimeBus?: EventEmitter;
};

if (!globalForBus.__teaderRealtimeBus) {
  const bus = new EventEmitter();
  bus.setMaxListeners(500);
  globalForBus.__teaderRealtimeBus = bus;
}

export const realtimeBus: EventEmitter = globalForBus.__teaderRealtimeBus;

export function emitRealtimeBusEvent(event: RealtimeEvent, room?: string) {
  if (realtimeBus) {
    realtimeBus.emit('realtime_event', { event, room });
    if (room) {
      realtimeBus.emit(`room:${room}`, event);
    }
    realtimeBus.emit('room:global', event);
    realtimeBus.emit('room:all', event);
  }
}
