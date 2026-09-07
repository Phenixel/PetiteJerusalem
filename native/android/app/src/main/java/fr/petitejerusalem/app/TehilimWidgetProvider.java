package fr.petitejerusalem.app;

/** Raccourci « Tehilim » : un livre, qui ouvre les Tehilim. */
public class TehilimWidgetProvider extends BookShortcutProvider {

    @Override
    protected String tickAction() {
        return "fr.petitejerusalem.app.widget.TEHILIM_TICK";
    }

    @Override
    protected int alarmRequestCode() {
        return 601;
    }

    @Override
    protected int clickRequestCode() {
        return 602;
    }

    @Override
    protected String clickUrl() {
        return "https://petite-jerusalem.fr/bibliotheque/tehilim";
    }

    @Override
    protected String corpus() {
        return "tehilim";
    }

    @Override
    protected int fallbackTitle() {
        return R.string.pj_widget_tehilim_label;
    }
}
