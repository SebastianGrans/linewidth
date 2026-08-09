# linewidth

Many website have text that span the entire viewport width. This makes
it quite hard to read.

With this extension, you can click on a html element, and then with a
slider choose the correct parent element, and finally, adjust its
width.

## Example page 

A good example page that has this poor design is this:

https://mosquitto.org/documentation/authentication-methods/

It has text that covers the entire viewport width, but if you inspect
the page, and set `width: 45em;` on the `<article>`, it becomes much
more readable.



## Development flow

Install `web-ext`

https://github.com/mozilla/web-ext

And then run the extension in a sandbox browser:

```bash
npx web-ext run
```

You can also install the bare extension in your regular browser by
going to this page:


```text
about:debugging#/runtime/this-firefox
```