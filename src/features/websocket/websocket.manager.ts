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

