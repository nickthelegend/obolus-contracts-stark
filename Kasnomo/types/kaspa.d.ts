declare module 'kaspa' {
  export class PrivateKey {
    constructor(key: string);
    toAddress(networkId: NetworkId): Address;
  }

  export class Address {
    constructor(address: string | any);
    toString(): string;
  }

  export class RpcClient {
    constructor(config: { resolver: Resolver; networkId: NetworkId });
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    getBlockDagInfo(): Promise<any>;
    getUtxosByAddresses(addresses: Address[]): Promise<any[]>;
    getTransaction(txHash: string, includeOrphanPool?: boolean): Promise<any>;
  }

  export class Resolver {}

  export class UtxoProcessor {
    constructor(config: { rpcClient: RpcClient; networkId: NetworkId });
  }

  export class UtxoContext {
    constructor(config: { processor: UtxoProcessor });
    createTransaction(config: {
      entries: Array<{ address: Address; amount: bigint }>;
      changeAddress: Address;
      priorityFee: bigint;
      signingKey: PrivateKey;
    }): Promise<{ id: string }>;
  }

  export enum NetworkId {
    Mainnet = 'mainnet',
    Testnet10 = 'testnet-10',
    Testnet11 = 'testnet-11',
  }
}
