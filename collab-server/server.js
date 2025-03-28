#!/usr/bin/env node

/**
 * Collaborative WebSocket server for sequence diagram editor
 * Based on y-websocket
 */

const WebSocket = require('ws')
const http = require('http')
const { setupWSConnection } = require('y-websocket/bin/utils')

const host = process.env.HOST || '0.0.0.0'
const port = 1234

// Create a simple HTTP server
const server = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('Collaborative sequence diagram WebSocket server is running\n')
})

// Create a WebSocket server
const wss = new WebSocket.Server({ server })

wss.on('connection', (conn, req) => {
  const ip = req.socket.remoteAddress
  const url = new URL(req.url, 'http://localhost')
  const roomName = url.searchParams.get('room') || 'default-room'
  
  // Setup Yjs WebSocket connection
  setupWSConnection(conn, req, { 
    gc: true // Enable garbage collection
  })
  
  console.log(`New client connected from ${ip} to room "${roomName}"`)
})

// Handle errors
wss.on('error', (error) => {
  console.error(`WebSocket server error: ${error.message}`)
})

// Start the server
server.listen(port, host, () => {
  console.log(`Collaborative WebSocket server running at http://${host}:${port}`)
  console.log(`WebSocket server URL: ws://${host}:${port}`)
  console.log('Press Ctrl+C to stop the server')
}) 