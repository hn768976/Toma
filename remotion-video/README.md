# Remotion video

<p align="center">
  <a href="https://github.com/remotion-dev/logo">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-dark.apng">
      <img alt="Animated Remotion Logo" src="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-light.gif">
    </picture>
  </a>
</p>

Welcome to your Remotion project!

## Commands

**Install Dependencies**

```console
npm i
```

**Start Preview**

```console
npm run dev
```

**Render video**

```console
npx remotion render
```

**Upgrade Remotion**

```console
npx remotion upgrade
```

## Voiceover transcription

Word-level caption timings come from a local Whisper.cpp run:

```console
node scripts/transcribe.mjs public/voiceover-01.mp3 01
```

The script converts the mp3 to 16kHz mono WAV, builds whisper.cpp 1.7.4 into
`whisper.cpp/` (gitignored), downloads the `medium.en` model, transcribes with
`tokenLevelTimestamps`, and runs the result through `@remotion/captions`'
`toCaptions()`. It writes:

- `public/captions-01.json` — `Caption[]`, one entry per word
- `public/transcript-01.txt` — readable prose, timestamped per sentence

and prints a summary (duration in seconds and frames, word count, words per
minute, the ten longest inter-word gaps, and any word below 0.5 confidence).

The model is fetched from `huggingface.co`, so that host must be reachable.
Re-derive the outputs from a saved run without re-transcribing with
`WHISPER_JSON=node_modules/.cache/transcribe/01-whisper.json node scripts/transcribe.mjs`.

Everything that maps caption milliseconds onto the 30fps timeline lives in
`src/timing.ts` (`FPS`, `msToFrame`) — that is the only place the frame rate is
written down.

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
