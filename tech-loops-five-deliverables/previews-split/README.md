# AI Core Tunnel previews (split)

`AICoreTunnel_Cyan.mp4` (131 MB) and `AICoreTunnel_Violet.mp4` (117 MB) are
above GitHub's 100 MB per-file limit, so they are stored here in parts.
Re-join and check them:

```bash
cd previews-split
cat AICoreTunnel_Cyan.mp4.part-*   > ../previews/AICoreTunnel_Cyan.mp4
cat AICoreTunnel_Violet.mp4.part-* > ../previews/AICoreTunnel_Violet.mp4
cd ../previews && sha256sum -c ../previews-split/SHA256SUMS
```

(Windows PowerShell: `cmd /c copy /b AICoreTunnel_Cyan.mp4.part-00+AICoreTunnel_Cyan.mp4.part-01 ..\previews\AICoreTunnel_Cyan.mp4`.)
