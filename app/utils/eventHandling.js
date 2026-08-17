import EventEmitter from 'node:events';
import util from 'node:util';

export default function EmitAppEvents() {
  EventEmitter.call(this);
}

util.inherits(EmitAppEvents, EventEmitter);

export const appEvents = new EmitAppEvents();
