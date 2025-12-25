export const connections = new Set<any>();

export function broadcast(message: any, sender: any = null) {
  connections.forEach(connection => {
    if (connection !== sender && connection.readyState === connection.OPEN) {
      try {
        connection.send(message);
      } catch (error) {
        console.error('Broadcast error:', error);
        connections.delete(connection);
      }
    }
  });
}

export function sendToRoom(room: string, action: string) {
  const message = JSON.stringify({ room, action });
  connections.forEach(connection => {
    if (connection.readyState === connection.OPEN) {
      try {
        connection.send(message);
      } catch (error) {
        console.error(`Error sending to room ${room}:`, error);
        connections.delete(connection);
      }
    } else {
      connections.delete(connection);
    }
  });
}

