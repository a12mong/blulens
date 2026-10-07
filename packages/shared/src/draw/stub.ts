/** Placeholder thrown by bl-18 functions whose packet has not landed yet. Removed when the last one lands. */
export function notImplemented(packet: string): never {
  throw new Error(`NOT_IMPLEMENTED: ${packet}`);
}
