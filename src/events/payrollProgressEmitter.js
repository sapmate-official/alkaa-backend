import { EventEmitter } from 'events'

const payrollProgressEmitter = new EventEmitter()
payrollProgressEmitter.setMaxListeners(0)

const buildEventData = (payload) => `data: ${JSON.stringify(payload)}\n\n`

export const registerProgressListener = (cycleId, res) => {
  const sendEvent = (eventPayload) => {
    if (eventPayload?.cycleId === cycleId) {
      res.write(buildEventData(eventPayload))
    }
  }

  payrollProgressEmitter.on('progress', sendEvent)
  return () => {
    payrollProgressEmitter.off('progress', sendEvent)
  }
}

export const emitProgressUpdate = (payload) => {
  payrollProgressEmitter.emit('progress', payload)
}
