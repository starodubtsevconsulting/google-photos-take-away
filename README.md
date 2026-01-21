It is annoying how hard it is to take photos out of Google Photos. 

They seem to have done everything possible to make it as difficult as possible. 

This script provides a bit of that functionality. It works on Linux (and I think on macOS).


How to use:

I assume you’ve downloaded all the ZIP files into a single folder. This could be improved if Google had an API to request and download everything automatically — but no, I don’t think they’ll ever do that; it’s not in their interest 🙂. When you do it manually, they ask you to confirm your identity every 5–10 ZIPs, which shows how hard they don’t want you to go through with it. So we assume you download the ZIPs once.

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
  3) Refresh status
  4) Exit

```

## What does it give you? Why not do it manually?

You can’t just select all 10,000 ZIP files and unpack them at once — it will fail. You have to do it sequentially, and then you still need to check that everything unpacked correctly and that nothing was lost. That would take hours to do by hand. This simple script helps with exactly that.

## Why not just use some smart unzip tool that does it all?

Sure, you could — I just don’t know any. And besides that, it’s more than just unzipping: once everything is unpacked, you still have to do some shuffling and go through the folders, which takes time too.

### Why `.sh` (Bash) script? Why not my popular language?

Because Bash is gold:  
[Why Bash Scripting Shines in the AI Era](https://medium.com/starodubtsev-consulting/why-bash-scripting-shines-in-the-ai-era-e6dfa29cbc6c)


## Links:
Related article: [I Sold the Lens Before It Sold Me](https://medium.com/@sergii_54085/i-sold-the-lens-before-it-sold-me-4bdecb778559?postPublishedType=repub)

