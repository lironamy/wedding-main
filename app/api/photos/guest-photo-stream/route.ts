import { NextRequest, NextResponse } from 'next/server';

// Map to store active SSE connections (WritableStreamDefaultWriter) by guestId
export const guestSseWriters = new Map<string, WritableStreamDefaultWriter>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const guestId = searchParams.get('guestId');

  if (!guestId) {
    return NextResponse.json({ error: 'guestId is required' }, { status: 400 });
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  guestSseWriters.set(guestId, writer);

  const response = new NextResponse(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*', // Adjust as needed for security
    },
  });

  // Send an initial connected message or keep-alive comment
  writer.write(`data: ${JSON.stringify({ type: 'connected', guestId })}\n\n`);
  // Periodically send a keep-alive comment to prevent connection closure
  const keepAliveInterval = setInterval(() => {
    writer.write(': keep-alive\n\n');
  }, 30000); // Send every 30 seconds


  // Handle client disconnection
  request.signal.addEventListener('abort', () => {
    console.log(`SSE connection closed for guestId: ${guestId}`);
    writer.close(); // Close the writer
    guestSseWriters.delete(guestId);
    clearInterval(keepAliveInterval);
  });

  return response;
}
