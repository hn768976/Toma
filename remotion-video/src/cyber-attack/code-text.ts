import { stream } from "./random";

// The background is a wall of text that has to read, at a glance, as a
// crashed process: a stack trace over the top of application source. Lines
// are assembled from templates so the columns line up the way a real
// symbolicated backtrace does, and so no two layers repeat each other.

const FRAMEWORKS = [
  "CoreFoundation",
  "Foundation",
  "UIKit",
  "libsystem_kernel.dylib",
  "libsystem_pthread.dylib",
  "libdispatch.dylib",
  "GraphicsServices",
  "libobjc.A.dylib",
  "CFNetwork",
  "Security",
] as const;

const SYMBOLS = [
  "__CFRunLoopServiceMachPort + 0xc4",
  "__CFRunLoopRun + 0x620",
  "CFRunLoopRunSpecific + 0x24",
  "-[NSRunLoop(NSRunLoop) runUntilDate:] + 0x130",
  "-[UIEventFetcher threadMain] + 0x88",
  "__NSThread__start__ + 0x410",
  "_pthread_body + 0x154",
  "thread_start + 0x4",
  "mach_msg_trap + 0x8",
  "mach_msg + 0x48",
  "_dispatch_main_queue_callback_4CF + 0x9c8",
  "start_wqthread + 0x4",
  "objc_msgSend + 0x40",
  "_CFStreamSignalEventSynch + 0x1b4",
] as const;

const THREAD_NAMES = [
  "com.apple.uikit.eventfetch-thread",
  "com.apple.NSURLConnectionLoader",
  "com.apple.root.default-qos",
  "Dispatch queue: com.apple.main-thread",
  "com.apple.CFSocket.private",
  "JavaScriptCore bmalloc scavenger",
] as const;

/** Faint, out-of-focus application source behind the backtrace. */
const SOURCE_LINES = [
  'String query = "SELECT * FROM users WHERE token = ?";',
  "ResultSet rs = stmt.executeQuery(query);",
  "// Creating an SQLException object with a custom message",
  "catch (Exception e) { e.printStackTrace(); }",
  "preparedStatement = connection.prepareStatement(sql);",
  'System.out.println("Returning Precision of TAG: " + tag);',
  "public static void main(String[] args) throws IOException {",
  "Statement stmt = con.createStatement();",
  "// Execute the query. This will throw an SQLException",
  "if (preparedStatement != null) preparedStatement.close();",
  "socket = new Socket(InetAddress.getByName(host), port);",
  "byte[] payload = Base64.getDecoder().decode(raw);",
  "Runtime.getRuntime().exec(cmd, env, workingDirectory);",
  "while ((len = in.read(buffer)) != -1) out.write(buffer);",
  "KeyStore ks = KeyStore.getInstance(KeyStore.getDefaultType());",
  "// TODO: rotate the credentials before the next release",
  "assertThat(response.statusCode()).isEqualTo(200);",
  "for (int i = 0; i < nodes.length; i++) visit(nodes[i]);",
  "private final AtomicInteger retryCount = new AtomicInteger();",
  'logger.warn("unauthorised access from {}", remoteAddr);',
] as const;

const hex = (next: () => number, digits: number): string => {
  let out = "";
  for (let i = 0; i < digits; i += 1) {
    out += "0123456789abcdef"[Math.floor(next() * 16)];
  }
  return out;
};

const pad = (text: string, width: number): string =>
  text.length >= width ? text : text + " ".repeat(width - text.length);

/** One symbolicated backtrace row, columns aligned like a real crash log. */
const backtraceLine = (next: () => number, index: number): string => {
  const framework = FRAMEWORKS[Math.floor(next() * FRAMEWORKS.length)];
  const symbol = SYMBOLS[Math.floor(next() * SYMBOLS.length)];
  const base = `0x1${hex(next, 2)}${hex(next, 3)}000`;
  const offset = `0x${hex(next, 5)}`;
  const addr = `0x1${hex(next, 8)}`;
  return `${String(index % 30).padStart(3, " ")}   ${pad(framework, 26)} ${addr} ${base} + ${offset}   ${symbol}`;
};

export type CodeLine = {
  text: string;
  /** 0 = ordinary log line, 1 = section header, 2 = application source. */
  kind: 0 | 1 | 2;
  /** Per-line brightness jitter, so the wall is not flat. */
  weight: number;
};

/**
 * Builds a block of `count` lines. Deterministic in `seed`, so the same
 * layer always regenerates identically — including at 4K.
 */
export const buildCodeBlock = (seed: number, count: number): CodeLine[] => {
  const next = stream(seed);
  const lines: CodeLine[] = [];
  let index = 0;
  while (lines.length < count) {
    const roll = next();
    if (roll < 0.08) {
      const name = THREAD_NAMES[Math.floor(next() * THREAD_NAMES.length)];
      const n = Math.floor(next() * 12);
      lines.push({ text: `Thread ${n} name:  ${name}`, kind: 1, weight: 1 });
      lines.push({ text: `Thread ${n}:`, kind: 1, weight: 1 });
      index = 0;
    } else if (roll < 0.28) {
      const src = SOURCE_LINES[Math.floor(next() * SOURCE_LINES.length)];
      const indent = " ".repeat(Math.floor(next() * 5) * 2);
      lines.push({ text: indent + src, kind: 2, weight: 0.55 + next() * 0.3 });
    } else if (roll < 0.33) {
      lines.push({ text: "", kind: 0, weight: 0 });
    } else {
      lines.push({
        text: backtraceLine(next, index),
        kind: 0,
        weight: 0.7 + next() * 0.45,
      });
      index += 1;
    }
  }
  return lines.slice(0, count);
};

/** Short strings for the HUD readouts that flash over the wall. */
export const HUD_MESSAGES = [
  "ACCESS DENIED",
  "ROOT SHELL ACQUIRED",
  "DECRYPTING KEYSTORE",
  "FIREWALL BYPASSED",
  "EXFILTRATING 4.2 GB",
  "PRIVILEGE ESCALATION",
  "KERNEL PANIC 0x0000DEAD",
  "TRACE ROUTE LOST",
  "CERTIFICATE REVOKED",
  "INJECTING PAYLOAD",
] as const;
