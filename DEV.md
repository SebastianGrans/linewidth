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

You can also install the bare extension in your regular browser by
going to this page:


```text
about:debugging#/runtime/this-firefox
```

## Signing a new release

Bump `"version"` in `manifest.json`

```sh
npx web-ext lint
npx web-ext sign --channel=unlisted \
  --api-key=$AMO_JWT_ISSUER --api-secret=$AMO_JWT_SECRET
```

Produces an `.xpi` file in `web-ext-artifacts/`

## Publish a new release

```sh
gh release create v0.X.0 linewidth-0.X.0.xpi --title "v0.X.0" --notes "Release version X"
```

