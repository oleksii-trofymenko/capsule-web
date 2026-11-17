export interface SseMessage {
  event: string;
  data: string;
}

/**
 * Incremental Server-Sent Events parser. Network chunks can split a message
 * anywhere, even inside a multi-byte character, so text is buffered until a
 * blank line completes a message.
 */
export function createSseParser(onMessage: (message: SseMessage) => void) {
  const decoder = new TextDecoder();
  let buffer = '';

  const flush = () => {
    buffer = buffer.replaceAll('\r\n', '\n');
    let end: number;
    while ((end = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let event = 'message';
      const data: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
      }
      if (data.length > 0) onMessage({ event, data: data.join('\n') });
    }
  };

  return {
    push(chunk: Uint8Array) {
      buffer += decoder.decode(chunk, { stream: true });
      flush();
    },
    end() {
      buffer += decoder.decode();
      flush();
    },
  };
}
