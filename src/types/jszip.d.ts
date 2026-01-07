declare module 'jszip' {
  interface JSZipObject {
    name: string;
    dir: boolean;
    date: Date;
    comment: string;
    async(type: 'string'): Promise<string>;
    async(type: 'arraybuffer'): Promise<ArrayBuffer>;
    async(type: 'uint8array'): Promise<Uint8Array>;
    async(type: 'blob'): Promise<Blob>;
  }

  interface JSZip {
    file(name: string, data: Blob | ArrayBuffer | Uint8Array | string): JSZip;
    generateAsync(options: { type: 'blob' }): Promise<Blob>;
  }

  const JSZip: {
    new (): JSZip;
  };

  export default JSZip;
}
