import { describe, expect, it } from "vitest";
import { createApp, h, nextTick, ref } from "vue";
import { createI18n } from "vue-i18n";
import fr from "../locales/fr";
import ReminderSettingsModal from "../views/Library/ReminderSettingsModal.vue";

/**
 * La modale des rappels de lecture, ouverte par la cloche de la page.
 *
 * Ce qu'elle doit garantir : la cloche n'agit plus dans le dos de
 * l'utilisateur. Tout passe par ici — activer, couper, choisir l'heure fixe,
 * ajouter le dernier appel d'avant-chkia — et rien n'est enregistré qui
 * n'enverrait jamais rien.
 */

interface ReminderChoice {
  enabled: boolean;
  daily: boolean;
  hour: number;
  minute: number;
  sunset: boolean;
}

/** Réglages enregistrés au départ : rappels actifs, heure fixe à 10 h 30. */
const BASE_PROPS = {
  enabled: true,
  daily: true,
  hour: 10,
  minute: 30,
  sunset: false,
  sunsetOffset: 20,
  sunsetTime: "21:24",
  placeLabel: "Paris",
};

function mount(props: Partial<typeof BASE_PROPS> = {}) {
  const i18n = createI18n({ legacy: false, locale: "fr", messages: { fr } });
  const saved: ReminderChoice[] = [];
  const show = ref(true);
  const host = document.createElement("div");
  document.body.appendChild(host);

  const app = createApp({
    render: () =>
      h(ReminderSettingsModal, {
        ...BASE_PROPS,
        ...props,
        show: show.value,
        "onUpdate:show": (value: boolean) => (show.value = value),
        onSave: (choice: ReminderChoice) => saved.push(choice),
      }),
  });
  app.use(i18n);
  app.mount(host);

  const text = () => host.textContent ?? "";
  /** Les interrupteurs, dans l'ordre : général, heure fixe, avant-chkia. */
  const toggles = () => [...host.querySelectorAll<HTMLInputElement>("input[type=checkbox]")];
  const button = (label: string) =>
    [...host.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith(label))!;
  const dial = (label: string) =>
    [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === label)!;

  async function click(el: Element) {
    el.dispatchEvent(new MouseEvent("click"));
    await nextTick();
  }
  async function toggle(index: number, value: boolean) {
    const input = toggles()[index];
    input.checked = value;
    input.dispatchEvent(new Event("change"));
    await nextTick();
  }

  return { host, saved, show, text, toggles, button, dial, click, toggle };
}

describe("ReminderSettingsModal", () => {
  it("montre les deux rappels, et d'où vient la chkia", async () => {
    const m = mount();
    await nextTick();

    expect(m.text()).toContain("Rappel à heure fixe");
    expect(m.text()).toContain("10:30");
    expect(m.text()).toContain("20 minutes avant la chkia");
    // Le lieu et l'heure du jour : sans eux, « avant la chkia » ne dit pas quand.
    expect(m.text()).toContain("Chkia aujourd'hui à 21:24 (Paris)");
  });

  it("ajoute le rappel d'avant-chkia sans toucher au reste", async () => {
    const m = mount();
    await nextTick();
    await m.toggle(2, true);
    await m.click(m.button("Confirmer"));

    expect(m.saved).toEqual([{ enabled: true, daily: true, hour: 10, minute: 30, sunset: true }]);
    expect(m.show.value).toBe(false);
  });

  it("coupe les rappels par l'interrupteur général", async () => {
    const m = mount();
    await nextTick();
    await m.toggle(0, false);
    await m.click(m.button("Confirmer"));

    expect(m.saved[0].enabled).toBe(false);
  });

  it("n'enregistre pas des rappels actifs dont aucun n'est choisi", async () => {
    const m = mount();
    await nextTick();
    await m.toggle(1, false);

    expect(m.text()).toContain("Choisissez au moins un rappel.");
    await m.click(m.button("Confirmer"));
    expect(m.saved).toEqual([]);
    expect(m.show.value).toBe(true);
  });

  it("propose l'heure fixe à qui rallume les rappels", async () => {
    // Rappels coupés : rouvrir l'interrupteur général ne doit pas laisser
    // l'utilisateur devant un réglage vide qu'il faudrait deviner.
    const m = mount({ enabled: false, daily: false, sunset: false });
    await nextTick();
    await m.toggle(0, true);
    await m.click(m.button("Confirmer"));

    expect(m.saved[0]).toMatchObject({ enabled: true, daily: true });
  });

  it("remonte l'heure choisie sur l'horloge", async () => {
    const m = mount();
    await nextTick();
    await m.click(m.button("10:30"));
    expect(m.text()).toContain("Choisir l'heure");

    await m.click(m.dial("7"));
    // L'heure choisie, le cadran passe aux minutes de lui-même.
    await m.click(m.dial("45"));

    // Valider l'horloge ne fait que revenir aux réglages : rien n'est encore
    // enregistré, l'utilisateur peut toujours renoncer.
    await m.click(m.button("Confirmer"));
    expect(m.saved).toEqual([]);
    expect(m.text()).toContain("Rappel à heure fixe");

    await m.click(m.button("Confirmer"));
    expect(m.saved[0]).toMatchObject({ hour: 7, minute: 45 });
  });

  it("repart des réglages enregistrés à chaque ouverture", async () => {
    const m = mount();
    await nextTick();
    await m.toggle(2, true);
    // Fermée sans valider, la modale ne doit rien avoir retenu.
    await m.click(m.button("Annuler"));
    m.show.value = true;
    await nextTick();

    expect(m.toggles()[2].checked).toBe(false);
    expect(m.saved).toEqual([]);
  });
});
