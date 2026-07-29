declare module "tmi.js" {
  export interface ClientOptions {
    channels?: string[];
    identity?: {
      username: string;
      password: string;
    };
  }

  export class Client {
    constructor(options: ClientOptions);
    on(event: string, handler: (...args: unknown[]) => void): void;
    connect(): Promise<[string, number]>;
    disconnect(): Promise<[string, number]>;
  }

  const tmi: {
    Client: typeof Client;
  };

  export default tmi;
}
