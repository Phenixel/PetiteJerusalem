package fr.petitejerusalem.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.util.DisplayMetrics;
import java.util.HashMap;
import java.util.Map;

/**
 * Ce que RemoteViews ne sait pas composer : la barre et l'anneau de
 * progression (il ne teint ni un ProgressBar ni un fond arrondi à une couleur
 * venue du payload) et l'étagère de la bibliothèque (dégradés, filets, titre
 * sur la couverture).
 *
 * Tout est dessiné dans un bitmap, que l'ImageView étire (scaleType fitCenter,
 * fitXY pour la barre) : la largeur réelle du widget n'est pas connue ici, et
 * l'utilisateur peut la changer à tout moment.
 *
 * Les livres reprennent trait pour trait le dessin de
 * src/components/LibraryShelf.vue et de son pendant iOS (ShelfBookView) : les
 * coordonnées sont celles du SVG d'origine, dans son carton de 96 sur 140.
 */
final class WidgetGraphics {

    private WidgetGraphics() {}

    /**
     * Densité de dessin, plafonnée : un bitmap de widget voyage par Binder,
     * dont la transaction est bornée. Deux fois la taille en points suffit,
     * l'ImageView agrandit le reste sans que cela se voie sur des aplats.
     */
    private static final float MAX_SCALE = 2f;

    /**
     * Reliures : une teinte chaude par volume, celles de LibraryShelf.vue.
     * Volontairement hors du thème de l'utilisateur, et identiques en mode
     * sombre : ce sont des objets posés là, pas de l'interface.
     */
    private static final Map<String, Integer> BINDINGS = new HashMap<>();

    static {
        BINDINGS.put("tehilim", 0xFF96604A);
        BINDINGS.put("michna", 0xFF7D6A4C);
        BINDINGS.put("talmud", 0xFF6D5743);
        BINDINGS.put("tanakh", 0xFF84483F);
        BINDINGS.put("sidour", 0xFF6E4551);
        BINDINGS.put("slihot", 0xFF7A5C36);
        BINDINGS.put("brahot", 0xFF5F6249);
    }

    /** Le crème du cadre estampé, et le titre comme doré à chaud. */
    private static final int STAMP = 0xFFECDFC4;
    private static final int TITLE = 0xFFF3EAD6;
    /** La tranche des pages, ivoire, et les filets qui la rayent. */
    private static final int PAGES = 0xFFEFE5D0;
    private static final int PAGE_LINES = 0xFFD6C8AB;

    /** Points vers pixels de dessin (densité plafonnée). */
    private static float scale(Context context) {
        DisplayMetrics metrics = context.getResources().getDisplayMetrics();
        return Math.max(1f, Math.min(MAX_SCALE, metrics.density));
    }

    /**
     * La barre de progression de la carte du tableau de bord : un rail pâle,
     * une pastille pleine à la proportion lue. Tracée large et étirée par
     * l'ImageView (fitXY).
     */
    static Bitmap progressBar(float ratio, int accent) {
        int width = 600;
        int height = 24;
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        float radius = height / 2f;
        // Le rail : l'accent très pâli, lisible sur le beige comme sur le sombre.
        paint.setColor(fade(accent, 38));
        canvas.drawRoundRect(new RectF(0, 0, width, height), radius, radius, paint);
        if (ratio > 0) {
            paint.setColor(accent);
            // Jamais plus fine que haute : une pastille, pas un trait.
            float filled = Math.max(height, Math.min(width, width * ratio));
            canvas.drawRoundRect(new RectF(0, 0, filled, height), radius, radius, paint);
        }
        return bitmap;
    }

    /**
     * L'anneau du raccourci de lecture : le même rapport que la barre de la
     * carte, mais refermé sur lui-même pour tenir dans la plus petite tuile.
     * Il part du haut, et non de la droite.
     */
    static Bitmap progressRing(Context context, float ratio, int accent) {
        int size = Math.round(78 * scale(context));
        float stroke = size * 9f / 78f;
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(stroke);
        float inset = stroke / 2f;
        RectF box = new RectF(inset, inset, size - inset, size - inset);
        paint.setColor(fade(accent, 38));
        canvas.drawOval(box, paint);
        if (ratio > 0) {
            paint.setColor(accent);
            paint.setStrokeCap(Paint.Cap.ROUND);
            canvas.drawArc(box, -90, Math.min(1f, ratio) * 360f, false, paint);
        }
        return bitmap;
    }

