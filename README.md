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

### Phase 1

In order to create this extension, we must first be able to easily
select the correct HTML element to adjust the width of.

The user can click the extension in the extension tool bar, and then
click on an element. The element boundaries should be made visible.
Then with a slider, the user can go up the heirarcy until the correct
parent element is choosen.

### Phase 2

Once the correct element has been selected, the user can then specify
the width with another slider (and also a field for manually typing
the preferred width).

### Phase 3

Packaging. Now we're manually loading this through the debug interface
of firefix, but other users need a simple way to install it.



### Phase 4

Fancy features

* Remembering this across sites
* Try to center the div (a toggle button on the gui)



## Development flow

Go to

```text
about:debugging#/runtime/this-firefox
```

and install this asa temporary extension by selecting `manifest.json`
from this directory.
