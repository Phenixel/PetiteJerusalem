# Spec: Petite Jérusalem, the ad in isometric 3D

```text
GOAL:    a stranger wants the app after 68 s: it shares a reading, holds a library, the
         whole prayer, goals and their follow-up, and it is free, with no ads.
OUTPUT:  HyperFrames, 1080 x 1920, 30 fps, French, narrated.
TIME:    68 s x 30 = 2040 frames; 120 BPM, 15 frames a beat; the voice is the clock
         (voix.json), the sounds are placed on the picture (scripts/sons.mjs).
LOOK:    grounds: the giant phone's screen in the app's colors, changed by waves that spread
         from the next island: orange #EB9F4F, blue #328CDC, emerald #059C66, dawn #FFD09E,
         cream #FFF9F3, night #1F2937; outside the phone, cream.
         Islands: a stone slab #EFE4D6 over a stepped underside #D9C8B6, #C2AE9F, floating
         9 units over the ground, bobbing 0.14 units; the logo's orange #FEA547 and blue #539EE2.
         3D: orthographic camera at the isometric elevation (35.26 deg), azimuth 45 deg except
         when it turns; Lambert materials, flat; warm key light from upper left, hemisphere
         fill; one PCF shadow on the ground (opacity 0.2, tinted #5A3D28). No gradient, no glow.
         Type: titles Manrope 800, 118 px (156 px for a word that hits), tracking -0.035 em,
         white on colored grounds, #35312A on light ones; white pills with the ground's color
         as ink; the end card in Playfair Display 700, 104 px.
         Screens: five real screens of the app, standing in the world as phones that face the
         camera (store listing, and the Sidour, the home page, Mon parcours from the 4.0 video).
OBJECTS: a phone (rounded body #1E1B18, notch, buttons) at two scales; the little Jerusalem
         (tower, crenellated wall, domed house, cypresses, open book, star); readers (a body,
         a head, a navy kippa); numbered tiles that flip to orange with a check; 30 small tiles
         in a fountain; a ring of 24 segments; confetti; a tower of seven bound books; a play
         button and its sound rings; a plane; a domed house, the Sidour (navy, gold « סידור »)
         whose cover opens, the sun, stars, two candles; a path of seven stones, a walker,
         a flag, a bell, a giant check; the wall of 52 weeks; the lights (lamp, candle, menorah,
         moon, stars, a galaxy of 220 points).
MOTION:  things land: dropped from 9 to 12 units with a bounce (0.6 to 0.75 s), or pop with
         back.out(1.6) (0.45 s); flights between islands 1.2 to 1.4 s, the view widening 35%
         at mid-flight; the dive and the pull-back move the zoom on a log scale; titles rise
         into a mask with back.out(1.6), 0.42 s, 0.1 s between words, leave upwards in 0.26 s;
         a word that hits slams from 2.2 times its size.
SHOTS:   0-4.2    a phone floats on the cream, the question; the camera dives into its screen.
         4.2-10   inside: the island rises out of the screen, the city drops in block by block,
                  the star lands (6.45); « Petite Jérusalem », « Gratuite », « Sans publicité ».
         10-20.4  blue wave; readers walk in (10.7); the psalms fountain (12.5), « 150 Tehilim »,
                  « 1 seul lien »; parts fly to the readers (15.6), flip, checked (17.75); the
                  ring lights; the siyoum: confetti, « Siyoum ! » (18.75).
         20.4-30.6 emerald wave; seven books drop into a tower (21.2); named books slide out;
                  a play button and its rings (25.85); a plane circles (27.2).
         30.6-38.4 dawn wave; the sun rises; the Sidour opens (33.3); Cha'harit, Min'ha, Arvit
                  on the sun's course while the camera turns 55 degrees; day, then night
                  (35.3); stars, the candles light (35.9).
         38.4-47.4 orange wave; the path's stones, the flag drops (39.6); the walker hops the
                  days (41.2-43.0); the bell rings (43.4); the check slams (45.35), confetti.
         47.4-58  cream wave; the month builds (48.2-50.3), « Votre mois. »; the camera pulls
                  back as the year rushes in (51.6), « Votre année. »; night; the lamp lights,
                  then candle, menorah, moon, stars, the galaxy (56.45), counter to 106.
         58-68    orange wave; the camera flies out until the archipelago stands on a phone;
                  the logo, the name (59.2), « Gratuite, sans publicité », Android, iPhone.
BANNED:  the defaults of the HyperFrames spec; gradients; glow, bloom, particles as decoration
         (the confetti fall and rest); product UI tilted beyond the camera's elevation; a dark
         void; the logo docked in a corner; block capitals with wide tracking; any screen that
         is not the app; the first cut's language (phones held upright as cards, two-line
         captions on cream).
QA:      0 (question and phone), 4.5 (all orange), 6.6 (city and name), 15.2 (150 Tehilim),
         18.9 (siyoum), 25.5 (books named), 28.4 (plane), 34.5 (sun and labels), 36.6 (night),
         42.3 (walker), 46.2 (check), 51.2 (month), 52.6 (year), 56.9 (galaxy), 63 (end card).
```
