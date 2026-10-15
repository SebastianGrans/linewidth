#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Sign the extension and publish it as a GitHub release, along with the
updates.json that installed copies check (through the update_url in
manifest.json) to find new versions.

Usage: bump "version" in manifest.json, commit, then run

    uv run scripts/release.py

Signing needs your addons.mozilla.org API credentials
(https://addons.mozilla.org/developers/addon/api/key/). They're read from
AMO_ISSUER and AMO_SECRET if set, and asked for otherwise.
"""

import getpass
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARTIFACTS = ROOT / "web-ext-artifacts"


def run(*args: str, env: dict[str, str] | None = None) -> None:
    # Run a command in the repository root, stopping the release if it fails

    subprocess.run(args, cwd=ROOT, env=env, check=True)


def output(*args: str) -> str:
    # Run a command in the repository root and return what it printed

    result = subprocess.run(args, cwd=ROOT, check=True, capture_output=True, text=True)
    return result.stdout.strip()


def succeeds(*args: str) -> bool:
    # Run a command in the repository root and report whether it succeeded

    return subprocess.run(args, cwd=ROOT, capture_output=True).returncode == 0


def credential(name: str, prompt: str, hidden: bool = False) -> str:
    # Read a credential from the environment variable `name`, or ask for it

    value = os.environ.get(name, "").strip()
    if value:
        return value

    try:
        value = (getpass.getpass if hidden else input)(f"{prompt} ({name}): ").strip()
    except (EOFError, KeyboardInterrupt):
        print(file=sys.stderr)
        value = ""
    if not value:
        sys.exit(f"Signing needs {name}")
    return value


def signed_xpi(version: str) -> Path | None:
    # Find the signed file `web-ext sign` downloaded for this version, if any.
    # It's named after a random ID, e.g. d2c4e417a7b14233947f-0.2.0.xpi

    matches = sorted(ARTIFACTS.glob(f"*-{version}.xpi"))
    if len(matches) > 1:
        names = ", ".join(match.name for match in matches)
        sys.exit(f"Found several signed files for {version}, keep only one: {names}")
    return matches[0] if matches else None


def main() -> None:
    manifest = json.loads((ROOT / "manifest.json").read_text())
    version = manifest["version"]
    addon_id = manifest["browser_specific_settings"]["gecko"]["id"]
    repo = output("gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner")
    tag = f"v{version}"
    xpi = ARTIFACTS / f"{manifest['name']}-{version}.xpi"

    if output("git", "status", "--porcelain"):
        sys.exit("Commit or stash your changes first, so the release matches a commit")
    if succeeds("gh", "release", "view", tag):
        sys.exit(f'Release {tag} already exists. Bump "version" in manifest.json first')

    run("npx", "web-ext", "lint")

    # Mozilla signs each version only once, so reuse a signed file left by an
    # earlier run. Either way, rename it so the release gets a predictable
    # download link
    if not xpi.exists():
        signed = signed_xpi(version)
        if not signed:
            issuer = credential("AMO_ISSUER", "addons.mozilla.org API key")
            secret = credential("AMO_SECRET", "addons.mozilla.org API secret", hidden=True)

            # web-ext reads these itself, which keeps the secret off the command line
            env = {**os.environ, "WEB_EXT_API_KEY": issuer, "WEB_EXT_API_SECRET": secret}
            run("npx", "web-ext", "sign", env=env)
            signed = signed_xpi(version)
        if not signed:
            sys.exit(f"Signing didn't produce a {ARTIFACTS.name}/*-{version}.xpi")
        signed.rename(xpi)

    updates = ARTIFACTS / "updates.json"
    update_link = f"https://github.com/{repo}/releases/download/{tag}/{xpi.name}"
    updates.write_text(
        json.dumps(
            {"addons": {addon_id: {"updates": [{"version": version, "update_link": update_link}]}}},
            indent=2,
        )
        + "\n"
    )

    if not succeeds("git", "rev-parse", "--quiet", "--verify", f"refs/tags/{tag}"):
        run("git", "tag", tag)
    run("git", "push", "origin", tag)

    run(
        "gh", "release", "create", tag, str(xpi), str(updates),
        "--verify-tag", "--title", tag, "--generate-notes",
    )


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as error:
        # The command has usually printed its own error already
        if error.stderr:
            print(error.stderr, file=sys.stderr, end="")
        sys.exit(error.returncode)
