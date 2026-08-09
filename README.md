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


## Development phases

### Phase 1 [DONE]

In order to create this extension, we must first be able to easily
select the correct HTML element to adjust the width of.

The user can click the extension in the extension tool bar, and then
click on an element. The element boundaries should be made visible.
Then with a slider, the user can go up the heirarcy until the correct
parent element is choosen.

### Phase 2 [DONE]

Once the correct element has been selected, the user can then specify
the width with another slider (and also a field for manually typing
the preferred width).

### Phase 4

Currently, we have an MVP, but there are other cool things we could do
as well!

#### Interface 

Currently, you click on the extension in the extension panel, but can
we also add it to the context menu?

Add a `Settings` page that you can access by right clicking the
extension?

#### Font

Add ability to change:

  * Size
  * typeface
  * ??

#### Memory

Might be useful to remeber this between visits. This would require a
button to "forget" settings for a site.

Could we have "short term memory" that is persistent across a session?
E.g. a refresh shouldn't restore to the defaults. And if you click on
a link, and then go back, the settings should persist.

#### Centering [DONE]

Maybe add a toggle to try to center the now less-wide text?

### Phase N

Figure out packaging!

https://extensionworkshop.com/documentation/publish/package-your-extension/

* We probably want icons



## Development flow

Go to

```text
about:debugging#/runtime/this-firefox
```

and install this asa temporary extension by selecting `manifest.json`
from this directory.
