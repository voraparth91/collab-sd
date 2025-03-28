# Collaborative WebSocket Server

This is a standalone WebSocket server for collaborative editing, using [Yjs](https://yjs.dev/) and [y-websocket](https://github.com/yjs/y-websocket).

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

The server will be running at `ws://localhost:1234`.

## Configuration

You can configure the server using environment variables:

- `HOST`: The host to bind to (default: `0.0.0.0`)
- `PORT`: The port to listen on (default: `1234`)

Example:
```bash
PORT=4000 npm start
```

## Testing

You can test the server by opening the HTTP endpoint in your browser:
```
http://localhost:1234
```

This should display a message indicating that the server is running. 