# 21 — Performance Targets, Latency & Optimization

## 1. Performance Mission & Critical Invariant

An AI assistant that makes the code editor lag or freeze will be uninstalled immediately. 
> **The 60-FPS UI Invariant**: Visual Studio Code's editor typing latency, cursor movement, scrolling, and tab switching must maintain an unbroken 60 frames per second at all times, regardless of background indexing, token streaming, or terminal execution.

---

## 2. Hard Performance Target Budgets

| Operation | Latency SLA (P50) | Latency SLA (P95) | Resource Budget | Failure Threshold |
|---|---|---|---|---|
| **Extension Cold Startup** | $\le 120$ ms | $\le 250$ ms | CPU: <15% for 1s | > 500 ms activates warning |
| **Workspace Indexing (100k LOC)** | $\le 300$ ms | $\le 800$ ms | RAM: < 50 MB RSS | > 2,000 ms throttled |
| **Ripgrep Code Search** | $\le 25$ ms | $\le 60$ ms | CPU: 1 core short burst | > 200 ms |
| **Model First-Token Latency (TTFT)** | $\le 750$ ms | $\le 1,400$ ms | Network bounded | > 3,000 ms triggers retry alert |
| **Stream Chunk Render Rate** | 60 FPS (16.6ms) | 30 FPS | UI Thread: < 2ms / frame | Dropped frames trigger batching |
| **Tool Execution Dispatch** | $\le 10$ ms | $\le 35$ ms | In-process microtask | > 100 ms |
| **Myers Diff Calculation (1,000 lines)** | $\le 15$ ms | $\le 40$ ms | In-memory CPU | > 100 ms shifts to worker |
| **Idle Memory Footprint** | $\le 85$ MB | $\le 140$ MB | Node.js Heap | > 250 MB triggers GC sweep |

---

## 3. UI Thread Protection & Concurrency Architecture

### 3.1 Worker Thread & Child Process Isolation
All compute-heavy operations are strictly banned from the Extension Host's main event loop:
1. **Ripgrep Search**: Spawns a dedicated asynchronous child process using native OS streams (`stdout.on('data')`).
2. **Myers Diffing for Large Files (>5,000 lines)**: Offloaded to a Node `worker_threads` pool.
3. **Terminal Process Management**: Managed via asynchronous `node-pty` instances; terminal chunks stream over buffered pipes.

### 3.2 Token Streaming Throttling (Micro-Batching)
Modern LLMs (e.g., Gemini 2.0 Flash, Claude 3.5 Sonnet) can emit over 80 tokens per second. Updating the React Webview DOM on every single incoming token chunk overwhelms the IPC channel (`postMessage`) and degrades renderer performance.
ForgeAI applies **Adaptive Micro-Batching**:
```typescript
export class StreamRendererThrottle {
  private buffer: string = '';
  private rafScheduled: boolean = false;

  constructor(private readonly emitFlush: (text: string) => void) {}

  pushToken(token: string): void {
    this.buffer += token;
    if (!this.rafScheduled) {
      this.rafScheduled = true;
      // Flush at display refresh rate (~16.6ms for 60Hz displays)
      setTimeout(() => {
        this.emitFlush(this.buffer);
        this.buffer = '';
        this.rafScheduled = false;
      }, 16);
    }
  }
}
```

---

## 4. Memory Management & Cache Eviction

1. **Sliding AST Cache**: AST symbol nodes are cached in a Least-Recently-Used (LRU) cache with a maximum capacity of 500 files or 25MB.
2. **Log File Rotation**: `.vscode/forgeai/audit.log` is capped at 10MB; rotated to `audit.1.log` with max 2 archival generations.
3. **Shadow Buffer Cleanup**: When a task completes or cancels, temporary in-memory file buffers are unreferenced immediately to allow V8 garbage collection.
