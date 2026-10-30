# Spec: Petite Jérusalem, the presentation in isometric 3D

```text
GOAL:    a stranger knows, after 86 s, that one free app lets them read with others,
         study, pray, set goals, keep them and see their month and year at a glance.
OUTPUT:  HyperFrames, 1080 x 1920, 30 fps, French.
TIME:    86 s x 30 = 2580 frames; 120 BPM, 15 frames a beat; the narration is the clock
         (voix.json: each sentence starts on a beat).
LOOK:    ground #FFF9F3 flat, the same as the app's page background, no texture;
         Jerusalem stone #E3D3C5 (light), #D6C4B8 (bricks), #C2AE9F (shade);
         orange #FEA547 (logo), #EB9F4F (solid fill), #D46D01 (ink, the only orange for text);
         blue #539EE2 (logo), #328CDC (ink); text #35312A, secondary #6D6759;
         night (prayer, Arvit) #1F2937 with text #F3F4F6.
         3D: orthographic camera at the true isometric angle (azimuth 45 deg, elevation 35.26 deg),
         Lambert materials, flat shading, a warm key light from upper left, hemisphere fill,
         one soft shadow (PCF, opacity 0.16, tinted #7A5A40); no bloom, no fog, no gradient.
         Type: captions Playfair Display 600, 62 px, line height 1.18, tracking -0.01 em,
         one key word per caption in italic #D46D01; labels Manrope 700, 34 to 44 px;
         the name in Playfair Display 700, 96 px.
         Screens: the app's real screenshots (store listing, fr-FR) and four screens cut from
         the published 4.0 video (Sidour, Mes sessions, the home page at 106 days, Mon parcours),
         in a phone 470 px wide, radius 56 px, bezel #1E1B18 14 px, facing the viewer, never tilted.
OBJECTS: the little Jerusalem (the logo's pieces in stone: a crenellated wall, a tower, an orange
         dome on a drum, two orange cypresses, an open blue book, a blue five-pointed star);
         readers (a body cylinder and a head sphere, orange, blue or stone) around a book;
         stone tiles that fly and turn orange once read; a 10-segment progress bar;
         a shelf with six bound books in the library's bindings (Tehilim, Michna, Talmud, Tanakh,
         Moussar, Halakha); nine orange audio bars; a sun that crosses an arc, two candles;
         three goal plinths (a dated book, the Tehilim volume with its red ribbon, a habit week);
         the wall of Mon parcours (one column per week, Sunday at the top, Chabbat white at the
         bottom), five weeks, then 52; the streak's lights (lamp, candle, menorah, moon, stars).
MOTION:  enter: back.out(1.4) on scale for objects rising, 0.5 s; power3.out for cards, 0.6 s;
         camera moves between districts: power2.inOut, 1.2 s, the zoom easing 20% further out at
         mid-move; words of a caption rise 24 px and fade in over 0.28 s, at their spoken time;
         nothing loops; nothing moves while it is read except the world behind.
SHOTS:   0.0-11.0   hook: the phone lies on the ground, the city rises out of it (0.4-3.6),
                    the star falls on the tower (3.9), « Voici Petite Jérusalem »: the logo and
                    the name come out above the city (4.5-10.3). Whoosh into the next district.
         11.0-26.0  sharing: six readers around an open book; a session card (Mes sessions)
                    rises at « Créez une session » (14.0); tiles fly to the readers at
                    « chacun réserve sa part » (21.2), turn orange at « la coche » (22.6),
                    the bar fills to the siyoum (23.4-25.1), flat confetti.
         26.0-39.0  study: the shelf builds (26.5), the phone shows the library (28.3), each book
                    lifts as it is named (30.0-32.7), « hors connexion »; the audio bars and the
                    class screen at « des chiourim » (36.0-38.0).
         39.0-49.5  prayer: back over the little city at dawn; the Sidour screen opens on the
                    moment (42.0), the times of the city (44.6); the sun crosses Cha'harit, Min'ha,
                    Arvit (46.2-47.8), night falls flat, the two candles light (47.9).
         49.5-62.5  goals: three plinths rise as each goal is named (51.6, 53.4, 55.0); the home
                    screen with the day's portion (57.0), a bell for the reminder (59.4),
                    the card swiped, done (60.4).
         62.5-77.0  the wall: stones drop one a day (63.0), the weeks fill (65.2), the month is
                    framed (67.8), the camera pulls back to the year, 52 columns (69.1); the lights
                    rise with the streak (71.0-74.0); the Mon parcours screen: Chabbat does not
                    break it (74.2).
         77.0-86.0  end card: flight back to the city, the logo, « Petite Jérusalem »,
                    « Gratuite, sans publicité », Android and iPhone, held to the end.
BANNED:  the defaults of the HyperFrames spec; gradients of any kind; borders on cards; glow,
         bloom, particles as decoration; product UI tilted in 3D; a dark void; the logo docked
         in a corner; capital letters with wide tracking on labels; any screen that is not the app.
QA:      1.0 (hook readable with no sound), 7.0 (logo and name), 15.5 (session card),
         23.5 (tiles orange, bar), 31.0 (library and a lifted book), 37.0 (class),
         43.0 (Sidour), 47.4 (night), 52.0 (plinths), 58.0 (home screen), 64.5 (stones),
         70.3 (the year), 73.0 (lights), 75.5 (Mon parcours), 82.0 (end card).
```
