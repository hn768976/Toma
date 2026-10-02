import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { withAlpha } from "../../lib/color";
import { INTER, MONO, MONTSERRAT } from "../../lib/fonts";
import { Grain } from "../../lib/Grain";
import { TAU, loopSaw, loopSin, loopT } from "../../lib/loop";
import type { DashboardVersion } from "../../versions";
import {
  Bug,
  Check,
  Envelope,
  Face,
  Fire,
  Globe,
  Key,
  LockFile,
  Magnifier,
  Nodes,
  Padlock,
  Phone,
  Pin,
  Shield,
  Skull,
  User,
  WarningTriangle,
  Wifi,
} from "./icons";
import {
  AreaChart,
  BarChart,
  EventLog,
  Fingerprint,
  Gauge,
  Label,
  Panel,
  StatusRing,
  ThreatMap,
  blink,
  dotsAt,
  type LogLine,
  type Theme,
} from "./widgets";

/**
 * Look 3 — Security Dashboard (2.5D). One big flat HTML/SVG board
 * (2.5 × 2 frame size) tilted with CSS perspective; the camera pans along a
 * closed ellipse (one lap per loop) with a slight push in/out (two cycles).
 * Every widget animation completes whole cycles in 600 frames.
 */
const DW = 9600; // 2.5 × 3840
const DH = 4320; // 2 × 2160

const EVENT_LINES: LogLine[] = [
  { time: "08:14:02", level: "INFO", msg: "Session token rotated · user 0x3F1A" },
  { time: "08:14:09", level: "INFO", msg: "Firewall rules synced (412 rules)" },
  { time: "08:14:17", level: "WARN", msg: "Repeated login attempts · 198.51.100.23" },
  { time: "08:14:21", level: "INFO", msg: "Certificate check passed · gateway-02" },
  { time: "08:14:30", level: "ALERT", msg: "Port scan detected · 203.0.113.77" },
  { time: "08:14:34", level: "INFO", msg: "Source quarantined · rule FW-1138" },
  { time: "08:14:41", level: "WARN", msg: "Unsigned process blocked · pid 4417" },
  { time: "08:14:48", level: "INFO", msg: "Backup snapshot verified · vault-3" },
  { time: "08:14:55", level: "INFO", msg: "MFA challenge passed · user 0x2B07" },
  { time: "08:15:03", level: "ALERT", msg: "Malware signature match · node-17" },
  { time: "08:15:06", level: "INFO", msg: "Node-17 isolated, scan scheduled" },
  { time: "08:15:12", level: "WARN", msg: "Unusual outbound volume · 192.0.2.41" },
];

const MINI_LOG: LogLine[] = [
  { time: "14:03:18", level: "INFO", msg: "Login success" },
  { time: "14:03:22", level: "WARN", msg: "Suspicious process" },
  { time: "14:03:29", level: "ALERT", msg: "Unknown device blocked" },
  { time: "14:03:35", level: "INFO", msg: "Firewall updated" },
  { time: "14:03:41", level: "INFO", msg: "Policy sync complete" },
  { time: "14:03:47", level: "WARN", msg: "Weak cipher refused" },
];

