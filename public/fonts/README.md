# Vendored font

`RobotoMono-latin-variable.woff2` is the latin subset of Roboto Mono
(variable weight 100-700), fetched from Google Fonts.

Roboto Mono is licensed under the Apache License, Version 2.0.
<https://www.apache.org/licenses/LICENSE-2.0>

It is checked in so that `npx remotion render` needs no network access and
produces byte-identical output on every machine. See
`src/CodeFlythrough/font.ts` to switch back to fetching it through
`@remotion/google-fonts` at render time.
