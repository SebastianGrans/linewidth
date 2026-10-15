// Picked up automatically by every `npx web-ext` command run from this folder.
// See https://extensionworkshop.com/documentation/develop/web-ext-command-reference/

export default {
  // Keep development-only files out of built and signed packages. `web-ext
  // run` loads the source folder directly, so it still sees them
  ignoreFiles: ["dev", "dev/**", "scripts", "scripts/**", "web-ext-config.mjs"],

  run: {
    // A page the sample settings in dev/seed.json apply to
    startUrl: ["https://mosquitto.org/documentation/authentication-methods/"],
  },

  // Distributed through GitHub releases rather than addons.mozilla.org, with
  // updates found via the update_url in manifest.json
  lint: {
    selfHosted: true,
  },
  sign: {
    channel: "unlisted",
  },
};