const Board: React.FC<{ f: number; th: Theme }> = ({ f, th }) => {
  const a = th.accent;
  const g1 = 47 + 9 * loopSin(f, 2, 0.4);
  const g2 = 70 + 7 * loopSin(f, 3, 1.9);
  const g3 = 58 + 11 * loopSin(f, 1, 3.1);
  const up = 13.2 + 1.6 * loopSin(f, 4, 0.2);
  const down = 81.4 + 6.2 * loopSin(f, 3, 2.2);
  const scanP = loopSaw(f, 2);
  const counts = [
    1284 + Math.round(6 * loopSin(f, 2)),
    642 + Math.round(4 * loopSin(f, 3, 1)),
    97 + Math.round(3 * loopSin(f, 1, 2)),
    311 + Math.round(5 * loopSin(f, 2, 4)),
  ];
  const alertOn = blink(f, 20);

  return (
    <div
      style={{
        position: "absolute",
        width: DW,
        height: DH,
        background: th.bg,
        backgroundImage: `linear-gradient(${withAlpha(a, 0.05)} 2px, transparent 2px), linear-gradient(90deg, ${withAlpha(a, 0.05)} 2px, transparent 2px)`,
        backgroundSize: "60px 60px",
      }}
    >
      {/* ── Column A ───────────────────────────────────────────── */}
      <Panel x={150} y={140} w={2700} h={520} theme={th} title="System scan" sub="Full disk · heuristic">
        <div style={{ position: "absolute", left: 70, top: 220 }}>
          <Magnifier size={150} color={a} stroke={6} />
        </div>
        <Label x={280} y={215} size={56} color={th.text} weight={600}>
          Scanning{dotsAt(f, 20)}
        </Label>
        <Label x={280} y={290} size={44} color={th.dim} mono>
          C:\Project\build
        </Label>
        <div style={{ position: "absolute", left: 280, top: 380, width: 1900, height: 34, background: withAlpha(a, 0.15) }}>
          <div style={{ width: `${scanP * 100}%`, height: "100%", background: a, boxShadow: `0 0 18px ${a}` }} />
        </div>
        <Label x={2260} y={366} size={56} color={a} mono weight={700}>
          {Math.floor(scanP * 100)}%
        </Label>
      </Panel>

      <Panel x={150} y={760} w={2700} h={820} theme={th} title="Login" sub="Multi-factor authentication">
        {["Operator ID", "Passphrase"].map((lab, i) => (
          <div key={lab} style={{ position: "absolute", left: 70, top: 240 + i * 170, width: 2560, height: 120, border: `3px solid ${withAlpha(a, 0.4)}`, background: withAlpha(a, 0.05) }}>
            <div style={{ position: "absolute", left: 30, top: 30 }}>{i === 0 ? <User size={60} color={a} /> : <Key size={60} color={a} />}</div>
            <Label x={130} y={34} size={44} color={th.dim}>
              {lab}
            </Label>
            <Label x={760} y={30} size={48} color={th.text} mono>
              {i === 0 ? "op-7731" : "•".repeat(12)}
            </Label>
          </div>
        ))}
        <div style={{ position: "absolute", left: 70, top: 600, width: 900, height: 140, border: `4px solid ${a}`, boxShadow: `0 0 26px ${withAlpha(a, 0.6)}, inset 0 0 26px ${withAlpha(a, 0.3)}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONTSERRAT, fontWeight: 800, fontSize: 76, letterSpacing: "0.1em", color: a, textShadow: `0 0 18px ${a}` }}>
          LOGIN
        </div>
        <Label x={1060} y={640} size={42} color={th.dim}>
          Hardware key required · session 15 min
        </Label>
      </Panel>

      <Panel x={150} y={1680} w={2700} h={720} theme={th} title="Access control" sub="Role-based policy">
        {[
          ["Authorized users", "248", th.green],
          ["Admin sessions", "3", a],
          ["Pending approvals", "7", th.yellow],
          ["Revoked keys (24h)", "12", th.red],
        ].map(([k, v, c], i) => (
          <div key={k} style={{ position: "absolute", left: 70, top: 230 + i * 110, width: 2560, height: 90, borderBottom: `2px solid ${withAlpha(a, 0.18)}` }}>
            <div style={{ position: "absolute", left: 0, top: 22, width: 22, height: 22, background: c, boxShadow: `0 0 12px ${c}` }} />
            <Label x={60} y={10} size={48} color={th.text}>
              {k}
            </Label>
            <Label x={2100} y={8} size={54} color={c} mono weight={700} w={400} align="right">
              {v}
            </Label>
          </div>
        ))}
      </Panel>

      <Panel x={150} y={2500} w={2700} h={900} theme={th} title="Secure connection" sub="Encrypted tunnel">
        <div style={{ position: "absolute", left: 90, top: 260, filter: `drop-shadow(0 0 16px ${a})` }}>
          <Globe size={420} color={a} stroke={3.5} />
        </div>
        <Label x={640} y={300} size={72} color={th.text} weight={600}>
          VPN Connected{dotsAt(f, 10)}
        </Label>
        <Label x={640} y={400} size={52} color={th.dim} mono>
          203.0.113.24 · port 443
        </Label>
        <Label x={640} y={470} size={44} color={th.dim}>
          Tunnel uptime <span style={{ fontFamily: MONO, color: th.text }}>12:41:07</span>
        </Label>
        <div style={{ position: "absolute", left: 640, top: 590, width: 820, height: 150, border: `4px solid ${a}`, boxShadow: `0 0 30px ${withAlpha(a, 0.6)}, inset 0 0 30px ${withAlpha(a, 0.35)}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONTSERRAT, fontWeight: 800, fontSize: 70, letterSpacing: "0.1em", color: a, textShadow: `0 0 18px ${a}` }}>
          PROTECTED
        </div>
        <div style={{ position: "absolute", left: 1600, top: 600, display: "flex", alignItems: "center", gap: 30, padding: "24px 40px", border: `3px solid ${withAlpha(a, 0.5)}` }}>
          <Key size={70} color={a} />
          <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 62, color: a, textShadow: `0 0 14px ${a}` }}>AES-256</span>
        </div>
      </Panel>

      <Panel x={150} y={3500} w={2700} h={700} theme={th} title="Security event log" sub="Live · last 60 s">
        <div style={{ position: "absolute", left: 70, top: 230 }}>
          <EventLog f={f} lines={EVENT_LINES} visible={6} lineH={70} w={2560} theme={th} size={42} />
        </div>
      </Panel>

      {/* ── Column B ───────────────────────────────────────────── */}
      <Panel x={3000} y={140} w={2900} h={520} theme={th} title="Security events" sub="Gateway">
        <div style={{ position: "absolute", left: 70, top: 220 }}>
          <EventLog f={f} lines={MINI_LOG} visible={4} lineH={64} w={2700} theme={th} size={40} />
        </div>
      </Panel>

      <div style={{ position: "absolute", left: 3020, top: 760 }}>
        <div style={{ fontFamily: MONTSERRAT, fontWeight: 800, fontSize: 190, letterSpacing: "0.06em", color: a, textShadow: `0 0 30px ${withAlpha(a, 0.8)}`, lineHeight: 1 }}>CYBER SECURITY</div>
        <div style={{ fontFamily: INTER, fontWeight: 500, fontSize: 52, letterSpacing: "0.3em", color: th.dim, marginTop: 24 }}>DEFENCE OPERATIONS CONSOLE</div>
      </div>
      <div style={{ position: "absolute", left: 4620, top: 1060, display: "flex", gap: 90 }}>
        {["PROTECT", "DETECT", "RESPOND", "RECOVER"].map((tab, i) => {
          const active = Math.floor(loopT(f) * 4) === i; // each tab active 5 s
          return (
            <div key={tab} style={{ fontFamily: INTER, fontWeight: 600, fontSize: 46, letterSpacing: "0.12em", color: active ? a : th.dim, borderBottom: `5px solid ${active ? a : "transparent"}`, paddingBottom: 10, textShadow: active ? `0 0 12px ${a}` : undefined }}>
              {tab}
            </div>
          );
        })}
      </div>

      <Panel x={3000} y={1200} w={2900} h={1200} theme={th} dots={false}>
        <div style={{ position: "absolute", left: 85, top: 150, display: "flex", gap: 45 }}>
          <StatusRing f={f} size={880} color={a} mode="secure" icon={<Padlock size={220} color={a} stroke={5} />} title="SYSTEM SECURE" sub="All protections active" theme={th} />
          <StatusRing f={f} size={880} color={th.red} mode="threat" icon={<WarningTriangle size={220} color={th.red} stroke={5} />} title="THREAT DETECTED" sub="Suspicious activity" theme={th} />
          <StatusRing f={f} size={880} color={th.secondary} mode="scan" icon={<Shield size={220} color={th.secondary} stroke={5} />} title="SCANNING" sub="" theme={th} />
        </div>
      </Panel>

      <Panel x={3000} y={2500} w={2900} h={1500} theme={th} title="Global threat map" sub="Live origin tracking">
        <div style={{ position: "absolute", left: 80, top: 260 }}>
          <ThreatMap f={f} w={2300} h={1120} theme={th} />
        </div>
        {[
          ["High risk", th.red],
          ["Medium risk", th.yellow],
          ["Low risk", th.accent],
        ].map(([k, c], i) => (
          <div key={k} style={{ position: "absolute", left: 2440, top: 300 + i * 80, display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ width: 24, height: 24, borderRadius: 12, background: c, boxShadow: `0 0 12px ${c}` }} />
            <span style={{ fontFamily: INTER, fontSize: 38, color: th.text }}>{k}</span>
          </div>
        ))}
      </Panel>

      <Panel x={3000} y={4100} w={2900} h={180} theme={th} dots={false}>
        <Label x={70} y={52} size={56} color={th.dim} spacing="0.1em" weight={600}>
          NODE STATUS
        </Label>
        {Array.from({ length: 24 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: 700 + i * 88, top: 64, width: 56, height: 56, background: i === 17 ? th.red : withAlpha(a, 0.6), opacity: i === 17 ? blink(f, 15) : 1 }} />
        ))}
      </Panel>

      {/* ── Column C ───────────────────────────────────────────── */}
      <Panel x={6050} y={140} w={1950} h={520} theme={th} title="Network monitor" sub="Packets / s">
        <div style={{ position: "absolute", left: 70, top: 230 }}>
          <AreaChart f={f} w={1800} h={240} color={th.secondary} theme={th} seed="b" />
        </div>
      </Panel>

      <Panel x={6050} y={760} w={1950} h={1000} theme={th} title="System health" sub="Resources">
        <div style={{ position: "absolute", left: 80, top: 260, display: "flex", gap: 60 }}>
          <Gauge size={520} value={g1} color={a} label="CPU" theme={th} />
          <Gauge size={520} value={g2} color={th.secondary} label="MEMORY" theme={th} />
          <Gauge size={520} value={g3} color={th.yellow} label="NETWORK" theme={th} />
        </div>
      </Panel>

      <Panel x={6050} y={1860} w={1950} h={1100} theme={th} title="Security analytics" sub="Last 24 hours">
        <Label x={80} y={240} size={72} color={th.text} mono weight={700}>
          1,276
        </Label>
        <Label x={420} y={258} size={48} color={th.green} mono>
          +13%
        </Label>
        <div style={{ position: "absolute", left: 80, top: 380 }}>
          <AreaChart f={f} w={1790} h={560} color={a} theme={th} seed="a" />
        </div>
        {["00:00", "06:00", "12:00", "18:00", "24:00"].map((s, i) => (
          <Label key={s} x={60 + i * 430} y={980} size={38} color={th.dim} mono>
            {s}
          </Label>
        ))}
      </Panel>

      <Panel x={6050} y={3060} w={1950} h={1220} theme={th} title="Biometric authentication" sub="Identity verified · secure access">
        <div style={{ position: "absolute", left: 70, top: 250, width: 640, height: 880, border: `3px solid ${withAlpha(a, 0.35)}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Fingerprint f={f} size={520} color={a} />
        </div>
        {[
          { k: "Fingerprint", ic: <Shield size={64} color={a} /> },
          { k: "Face scan", ic: <Face size={64} color={a} /> },
          { k: "Device", ic: <Phone size={64} color={a} /> },
          { k: "Location", ic: <Pin size={64} color={a} /> },
        ].map((row, i) => {
          const verified = loopSaw(f, 2) * 6 > i + 0.5 || loopSaw(f, 2) > 0.92 ? 1 : 0.35;
          return (
            <div key={row.k} style={{ position: "absolute", left: 780, top: 270 + i * 210, width: 1100, height: 170, borderBottom: `2px solid ${withAlpha(a, 0.16)}` }}>
              <div style={{ position: "absolute", left: 0, top: 30 }}>{row.ic}</div>
              <Label x={110} y={36} size={50} color={th.text} weight={600}>
                {row.k}
              </Label>
              <div style={{ position: "absolute", left: 640, top: 30, display: "flex", alignItems: "center", gap: 18, opacity: verified }}>
                <Check size={60} color={th.green} />
                <span style={{ fontFamily: INTER, fontWeight: 600, fontSize: 44, color: th.green }}>Verified</span>
              </div>
            </div>
          );
        })}
      </Panel>

      {/* ── Column D ───────────────────────────────────────────── */}
      <Panel x={8150} y={140} w={1300} h={520} theme={th} color={th.red} dots={false}>
        <div style={{ position: "absolute", left: 70, top: 70, width: 380, height: 380, border: `6px solid ${th.red}`, background: withAlpha(th.red, 0.12 + 0.18 * alertOn), boxShadow: `0 0 ${40 * alertOn}px ${th.red}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ opacity: alertOn, filter: `drop-shadow(0 0 16px ${th.red})` }}>
            <Skull size={260} color={th.red} stroke={5} />
          </div>
        </div>
        <Label x={510} y={150} size={60} color={th.red} weight={700} glow={th.red}>
          INTRUSION
        </Label>
        <Label x={510} y={230} size={44} color={th.dim}>
          Payload isolated
        </Label>
        <Label x={510} y={300} size={44} color={th.text} mono>
          node-17
        </Label>
      </Panel>

      <Panel x={8150} y={760} w={1300} h={1080} theme={th} title="Threat intelligence">
        {[
          { k: "Malware", icon: <Bug size={90} color={th.red} />, c: th.red },
          { k: "Phishing", icon: <Envelope size={90} color={th.yellow} />, c: th.yellow },
          { k: "Ransomware", icon: <LockFile size={90} color={th.red} />, c: th.red },
          { k: "DDoS", icon: <Nodes size={90} color={a} />, c: a },
        ].map((row, i) => (
          <div key={row.k} style={{ position: "absolute", left: 70, top: 220 + i * 200, width: 1160, height: 160, borderBottom: `2px solid ${withAlpha(a, 0.16)}` }}>
            <div style={{ position: "absolute", left: 0, top: 30 }}>{row.icon}</div>
            <Label x={140} y={50} size={52} color={th.text} weight={600}>
              {row.k}
            </Label>
            <Label x={760} y={46} size={58} color={row.c} mono weight={700} w={400} align="right">
              {counts[i].toLocaleString("en-US")}
            </Label>
          </div>
        ))}
      </Panel>

      <Panel x={8150} y={1940} w={1300} h={1000} theme={th} title="Network activity" sub="Mbps">
        <div style={{ position: "absolute", left: 70, top: 260, display: "flex", gap: 30, alignItems: "center" }}>
          <Wifi size={80} color={a} />
          <div>
            <div style={{ fontFamily: INTER, fontSize: 38, color: th.dim }}>Upload</div>
            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 58, color: a }}>{up.toFixed(1)} Mbps</div>
          </div>
        </div>
        <div style={{ position: "absolute", left: 70, top: 420, display: "flex", gap: 30, alignItems: "center" }}>
          <div style={{ width: 80 }} />
          <div>
            <div style={{ fontFamily: INTER, fontSize: 38, color: th.dim }}>Download</div>
            <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 58, color: th.secondary }}>{down.toFixed(1)} Mbps</div>
          </div>
        </div>
        <div style={{ position: "absolute", left: 70, top: 640 }}>
          <BarChart f={f} w={1160} h={300} color={a} n={40} />
        </div>
      </Panel>

      <Panel x={8150} y={3040} w={1300} h={1240} theme={th} title="Firewall" sub="Perimeter">
        {[
          { k: "Intrusion detection", s: "MONITORING", icon: <Fire size={80} color={th.yellow} />, c: th.green },
          { k: "Endpoint guard", s: "ACTIVE", icon: <Shield size={80} color={a} />, c: th.green },
          { k: "Geo-fencing", s: "ENFORCED", icon: <Pin size={80} color={a} />, c: a },
          { k: "Device trust", s: "3 PENDING", icon: <Phone size={80} color={a} />, c: th.yellow },
        ].map((row, i) => (
          <div key={row.k} style={{ position: "absolute", left: 70, top: 230 + i * 240, width: 1160 }}>
            <div style={{ position: "absolute", left: 0, top: 10 }}>{row.icon}</div>
            <Label x={130} y={10} size={46} color={th.text} weight={600}>
              {row.k}
            </Label>
            <Label x={130} y={76} size={38} color={row.c} mono weight={700}>
              ● {row.s}
            </Label>
          </div>
        ))}
      </Panel>

    </div>
  );
};

