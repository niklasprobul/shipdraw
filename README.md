# shipdraw

*procedurally generated ship drawings. [demo](https://niklasprobul.github.io/shipdraw/). a sister of [birddraw](https://github.com/niklasprobul/birddraw) and [fishdraw](https://github.com/LingDong-/fishdraw) by Lingdong Huang.*

![](samples/000000.svg)

- generates all sorts of ships in profile: full-rigged ships, brigantines, clippers, galleons, schooners, cutters, feluccas, junks, longships, galleys, steamers, tugs, steam yachts, paddle steamers and ironclads
- random details, their numbers drawn from Poisson distributions or coin flips: passengers and crew, patches on worn sails, lifeboats in their davits, smoke, pennants, ensigns and signal flags, anchors, deck cargo, stern lanterns, boats on deck or towed astern, gulls
- every element also has a variant form, picked per ship: sprit, radial-cut, settee and fan-battened sails, brailed festoons, crow's nests, deadeyes, lattice rails, open gunports, square ports, arched windows, swallowtail flags, bell-topped funnels, wispy smoke, covered boats, tossed oars, painted shields, a trident ram, tyre fenders, twin guns, whitecaps and a skein of birds
- outputs polylines (supported format svg, json, csv, etc.)
- full procedural generation, single file no dependencies
- plotter-centric
- export drawing animation:

![](samples/animated.svg)



## usage

basic

```
node shipdraw.js > output.svg
```

specify seed (from a string), speed of drawing and output format:

```
node shipdraw.js --seed "HMS Endeavour" --format smil --speed 2 > output.svg
```

- the seed string is used as the name of the ship (printed in the drawing). If unspecified, a random ship name will be auto generated.
- the name's prefix picks the kind of ship: `SS` and `MV` give a steamer or tug, `RMS` a liner, `PS` a paddle steamer, `SY` a steam yacht, `HMS` a man-of-war, galleon or ironclad, `USS` and `SMS` warships. Any other name gets a ship chosen by its seed.
- the speed number is used to control the speed of drawing animation. Larger the number is, faster it draws. This option works only with format `smil`.
- format options: `svg` (regular svg), `smil` (animated svg), `csv` (each polyline on a comma-separated line), `json` and `ps`.

in the browser: `index.html` draws a new ship on every visit, seeded by the time of the visit.
`index.html?seed=HMS%20Endeavour` draws a fixed ship. it works on any static host, such as
GitHub Pages, with no build step.

use as JS library:

```js
const {ship,generate_params} = require('./shipdraw.js');
let polylines = ship(generate_params("SS Matilda"));
console.log(polylines);
```


## gallery

![](samples/000001.svg)
![](samples/000002.svg)
![](samples/000003.svg)
![](samples/000004.svg)
![](samples/000005.svg)
![](samples/000006.svg)
![](samples/000007.svg)
![](samples/000008.svg)
![](samples/000009.svg)
