// Web MIDI API type definitions
declare namespace WebMidi {
  interface MIDIAccess extends EventTarget {
    readonly inputs: MIDIInputMap;
    readonly outputs: MIDIOutputMap;
    readonly sysexEnabled: boolean;
    onstatechange: ((this: MIDIAccess, ev: MIDIConnectionEvent) => any) | null;
  }

  interface MIDIPort extends EventTarget {
    readonly id: string;
    readonly manufacturer?: string;
    readonly name?: string;
    readonly type: MIDIPortType;
    readonly version?: string;
    readonly state: MIDIPortDeviceState;
    readonly connection: MIDIPortConnectionState;
    onstatechange: ((this: MIDIPort, ev: MIDIConnectionEvent) => any) | null;
    open(): Promise<MIDIPort>;
    close(): Promise<MIDIPort>;
  }

  interface MIDIInput extends MIDIPort {
    onmidimessage: ((this: MIDIInput, ev: MIDIMessageEvent) => any) | null;
  }

  interface MIDIOutput extends MIDIPort {
    send(data: number[] | Uint8Array, timestamp?: number): void;
    clear(): void;
  }

  interface MIDIInputMap {
    readonly size: number;
    keys(): IterableIterator<string>;
    values(): IterableIterator<MIDIInput>;
    entries(): IterableIterator<[string, MIDIInput]>;
    get(key: string): MIDIInput | undefined;
    has(key: string): boolean;
    forEach(callbackfn: (value: MIDIInput, key: string, map: MIDIInputMap) => void, thisArg?: any): void;
  }

  interface MIDIOutputMap {
    readonly size: number;
    keys(): IterableIterator<string>;
    values(): IterableIterator<MIDIOutput>;
    entries(): IterableIterator<[string, MIDIOutput]>;
    get(key: string): MIDIOutput | undefined;
    has(key: string): boolean;
    forEach(callbackfn: (value: MIDIOutput, key: string, map: MIDIOutputMap) => void, thisArg?: any): void;
  }

  interface MIDIMessageEvent extends Event {
    readonly data: Uint8Array;
    readonly timeStamp: number;
  }

  interface MIDIConnectionEvent extends Event {
    readonly port: MIDIPort;
  }

  type MIDIPortType = "input" | "output";
  type MIDIPortDeviceState = "disconnected" | "connected";
  type MIDIPortConnectionState = "open" | "closed" | "pending";

  interface MIDIOptions {
    sysex?: boolean;
    software?: boolean;
  }
}

interface Navigator {
  requestMIDIAccess(options?: WebMidi.MIDIOptions): Promise<WebMidi.MIDIAccess>;
}