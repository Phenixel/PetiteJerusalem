# Règles R8 de l'app de montre (minifyEnabled est à true, build.gradle).
#
# Rien à conserver à la main : tout ce que le système appelle chez nous est
# déclaré au manifest (les activités, le service qui reçoit les payloads du
# téléphone, les deux fournisseurs de complications, le receiver du tick), et
# AGP en dérive ses propres règles à la compilation. Le reste n'est joignable
# que depuis ce code, R8 sait donc le suivre.

# Plantages lisibles : voir native/android/app/proguard-rules.pro, même raison.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
