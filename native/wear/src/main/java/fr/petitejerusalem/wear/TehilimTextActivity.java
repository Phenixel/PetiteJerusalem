package fr.petitejerusalem.wear;

import android.os.Bundle;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONArray;

/**
 * Un psaume, en hébreu, lu au poignet.
 *
 * Ce n'est pas le plus confortable des supports, et ce n'est pas la question :
 * un Tehilim se dit là où l'on se trouve, et une montre est toujours là. Les
 * versets sont ceux du fichier embarqué (TehilimBook), séparés par un blanc
 * plutôt que numérotés : la place manque, et l'on ne vient pas y chercher une
 * référence.
 */
public class TehilimTextActivity extends PjWearActivity {

    public static final String EXTRA_CHAPTER = "chapter";

    private int chapter;
    private TextView title;
    private TextView text;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_tehilim_text);
        chapter = getIntent().getIntExtra(EXTRA_CHAPTER, 1);
        title = findViewById(R.id.pj_title);
        text = findViewById(R.id.pj_text);
        bindRotary((ScrollView) findViewById(R.id.pj_scroll));
    }

    @Override
    protected void render() {
        title.setText(TehilimBook.title(this, watchPayload(), chapter));
        JSONArray lines = TehilimBook.lines(this, chapter);
        StringBuilder body = new StringBuilder();
        for (int i = 0; i < lines.length(); i++) {
            if (i > 0) body.append("\n\n");
            body.append(lines.optString(i, ""));
        }
        text.setText(body.toString());
    }
}
