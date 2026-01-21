It is annoying how hard it is to take photos out of Google Photos. 

They seem to have done everything possible to make it as difficult as possible. 

This script provides a bit of that functionality. It works on Linux (and I think on macOS).


How to use:

We assume you’ve downloaded all the ZIP files into a single folder (this could be improved if Google had an API to request and download everything automatically — but no, I don’t think they’ll ever do that; it’s not in their interest 🙂). So we assume you download the ZIPs once.

```
`./manage_takeout_zips.sh /media/sergii/60034cb1-fe02-445b-aaf9-356d9bc58d93/takeout
Status:`
-------
27 out of 127 unpacked
100 not unpacked

Next step:
----------
  1) Validate unpacked folders contain data
  2) Unpack missing zips
  3) Exit
```

## What does it give you? Why not do it manually?

You can’t just select all 10,000 ZIP files and unpack them at once — it will fail. You have to do it sequentially, and then you still need to check that everything unpacked correctly and that nothing was lost. That would take hours to do by hand. This simple script helps with exactly that.
