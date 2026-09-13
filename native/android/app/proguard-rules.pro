# Règles R8 de l'app téléphone.
#
# Le scaffold Capacitor livre `minifyEnabled false` : le bundle part alors
# sans une ligne d'obscurcissement, et la Play Console s'en plaint
# (« L'optimisation de l'appli est inférieure à notre seuil »). Elle mesurait
# 3 % sur la 3.9.5, pour un seuil à 25 %, et ces 3 % n'étaient que la part
# déjà obscurcie des bibliothèques. C'est scripts/setup-android.mjs qui pose
# `minifyEnabled true` et qui recopie ce fichier dans android/app/.
#
# Presque tout ce qui doit survivre à R8 survit sans une règle écrite ici :
#
#   - les plugins Capacitor, que le bridge charge par leur nom
#     (assets/capacitor.plugins.json, puis Class.forName) : la bibliothèque
#     @capacitor/android livre ses propres règles avec son AAR
#     (consumerProguardFiles), qui conservent toute classe étendant
#     com.getcapacitor.Plugin, ses @PluginMethod et ses annotations ;
#   - les composants déclarés au manifest (MainActivity, les receivers des
#     widgets, les services Firebase) : AGP en dérive des règles à la
#     compilation, depuis le manifest fusionné ;
#   - les méthodes @JavascriptInterface, par quoi passe tout le pont entre la
#     webview et le natif, et les annotations lues à l'exécution : elles sont
#     dans proguard-android-optimize.txt, le fichier de règles par défaut.
#
# Ne reste donc ici que ce qu'aucun des trois ne couvre.

# Plantages lisibles. R8 efface par défaut le nom du fichier source et les
# numéros de ligne : un rapport de la Play Console n'aurait plus qu'une pile
# d'adresses. Le fichier de correspondance produit par R8 voyage dans l'AAB
# (BUNDLE-METADATA), la Play Console rend leurs vrais noms aux classes toute
# seule ; encore faut-il qu'il reste des lignes à lui rendre.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Les annotations que Capacitor lit à l'exécution. R8 en « full mode » (le
# défaut depuis AGP 8) ne laisse une annotation sur la classe qui la porte que
# si le type de l'annotation est lui-même retenu par une règle : les règles
# livrées par Capacitor conservent bien les classes de plugins, mais pas ces
# types, et R8 vidait donc les plugins de leur @CapacitorPlugin. PluginHandle
# ne trouvait plus rien, et le premier appel de permission mourait sur un
# NullPointerException dans Bridge.getPermissionStates (constaté sur la page
# Horaires : « Utiliser ma position » fermait l'app). Les valeurs comptent
# autant que les types, d'où le `{ *; }` : ce sont elles qui portent l'alias
# d'une permission et la liste de ses chaînes Android.
-keep @interface com.getcapacitor.annotation.** { *; }
-keep @interface com.getcapacitor.NativePlugin { *; }
-keep @interface com.getcapacitor.PluginMethod { *; }

# Connexion Facebook : @capacitor-firebase/authentication sait la faire, et son
# handler référence le SDK Facebook, qu'il déclare en `compileOnly`. L'app ne
# propose que Google et Apple (capacitor.config.ts), le SDK n'est donc pas
# embarqué et R8 refuse de continuer sur ces références sans réponse. Rien à
# embarquer pour autant : le code qui les porte n'est jamais atteint, et sans
# R8 le dex vivait déjà avec (il ne résout une classe qu'au premier usage).
-dontwarn com.facebook.**