    /**
     * L'étagère : les livres côte à côte, posés sur leur planche. Un seul
     * livre pour les raccourcis d'un corpus, trois ou quatre pour la
     * bibliothèque.
     *
     * @param corpora les corpus, qui donnent les reliures
     * @param titles les titres écrits sur les couvertures (même longueur)
     * @param bookWidthDp la largeur d'un livre, en points, comme sur iOS
     * @param showsTitles faux sous quelques dizaines de points, où un titre ne
     *     se lit plus : on le tait plutôt que d'en faire une tache
     */
    static Bitmap shelf(
        Context context, String[] corpora, String[] titles, float bookWidthDp,
        float gapDp, boolean showsTitles) {
        float density = scale(context);
        float book = bookWidthDp * density;
        float gap = gapDp * density;
        float bookHeight = book * 140f / 96f;
        // La planche dépasse un peu des livres, comme une vraie étagère.
        float overhang = 4 * density;
        float boardHeight = Math.max(2f, book * 6f / 62f);
        float boardGap = book * 3f / 62f;

        int width = Math.round(corpora.length * book + (corpora.length - 1) * gap + overhang);
        int height = Math.round(bookHeight + boardGap + boardHeight);
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        float left = overhang / 2f;
        for (int i = 0; i < corpora.length; i++) {
            drawBook(canvas, left + i * (book + gap), 0, book,
                corpora[i], showsTitles ? titles[i] : null);
        }
        drawBoard(context, canvas, 0, bookHeight + boardGap, width, boardHeight);
        return bitmap;
    }

    /** La planche de l'étagère, en bois clair ; elle s'assombrit la nuit. */
    private static void drawBoard(
        Context context, Canvas canvas, float x, float y, float width, float height) {
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        int top = context.getResources().getColor(R.color.pj_shelf_board_top, context.getTheme());
        int bottom =
            context.getResources().getColor(R.color.pj_shelf_board_bottom, context.getTheme());
        paint.setShader(new LinearGradient(x, y, x, y + height, top, bottom, Shader.TileMode.CLAMP));
        float radius = height / 2f;
        canvas.drawRoundRect(new RectF(x, y, x + width, y + height), radius, radius, paint);
    }

    /**
     * Un livre relié : reliure chaude, pli du dos, tranche de pages ivoire qui
     * dépasse à droite, cadre estampé à double filet, titre horizontal en
     * serif et son ornement.
     */
    private static void drawBook(
        Canvas canvas, float x, float y, float width, String corpus, String title) {
        // Une unité du carton d'origine (96 sur 140), à l'échelle demandée.
        float u = width / 96f;
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);

        // Tranche des pages, ivoire, qui dépasse à droite, et ses filets.
        plate(canvas, paint, x, y, u, 84, 6, 9, 128, 2, PAGES);
        plate(canvas, paint, x, y, u, 87, 10, 0.8f, 120, 0, PAGE_LINES);
        plate(canvas, paint, x, y, u, 90, 10, 0.8f, 120, 0, PAGE_LINES);

        // Couverture, pli de la reliure côté dos, et sa ligne de lumière.
        Integer binding = BINDINGS.get(corpus);
        plate(canvas, paint, x, y, u, 3, 3, 84, 134, 4, binding == null ? 0xFF7D6A4C : binding);
        plate(canvas, paint, x, y, u, 3, 3, 7, 134, 3.5f, Color.argb(41, 0, 0, 0));
        plate(canvas, paint, x, y, u, 12, 5, 1, 130, 0, Color.argb(26, 255, 255, 255));

