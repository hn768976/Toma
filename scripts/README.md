# scripts

## Installing uv

[uv](https://docs.astral.sh/uv/) is Astral's Python package and project manager.

**Windows (PowerShell):**

```powershell
powershell -ExecutionPolicy ByPass -File .\scripts\install-uv.ps1
```

**Linux / macOS:**

```sh
./scripts/install-uv.sh
```

Both scripts are thin wrappers around the official Astral installers. They skip
the download when `uv` is already on `PATH`, accept a pinned version, and print
the resulting binary path and version.

| | Pin a version | Force reinstall |
|---|---|---|
| PowerShell | `-Version 0.8.17` | `-Force` |
| POSIX shell | `./scripts/install-uv.sh 0.8.17` | `FORCE=1 ./scripts/install-uv.sh` |

To install somewhere other than `~/.local/bin`, set `UV_INSTALL_DIR` before
running the script.

The upstream one-liners the scripts wrap:

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

```sh
curl -LsSf https://astral.sh/uv/install.sh | sh
```
