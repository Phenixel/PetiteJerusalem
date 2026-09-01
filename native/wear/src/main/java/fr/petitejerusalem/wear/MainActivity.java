package fr.petitejerusalem.wear;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.util.List;
import org.json.JSONObject;

/**
 * L'écran d'accueil de la montre.
 *
 * On y trouve d'abord ce pour quoi on lève le poignet : le prochain horaire,
 * en grand, à l'accent du thème choisi sur le téléphone. Les trois écrans
 * suivent, la lecture du jour portant son avancement dès le menu, pour
 * n'avoir même pas à l'ouvrir.
 *
 * Rien n'est calculé ici : tout vient des payloads que le téléphone dépose
 * (voir PayloadStore). Sans payload, l'écran invite à ouvrir l'app sur le
 * téléphone, et les Tehilim restent accessibles : ils sont embarqués.
 */
public class MainActivity extends PjWearActivity {

    private ScrollView scroll;
    private TextView hebrewDate;
    private TextView place;
    private TextView nextLabel;
    private TextView nextTime;
    private TextView message;
    private LinearLayout menu;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        scroll = findViewById(R.id.pj_scroll);
        hebrewDate = findViewById(R.id.pj_hebrew_date);
        place = findViewById(R.id.pj_place);
        nextLabel = findViewById(R.id.pj_next_label);
        nextTime = findViewById(R.id.pj_next_time);
        message = findViewById(R.id.pj_message);
        menu = findViewById(R.id.pj_menu);
        bindRotary(scroll);

        // Ce que le téléphone a déjà synchronisé est disponible tout de suite,
        // même s'il est éteint ; la demande, elle, n'aboutit que s'il tourne.
        WatchLink.pull(this);
        WatchLink.request(this);
    }

    @Override
    protected void render() {
        long now = System.currentTimeMillis();
        JSONObject watch = watchPayload();
        JSONObject zmanim = payload(PayloadStore.KEY_ZMANIM);
        JSONObject daily = payload(PayloadStore.KEY_DAILY);

        showNextZman(zmanim, watch, now);
        buildMenu(watch, daily, now);
    }

    /** Le prochain horaire, ou le message qui explique qu'il n'y en a pas. */
    private void showNextZman(JSONObject zmanim, JSONObject watch, long now) {
        List<JSONObject> upcoming = Zmanim.upcoming(zmanim, now, 1);
        JSONObject day = Zmanim.dayAt(zmanim, now);
        setText(hebrewDate, day == null ? null : PayloadStore.text(day, "hebrewDate"));
        setText(place, PayloadStore.text(zmanim, "place"));

        if (upcoming.isEmpty()) {
            nextLabel.setVisibility(View.GONE);
            nextTime.setVisibility(View.GONE);
            message.setVisibility(View.VISIBLE);
            // Trois états, trois messages : rien n'est encore arrivé, ou la
            // semaine embarquée est épuisée faute d'avoir rouvert l'app.
            String stale = PayloadStore.text(zmanim, "stale");
            String pairing = PayloadStore.label(this, watch, "pairing", R.string.pj_wear_open_phone);
            message.setText(zmanim == null ? pairing : stale != null ? stale : pairing);
            return;
        }
        JSONObject next = upcoming.get(0);
        message.setVisibility(View.GONE);
        nextLabel.setVisibility(View.VISIBLE);
        nextTime.setVisibility(View.VISIBLE);
        nextLabel.setText(PayloadStore.text(next, "label"));
        nextTime.setText(PayloadStore.text(next, "time"));
        nextTime.setTextColor(PayloadStore.accent(zmanim));
    }

    /** Les trois écrans, la lecture du jour portant son avancement. */
    private void buildMenu(JSONObject watch, JSONObject daily, long now) {
        menu.removeAllViews();
        addRow(
            PayloadStore.label(this, watch, "zmanimTitle", R.string.pj_wear_zmanim),
            null,
            ZmanimActivity.class);

        Daily.Progress progress = Daily.of(daily, now);
        String detail = progress.configured ? Daily.progressLine(daily, progress) : null;
        addRow(
            PayloadStore.label(this, watch, "dailyTitle", R.string.pj_wear_daily),
            detail,
            LectureActivity.class);

        addRow(
            PayloadStore.label(this, watch, "textsTitle", R.string.pj_wear_texts),
            null,
            TehilimListActivity.class);
    }

    private void addRow(String title, String detail, Class<?> target) {
        View row = LayoutInflater.from(this).inflate(R.layout.row_menu, (ViewGroup) menu, false);
        ((TextView) row.findViewById(R.id.pj_row_title)).setText(title);
        TextView detailView = row.findViewById(R.id.pj_row_detail);
        if (detail == null || detail.isEmpty()) {
            detailView.setVisibility(View.GONE);
        } else {
            detailView.setVisibility(View.VISIBLE);
            detailView.setText(detail);
        }
        row.setOnClickListener(view -> startActivity(new Intent(this, target)));
        menu.addView(row);
    }

    private static void setText(TextView view, String value) {
        view.setText(value == null ? "" : value);
        view.setVisibility(value == null ? View.GONE : View.VISIBLE);
    }
}
