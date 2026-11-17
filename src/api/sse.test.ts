import { createSseParser, type SseMessage } from './sse';

const bytes = (s: string) => new TextEncoder().encode(s);

function collect() {
  const messages: SseMessage[] = [];
  return { messages, parser: createSseParser((m) => messages.push(m)) };
}

describe('SSE parser', () => {
  it('parses complete messages', () => {
    const { messages, parser } = collect();
    parser.push(bytes('event: token\ndata: {"text":"Hi"}\n\nevent: done\ndata: {"ms":5}\n\n'));
    expect(messages).toEqual([
      { event: 'token', data: '{"text":"Hi"}' },
      { event: 'done', data: '{"ms":5}' },
    ]);
  });

  it('waits for the rest of a message split across network chunks', () => {
    const { messages, parser } = collect();
    parser.push(bytes('event: tok'));
    parser.push(bytes('en\ndata: {"text":'));
    expect(messages).toEqual([]);
    parser.push(bytes('"navy"}\n'));
    expect(messages).toEqual([]);
    parser.push(bytes('\n'));
    expect(messages).toEqual([{ event: 'token', data: '{"text":"navy"}' }]);
  });

  it('survives a chunk boundary inside a multi-byte character', () => {
    const { messages, parser } = collect();
    const all = bytes('event: token\ndata: {"text":"café €60"}\n\n');
    const cut = all.indexOf(0xc3) + 1; // in the middle of "é"
    parser.push(all.slice(0, cut));
    parser.push(all.slice(cut));
    expect(messages[0].data).toBe('{"text":"café €60"}');
  });

  it('accepts CRLF line endings and joins multi-line data', () => {
    const { messages, parser } = collect();
    parser.push(bytes('event: token\r\ndata: one\r\ndata: two\r\n\r\n'));
    expect(messages).toEqual([{ event: 'token', data: 'one\ntwo' }]);
  });

  it('ignores comments and blocks without data', () => {
    const { messages, parser } = collect();
    parser.push(bytes(': keep-alive\n\nevent: ping\n\ndata: x\n\n'));
    expect(messages).toEqual([{ event: 'message', data: 'x' }]);
  });
});
