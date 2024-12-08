# Bloopernet-FP

A time and state synchronized web drum machine, brought to you by [Fireproof](http://use-fireproof.com "Fireproof") 
(Current target is `use-fireproof` v0.19.106 with `@fireproof/cloud`)
When multiple users play at once, all of their beats and tempo, and any sounds they add to the pattern, are synced across all screens.

The web application in this repo is built, tested and deployed using [npm](http://https://www.npmjs.com/ "npm") and [Vite](https://vite.dev/ "Vite"). First install those, then incant thusly:
```
npm install
npm run dev
```

It's still a work in progress. Known issues include:

* Latency compensation requires manual adjustment on Android devices and with most wireless speakers.
* Time stutters when BPM is changed.
* Upgrading from Fireproov v0.18 wipes previous data. Sorry, still in beta!

On the other hand:

* Major performance improvements
* Style fixes
