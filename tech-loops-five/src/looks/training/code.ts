/**
 * Original, plausible Python for the Model Training UI.
 * `tensorweave` is a FICTIONAL framework name, model/dataset names are fake,
 * and every URL is localhost.
 */

export const CODE: Record<string, { file: string; text: string }> = {
  llm_block: {
    file: "lm_model_training.py",
    text: `import tensorweave as tw
from tensorweave import nn, optim
from tensorweave.nn import functional as F

# --- Decoder block -------------------------------------
class DecoderBlock(nn.Module):
    def __init__(self, d_model, n_heads, dropout=0.1):
        super().__init__()
        self.attn = nn.MultiHeadAttention(d_model, n_heads)
        self.norm_1 = nn.RMSNorm(d_model)
        self.norm_2 = nn.RMSNorm(d_model)
        self.mlp = nn.Sequential(
            nn.Linear(d_model, 4 * d_model),
            nn.GELU(),
            nn.Linear(4 * d_model, d_model),
        )
        self.drop = nn.Dropout(dropout)

    def forward(self, x):
        x = x + self.drop(self.attn(self.norm_1(x)))
        return x + self.drop(self.mlp(self.norm_2(x)))


# --- Training loop -------------------------------------
def train(model, loader, epochs=3, clip=1.0):
    opt = optim.AdamW(model.parameters(), lr=3e-4)
    for epoch in range(1, epochs + 1):
        for step, batch in enumerate(loader, start=1):
            logits = model(batch.inputs)
            loss = F.cross_entropy(logits, batch.targets)
            opt.zero_grad()
            loss.backward()
            nn.clip_grad_norm(model.parameters(), clip)
            opt.step()
            if step % 50 == 0:
                print(f"epoch {epoch} step {step} loss {loss:.4f}")
        tw.save(model.state_dict(), f"./ckpt/epoch_{epoch}.pt")
`,
  },

  finetune: {
    file: "model_finetune.py",
    text: `import json
import tensorweave as tw
from tensorweave import nn, optim
from tensorweave.data import Dataset, DataLoader

# --- Dataset loading -----------------------------------
class DialogDataset(Dataset):
    def __init__(self, path, tok, max_len=1024):
        with open(path, encoding="utf-8") as fh:
            self.rows = [json.loads(line) for line in fh]
        self.tok, self.max_len = tok, max_len

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, i):
        p = self.tok.encode(self.rows[i]["prompt"])
        a = self.tok.encode(self.rows[i]["answer"])
        ids = (p + a)[: self.max_len]
        labels = ([-100] * len(p) + a)[: self.max_len]
        return tw.tensor(ids), tw.tensor(labels)


# --- Fine-tune loop ------------------------------------
def finetune(model, train_dl, val_dl, epochs=3, lr=2e-5):
    opt = optim.AdamW(model.trainable_parameters(), lr=lr)
    for epoch in range(1, epochs + 1):
        model.train()
        for ids, labels in train_dl:
            loss = nn.functional.cross_entropy(model(ids), labels)
            opt.zero_grad()
            loss.backward()
            opt.step()
        acc = evaluate(model, val_dl)
        print(f"epoch {epoch}: val_acc={acc:.3f}")


# --- Evaluation ----------------------------------------
@tw.no_grad()
def evaluate(model, loader):
    model.eval()
    hit, total = 0, 0
    for ids, labels in loader:
        mask = labels != -100
        hit += (model(ids).argmax(-1)[mask] == labels[mask]).sum()
        total += mask.sum()
    return hit / max(1, total)
`,
  },

  health_check: {
    file: "monitoring/health_check.py",
    text: `# monitoring/health_check.py
import json
import time
import urllib.request

SERVICE_URL = "http://localhost:8000/health"
METRICS_URL = "http://localhost:8000/metrics"
TRAINER_URL = "http://localhost:8080/status"


def ping(url: str, timeout: float = 1.5) -> tuple[int, float]:
    t0 = time.time()
    with urllib.request.urlopen(url, timeout=timeout) as resp:
        status = resp.status
    return status, (time.time() - t0) * 1000


def fetch_json(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=2.0) as resp:
        return json.loads(resp.read().decode("utf-8"))


def check_gpus(metrics: dict, max_temp: int = 83) -> list[str]:
    warnings = []
    for gpu in metrics.get("gpus", []):
        if gpu["temp_c"] > max_temp:
            warnings.append(f"gpu{gpu['id']} hot: {gpu['temp_c']}C")
        if gpu["mem_used_gb"] / gpu["mem_total_gb"] > 0.95:
            warnings.append(f"gpu{gpu['id']} memory nearly full")
    return warnings


def quality_drift(baseline: dict, current: dict, tol: float = 0.02):
    drift = {}
    for key, ref in baseline.items():
        delta = current.get(key, ref) - ref
        if abs(delta) > tol:
            drift[key] = round(delta, 4)
    return drift


if __name__ == "__main__":
    status, latency = ping(SERVICE_URL)
    print(f"service status={status} latency_ms={latency:.1f}")

    metrics = fetch_json(METRICS_URL)
    for line in check_gpus(metrics):
        print("WARN", line)

    trainer = fetch_json(TRAINER_URL)
    print(f"epoch={trainer['epoch']} step={trainer['step']}")
    print(f"loss={trainer['loss']:.4f} lr={trainer['lr']:.2e}")

    baseline = {"accuracy": 0.84, "f1": 0.81, "recall": 0.79}
    current = {"accuracy": 0.86, "f1": 0.82, "recall": 0.77}
    drift = quality_drift(baseline, current)
    print("quality drift:", drift or "none")

    while True:
        status, latency = ping(SERVICE_URL)
        if status != 200 or latency > 250:
            print(f"ALERT status={status} latency_ms={latency:.0f}")
        time.sleep(15)
`,
  },

  eval_report: {
    file: "reports/eval_report.py",
    text: `# reports/eval_report.py
import json
import statistics
import urllib.request
from pathlib import Path

EVAL_URL = "http://localhost:8000/eval/latest"
REPORT_DIR = Path("./reports/out")


def load_results(url: str = EVAL_URL) -> list[dict]:
    with urllib.request.urlopen(url, timeout=3.0) as resp:
        return json.loads(resp.read().decode("utf-8"))["results"]


def by_category(results: list[dict]) -> dict[str, list[float]]:
    groups: dict[str, list[float]] = {}
    for r in results:
        groups.setdefault(r["category"], []).append(float(r["correct"]))
    return groups


def summarise(groups: dict[str, list[float]]) -> list[tuple]:
    rows = []
    for name, scores in sorted(groups.items()):
        acc = statistics.fmean(scores)
        rows.append((name, len(scores), round(acc, 3)))
    return rows


def confusion(results: list[dict], labels: list[str]) -> list[list[int]]:
    index = {label: i for i, label in enumerate(labels)}
    grid = [[0] * len(labels) for _ in labels]
    for r in results:
        grid[index[r["label"]]][index[r["pred"]]] += 1
    return grid


def write_markdown(rows, path: Path) -> None:
    lines = ["| category | n | accuracy |", "|---|---|---|"]
    lines += [f"| {name} | {n} | {acc:.3f} |" for name, n, acc in rows]
    path.write_text("\\n".join(lines) + "\\n", encoding="utf-8")


if __name__ == "__main__":
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    results = load_results()
    rows = summarise(by_category(results))
    for name, n, acc in rows:
        print(f"{name:<18} n={n:<5} acc={acc:.3f}")

    overall = statistics.fmean(float(r["correct"]) for r in results)
    print(f"overall val_acc={overall:.3f}")

    labels = ["billing", "account", "shipping", "technical"]
    grid = confusion(results, labels)
    for label, row in zip(labels, grid):
        print(label.ljust(10), " ".join(f"{v:>4}" for v in row))

    write_markdown(rows, REPORT_DIR / "summary.md")
    print("report written to", REPORT_DIR / "summary.md")
`,
  },
};
