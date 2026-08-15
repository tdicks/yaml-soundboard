# GTA Soundboard

Browser soundboard driven by [sounds.yaml](sounds.yaml). No build step.

## Run

Serve the folder over HTTP (the YAML is loaded via `fetch`, so `file://` will not work):

```powershell
python -m http.server 8000
# or: npx serve .
```

Then open http://localhost:8000

## Adding sounds

Drop MP3s into `sounds/` and reference them in [sounds.yaml](sounds.yaml).

```yaml
- label: Wasted          # button text
  type: file             # plays the single file below
  file: sounds/wasted.mp3
  category: misc         # supplies the colour and the top-left tag

- label: Random Insult
  type: random           # plays one file at random
  category: insults
  list: insults          # a named list from the `lists:` section

- label: Random Chaos
  type: random
  category: mixed
  list: [insults, police]  # several named lists combined

- label: Random One-Offs
  type: random
  colour: teal           # overrides the category colour
  files:                 # inline files, can be combined with `list:`
    - sounds/oneoff-1.mp3
    - sounds/oneoff-2.mp3
```

Categories live under `categories:` and give a display name plus a colour:

```yaml
categories:
  insults:
    name: Insult
    colour: purple
```

Reusable lists live under `lists:`:

```yaml
lists:
  insults:
    - sounds/insult-1.mp3
    - sounds/insult-2.mp3
```

Colours map to a Tailwind palette defined in `COLOURS` in [app.js](app.js):
slate, red, orange, amber, yellow, lime, green, emerald, teal, cyan, sky, blue,
indigo, violet, purple, fuchsia, pink, rose. Unknown values fall back to slate.
