package fr.petitejerusalem.app;

/** Raccourci « Sidour » : un livre, qui ouvre le sidour. */
public class SidourWidgetProvider extends BookShortcutProvider {

    @Override
    protected String tickAction() {
        return "fr.petitejerusalem.app.widget.SIDOUR_TICK";
    }

    @Override
    protected int alarmRequestCode() {
        return 501;
    }

    @Override
    protected int clickRequestCode() {
        return 502;
    }

    @Override
    protected String clickUrl() {
        return "https://petite-jerusalem.fr/bibliotheque/sidour";
    }

    @Override
    protected String corpus() {
        return "sidour";
    }

    @Override
    protected int fallbackTitle() {
        return R.string.pj_widget_sidour_label;
    }
}
