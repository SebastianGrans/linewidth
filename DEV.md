# Development flow

## Setting up the environment

Install Node.js

```sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/master/install.sh | bash
source ~/.zshrc
nvm install --lts
```

Install `web-ext`

https://github.com/mozilla/web-ext

```sh
npm install          # installs web-ext from package.json
npx web-ext lint     # check the manifest
```


## Testing the extension

And then run the extension in a sandbox browser:

```bash
npx web-ext run
```

This starts with a fresh Firefox profile every time, so to have
something to test with, the extension loads the sample settings from
[dev/seed.json](dev/seed.json) when it's installed temporarily. Firefox
opens on a page they apply to (set in
[web-ext-config.mjs](web-ext-config.mjs)). Click the toolbar icon once
and allow access to the site; after that, the settings apply
automatically on every page load. Add entries to `dev/seed.json` to
have more settings ready.

The `dev/` folder and the config file are left out of built and signed
packages.

You can also install the bare extension in your regular browser by
going to this page:


```text
about:debugging#/runtime/this-firefox
```

## Publishing a new release

Bump `"version"` in `manifest.json`, commit, then run:

```sh
AMO_ISSUER=... AMO_SECRET=... scripts/release.sh
```

This lints the extension, has Mozilla sign it (unlisted, so it isn't
published on addons.mozilla.org), tags the commit and creates a GitHub
release with two files:

- `linewidth-<version>.xpi`, the signed extension
- `updates.json`, which says that this is the newest version and where
  to download it

Installed copies check
`https://github.com/SebastianGrans/linewidth/releases/latest/download/updates.json`
(the `update_url` in `manifest.json`) about once a day, and update
themselves when it lists a newer version. GitHub points that link at
the newest release that isn't a draft or pre-release. To check right
away, open `about:addons`, click the gear icon and choose
**Check for Updates**.

If the script fails partway, fix the problem and run it again: it
reuses an already signed `.xpi` and an existing tag.