export const SecurityDashboard: React.FC<{ v: DashboardVersion }> = ({ v }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const th: Theme = {
    accent: v.accent,
    secondary: v.secondary,
    red: "#FF3B4E",
    yellow: "#FFC93C",
    green: "#3FD27A",
    text: "#D4E4EE",
    dim: "#6F8798",
    panel: v.panel,
    bg: v.background,
  };
  const t = loopT(frame);
  const ph = TAU * (t + v.cameraPhase);
  // closed ellipse over the board (board-space point brought to screen centre)
  const px = DW / 2 + 2700 * Math.cos(ph);
  const py = DH / 2 + 1150 * Math.sin(ph);
  const push = 120 * Math.sin(2 * ph); // slight push in/out, 2 cycles per loop
  const s = width / 3840;

  return (
    // key={frame}: fresh DOM + compositing layers every frame, so a frame rasterises the
    // same whether it is rendered cold or deep inside a multi-threaded sequence.
    <AbsoluteFill key={frame} style={{ backgroundColor: "#050B12", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, perspective: 2600 * s, perspectiveOrigin: "50% 50%" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: DW,
            height: DH,
            transformOrigin: "0 0",
            transform: `translate3d(${width / 2}px, ${height / 2}px, ${push * s}px) scale(${s}) rotateX(25deg) rotateY(-12deg) translate(${-px}px, ${-py}px)`,
          }}
        >
          <Board f={frame} th={th} />
        </div>
      </div>
      {/* shallow depth of field: far (top) and near (bottom) edges soft */}
      <AbsoluteFill
        style={{
          backdropFilter: `blur(${9 * s}px)`,
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 30%, transparent 72%, black 100%)",
          maskImage: "linear-gradient(to bottom, black 0%, transparent 30%, transparent 72%, black 100%)",
        }}
      />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 75% 70% at 50% 50%, transparent 55%, rgba(2,6,10,0.65) 100%)" }} />
      <Grain amount={0.015} seed={3} />
    </AbsoluteFill>
  );
};
