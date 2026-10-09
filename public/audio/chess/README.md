# Chess tabletop audio

Runtime Ogg Opus clips for CHESS-B25. Licence: Unity Asset Store (John Leonard French / Imphenzia), not CC0.

Re-encode from masters with `pnpm compress:audio` (WAV → `.ogg` at 96 kb/s Opus).

| Pattern | Role |
| --- | --- |
| `drop-{ambiance}.ogg` | Quiet move |
| `capture-{ambiance}.ogg` | Capture |
| `check.ogg` / `win.ogg` / `lose.ogg` | Shared state |
| `bed-{ambiance}-calm.ogg` | Room SFX bed |
| `bed-{ambiance}-music.ogg` | Scene melody under the room SFX bed |
| `bed-edge.ogg` / `bed-pressure.ogg` | Shared tension stems |
| `menu-music.ogg` | Shell menu loop |
