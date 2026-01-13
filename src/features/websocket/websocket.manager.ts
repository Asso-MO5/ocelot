export async function sendToRoom(room: string, action: string) {
  const body = JSON.stringify({ room, action });
  try {
    await fetch(`${process.env.MILENA}/send`, {
      method: 'POST',
      body,
      headers: {
        'Content-Type': 'application/json',
        "x-provider-id": 'ocelot',
      },
    });
  } catch (error) {
    console.error('Error sending to room:', error);
  }
}