        // Lumière douce sur la couverture, du haut vers le bas.
        paint.setShader(new LinearGradient(
            0, y + 3 * u, 0, y + 137 * u,
            new int[] {
                Color.argb(23, 255, 255, 255),
                Color.argb(5, 255, 255, 255),
                Color.argb(15, 0, 0, 0),
            },
            new float[] {0f, 0.45f, 1f},
            Shader.TileMode.CLAMP));
        paint.setStyle(Paint.Style.FILL);
        canvas.drawRoundRect(
            new RectF(x + 3 * u, y + 3 * u, x + 87 * u, y + 137 * u), 4 * u, 4 * u, paint);
        paint.setShader(null);

        // Cadre estampé, double filet crème.
        stroked(canvas, paint, x, y, u, 18, 14, 62, 112, 1.5f, 1.4f, 140);
        stroked(canvas, paint, x, y, u, 22.5f, 18.5f, 53, 103, 1, 0.7f, 77);

        if (title == null || title.isEmpty()) return;
        drawTitle(canvas, paint, x, y, u, title);
        // Fine ornementation sous le titre : deux filets et un losange.
        plate(canvas, paint, x, y, u, 35, 79.5f, 11, 1, 0, fade(STAMP, 128));
        plate(canvas, paint, x, y, u, 52, 79.5f, 11, 1, 0, fade(STAMP, 128));
        Path diamond = new Path();
        diamond.moveTo(x + 49 * u, y + 77.2f * u);
        diamond.lineTo(x + 51.6f * u, y + 80 * u);
        diamond.lineTo(x + 49 * u, y + 82.8f * u);
        diamond.lineTo(x + 46.4f * u, y + 80 * u);
        diamond.close();
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(fade(STAMP, 128));
        canvas.drawPath(diamond, paint);
    }

    /** Le titre, en serif, centré dans le cadre estampé, comme doré à chaud. */
    private static void drawTitle(
        Canvas canvas, Paint paint, float x, float y, float u, String title) {
        Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
        text.setTypeface(Typeface.create(Typeface.SERIF, Typeface.BOLD));
        text.setColor(TITLE);
        text.setTextAlign(Paint.Align.CENTER);
        text.setLetterSpacing(0.04f);
        float size = 13.5f * u;
        text.setTextSize(size);
        // Un titre trop long se resserre plutôt que de déborder du cadre, et
        // jamais en deçà de la moitié : sous cette taille, il ne se lit plus.
        float room = 58 * u;
        while (text.measureText(title) > room && text.getTextSize() > size / 2) {
            text.setTextSize(text.getTextSize() - size / 20);
        }
        Paint.FontMetrics metrics = text.getFontMetrics();
        float baseline = y + 62 * u - (metrics.ascent + metrics.descent) / 2;
        canvas.drawText(title, x + 49 * u, baseline, text);
    }

    /** Un rectangle plein, aux coordonnées du dessin d'origine. */
    private static void plate(
        Canvas canvas, Paint paint, float x, float y, float u,
        float left, float top, float width, float height, float radius, int color) {
        paint.setShader(null);
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(color);
        RectF box = new RectF(
            x + left * u, y + top * u, x + (left + width) * u, y + (top + height) * u);
        canvas.drawRoundRect(box, radius * u, radius * u, paint);
    }

    /** Un rectangle au trait, pour les filets du cadre estampé. */
    private static void stroked(
        Canvas canvas, Paint paint, float x, float y, float u,
        float left, float top, float width, float height,
        float radius, float lineWidth, int alpha) {
        paint.setShader(null);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(lineWidth * u);
        paint.setColor(fade(STAMP, alpha));
        RectF box = new RectF(
            x + left * u, y + top * u, x + (left + width) * u, y + (top + height) * u);
        canvas.drawRoundRect(box, radius * u, radius * u, paint);
        paint.setStyle(Paint.Style.FILL);
    }

    /** La même couleur, à l'opacité demandée (0 à 255). */
    private static int fade(int color, int alpha) {
        return Color.argb(alpha, Color.red(color), Color.green(color), Color.blue(color));
    }
}
