declare module 'heic-decode' {
  interface DecodeOptions {
    buffer: ArrayBuffer;
  }

  interface DecodeResult {
    width: number;
    height: number;
    data: Uint8Array;
  }

  function decode(options: DecodeOptions): Promise<DecodeResult>;
  export default decode;
}
