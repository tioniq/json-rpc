# Json-RPC 2.0 Implementation

![npm version](https://img.shields.io/npm/v/@tioniq/json-rpc)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@tioniq/json-rpc)](https://bundlephobia.com/package/@tioniq/json-rpc)
![tree-shakeable](https://badgen.net/bundlephobia/tree-shaking/@tioniq/json-rpc)
![license](https://img.shields.io/npm/l/@tioniq/json-rpc)

Easy to use and lightweight JSON-RPC 2.0 implementation for Node.js and browser. The same implementation can be used on
both sides.

## Installation

```bash
npm install @tioniq/json-rpc
```

## Usage

### Server example

```typescript
import { Peer } from '@tioniq/json-rpc';
import { ChannelMinimal } from './channel';
import { EventDispatcher } from '@tioniq/eventiq';

const socket = /* Your socket implementation */ null;

const messageDispatcher = new EventDispatcher<string>();

socket.on('message', (message: string) => {
  messageDispatcher.dispatch(message);
});

const channel: ChannelMinimal<string> = {
  onMessage: messageDispatcher,

  send(message: string) {
    return socket.send(message);
  }
};
const rpcPeer = new Peer(channel);

// Register a method
rpcPeer.setRequestHandler('sum', (a: number, b: number) => a + b);

```

### Client example

```typescript
import { Peer } from '@tioniq/json-rpc';
import { ChannelMinimal } from './channel';
import { EventDispatcher } from '@tioniq/eventiq';

const socket = /* Your socket implementation */ null;

const messageDispatcher = new EventDispatcher<string>();

socket.on('message', (message: string) => {
  messageDispatcher.dispatch(message);
});

const channel: ChannelMinimal<string> = {
  onMessage: messageDispatcher,

  send(message: string) {
    return socket.send(message);
  }
};
const rpcPeer = new Peer(channel);

// Send request
const result = await rpcPeer.sendRequest('sum', [1, 2]);
console.log(result); // 3

```
