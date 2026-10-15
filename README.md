# linewidth

Firefox extensions for changing the width and font size of elements to
make them more readable

Many website have text that span the entire viewport width. This makes
it quite hard to read.

With this extension, you can click on a html element, and then with a
slider choose the correct parent element, and finally, adjust its
width.

## Installation

The latest version of the extension can be downloaded from the release
page: [here](https://github.com/SebastianGrans/linewidth/releases)


## Applying settings to more than one page

By default, settings are saved for the exact page you're on. Use the
**Apply to** dropdown in the panel to widen that to a section of the
site, e.g. `/docs/*` applies to `https://example.com/docs/` and every
page under it.

When several saved rules match a page, an exact page rule wins, then
the longest pattern.

In the dashboard, **Edit** lets you type a pattern by hand. `*`
matches anything, so `/*/thread/*` matches thread pages in every
section.

Note that the picked element is remembered by its position in the
page, so a pattern works best across pages that share a layout.


## Example page 

A good example page that has this poor design is this:

https://mosquitto.org/documentation/authentication-methods/

It has text that covers the entire viewport width, but if you inspect
the page, and set `width: 45em;` on the `<article>`, it becomes much
more readable.


## Development flow

See [DEV.md](DEV.md)