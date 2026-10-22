/**
 * The demo account's Mon parcours, built in the page by the app's own
 * functions (src/services/parcours): goals taken more than a hundred days
 * ago, all kept since, so the home page shows a long streak, an advanced
 * light (the galaxy), a full wall and volumes well under way. Today, only
 * part is done: the home deck still has cards.
 *
 * Written to the account (Firestore), then to the device; the page must be
 * reloaded afterwards for the app to read it all again.
 */

/** The days kept in a row before today. */
export const STREAK_DAYS = 104;

/** For page.evaluate: runs in the app, signed in to the demo account. */
export async function seedParcours({ streak, locale = "fr" }) {
  const create = await import("/src/services/parcours/create.ts");
  const schedule = await import("/src/services/parcours/schedule.ts");
  const actions = await import("/src/services/parcours/actions.ts");
  const days = await import("/src/services/parcours/days.ts");
  const calendar = await import("/src/services/parcours/calendar.ts");
  const cloud = await import("/src/services/parcours/cloud.ts");
  const device = await import("/src/services/parcours/deviceStore.ts");
  const { emptyParcours } = await import("/src/services/parcours/model.ts");
  const { localDayKey } = await import("/src/services/dateService.ts");
  const { auth } = await import("/src/firebase/core.ts");
  // A habit is named in the language it was taken in, like PresetSheet does.
  const strings = (await import(`/src/locales/${locale}.ts`)).default;
  const habitName = (preset) => strings.parcours.habits[preset];

  const today = localDayKey(new Date());
  const since = days.addDays(today, -(streak + 2));
  const now = Date.now() - (streak + 2) * 86400000;
  const isRest = calendar.restCalendar(false);
  const aliyot = calendar.parashaAliyotCount(false);

  let data = emptyParcours();
  const put = (objective) => {
    data = actions.putObjective(data, { ...objective, since }, now);
  };
  // The whole book of Tehilim by winter; the Michna of Moed on weekdays;
  // chnei mikra one aliyah a day; two habits.
  put(create.createProgram({ corpus: "tehilim", parts: ["all"], rhythm: "daily", end: days.addDays(today, 50), moment: "morning" }, since, now));
  put(create.createProgram({ corpus: "michna", parts: ["seder:moed"], rhythm: "weekdays", end: days.addDays(today, 160), moment: "evening" }, since, now));
  put(create.createCycle("parasha-aliyot", since, now));
  put(create.createHabit({ preset: "chema-al-hamita", name: habitName("chema-al-hamita"), days: [0, 1, 2, 3, 4, 5, 6], moment: "bedtime" }, since, now));
  put(create.createHabit({ preset: "tsedaka", name: habitName("tsedaka"), days: [0, 1, 2, 3, 4, 5], moment: "anytime" }, since, now));

  const touched = new Set();
  const markDay = (day, keep) => {
    const ctx = schedule.scheduleContext(data, isRest, aliyot);
    const tasks = schedule.tasksForDay(data, day, ctx);
    tasks.forEach((task, i) => {
      if (!keep(task, i)) return;
      data = actions.setTaskDone(data, task, day, true, now);
      touched.add(day);
    });
  };
  for (let d = since; d < today; d = days.addDays(d, 1)) markDay(d, () => true);
  // Today: the first card done, the others waiting.
  markDay(today, (_task, i) => i === 0);

  const entries = { objectives: Object.keys(data.objectives), days: [...touched] };
  const uid = auth.currentUser?.uid;
  if (uid) {
    // From scratch: goals laid down by an earlier run would join these ones.
    await cloud.deleteAccountParcours(uid);
    await cloud.writeAccountEntries(uid, data, entries);
  }
  device.writeDeviceState({ data, owner: uid ? { uid } : null, dirty: { objectives: [], days: [] } });
  return { objectives: entries.objectives.length, days: entries.days.length, today };
}
