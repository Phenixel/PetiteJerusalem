import type { CDPSession, Page } from "playwright/test";
import { test, expect, gotoApp } from "../support/fixtures";

/**
 * Memory leaks: the app is a single page that lives for hours (a phone keeps
 * the native app in memory for days), so whatever a page leaves behind when
 * it is left piles up with every visit. These tests walk the same round of
 * pages again and again and check, through the Chrome DevTools Protocol,
 * that a round costs nothing more the eighth time than the third:
 *
 *  - `JSEventListeners`: a listener a page adds to `window`, `document` or a
 *    shared element and never removes;
 *  - `Nodes`: a detached DOM tree kept alive by a closure, a cache or such a
 *    listener;
 *  - `JSHeapUsedSize`: everything else (a module cache that grows without
 *    bound, a watcher or an interval that keeps its component alive).
 *
 * Two first rounds warm up what is meant to stay (lazy chunks, the texts
 * read, Intl formatters, the router's scroll positions); then a garbage
 * collection is forced before each measure, so only what is still reachable
 * counts.
 *
 * The same rounds run a second time with Capacitor told it is on Android
 * (`CapacitorCustomPlatform`): the app then takes its native branches
 * (`isNativeApp`, the `native-app` class, the plugin listeners of the app
 * shell), with the plugins' web implementations behind them. It is the web
 * view of the installed app, minus the Java and Swift side, which is audited
 * by reading (the "Memory" section of docs/tests.md).
 */

/** Pages a visitor goes through, none of which needs Firebase. */
const ROUND = [
  "/",
  "/bibliotheque",
  "/bibliotheque/tehilim",
  "/bibliotheque/tehilim/23",
  "/bibliotheque/tanakh/shir-hashirim",
  "/bibliotheque/talmud/berakhot/1",
  "/sidour",
  "/horaires",
  "/horaires/paris",
  "/calendrier",
  "/paracha",
  "/telechargements",
  "/a-propos",
];

const WARMUP_ROUNDS = 2;
const MEASURED_ROUNDS = 6;

/**
 * How much a round may add, judged on the median of the round-to-round
 * differences. A page that leaks leaves the same thing at every visit, so
 * every difference carries it: one listener forgotten by one page gives a
 * median of 1. A transient (a request finishing during the measure, a
 * listener added for a moment) moves one sample, up or down, and leaves the
 * median at 0; the total over the rounds would take it for a leak.
 */
const MAX_LISTENERS_PER_ROUND = 0;
const MAX_NODES_PER_ROUND = 5;
/** The whole measured rounds: observed 0.8 to 1.6 MB, the V8 code caches. */
const MAX_HEAP_GROWTH_MB = 4;

type Sample = { heapMb: number; nodes: number; listeners: number; documents: number };

async function sample(cdp: CDPSession): Promise<Sample> {
  // DevTools keeps the arguments of every console message alive, and a dev
  // build's Vue warnings carry the component that raised them: without this,
  // a page that warns looks like a page that leaks.
  await cdp.send("Runtime.discardConsoleEntries");
  // Twice: what the first pass frees (finalizers, weak maps) the second one
  // collects.
  await cdp.send("HeapProfiler.collectGarbage");
  await cdp.send("HeapProfiler.collectGarbage");
  const { metrics } = await cdp.send("Performance.getMetrics");
  const read = (name: string) => metrics.find((m) => m.name === name)?.value ?? 0;
  return {
    heapMb: read("JSHeapUsedSize") / 1024 / 1024,
    nodes: read("Nodes"),
    listeners: read("JSEventListeners"),
    documents: read("Documents"),
  };
}

/** Client-side navigation, as a tap on a link does it (no page reload). */
async function navigate(page: Page, path: string): Promise<void> {
  await page.evaluate(async (to) => {
    type Router = { push(path: string): Promise<unknown>; isReady(): Promise<void> };
    const host = document.querySelector("#app") as unknown as {
      __vue_app__: { config: { globalProperties: { $router: Router } } };
    };
    const router = host.__vue_app__.config.globalProperties.$router;
    await router.push(to);
    await router.isReady();
  }, path);
  await page.locator("main, #app > *").first().waitFor();
  // Leave the page time to fetch its text and finish its entrance, as a
  // reader would, so that the next push really unmounts a page in use.
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await transitionsDone(page);
}

/**
 * No Vue transition still running: in the app, the times fold back into the
 * tab bar button for a moment after they are left, and a measure taken
 * meanwhile counts their whole page.
 */
async function transitionsDone(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.querySelectorAll('[class*="-leave-active"], [class*="-enter-active"]').length,
      ),
    )
    .toBe(0);
}

async function walk(page: Page, rounds: number): Promise<void> {
  for (let round = 0; round < rounds; round++) {
    for (const path of ROUND) await navigate(page, path);
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((x, y) => x - y);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** The median of what each round added to `key`. */
function perRound(samples: Sample[], key: "nodes" | "listeners"): number {
  return median(samples.slice(1).map((s, i) => s[key] - samples[i][key]));
}

async function roundsCostNothing(page: Page, label: string): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");

  await gotoApp(page, "/");
  await walk(page, WARMUP_ROUNDS);
  await navigate(page, "/");
  const samples = [await sample(cdp)];
  for (let round = 0; round < MEASURED_ROUNDS; round++) {
    await walk(page, 1);
    await navigate(page, "/");
    samples.push(await sample(cdp));
  }

  const first = samples[0];
  const last = samples[samples.length - 1];
  const summary = {
    listeners: samples.map((s) => s.listeners),
    nodes: samples.map((s) => s.nodes),
    heapMb: samples.map((s) => Number(s.heapMb.toFixed(2))),
    listenersPerRound: perRound(samples, "listeners"),
    nodesPerRound: perRound(samples, "nodes"),
    heapGrowthMb: Number((last.heapMb - first.heapMb).toFixed(2)),
    documentsGrowth: last.documents - first.documents,
  };
  test
    .info()
    .annotations.push({ type: "memory", description: `${label}: ${JSON.stringify(summary)}` });
  console.log(`[memory] ${label}`, summary);

  expect
    .soft(summary.listenersPerRound, "event listeners left at each round (median)")
    .toBeLessThanOrEqual(MAX_LISTENERS_PER_ROUND);
  expect
    .soft(summary.nodesPerRound, "DOM nodes left at each round (median)")
    .toBeLessThanOrEqual(MAX_NODES_PER_ROUND);
  expect
    .soft(summary.heapGrowthMb, "JS heap (MB) left by the measured rounds")
    .toBeLessThan(MAX_HEAP_GROWTH_MB);
  // An iframe or a document that outlives its page (a print view, an embed).
  expect.soft(summary.documentsGrowth, "documents left by the rounds").toBeLessThanOrEqual(0);
}

/**
 * An hour on one page: the clocks of the home page (the current zman, the
 * countdowns, the Hebrew date) tick without anyone navigating. An interval
 * that adds a listener or a node at each tick shows here, not in the rounds.
 */
async function anHourCostsNothing(page: Page, label: string): Promise<void> {
  await page.clock.install();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  await gotoApp(page, "/");
  await page.waitForLoadState("networkidle").catch(() => undefined);
  await page.clock.runFor(60_000);
  const before = await sample(cdp);
  await page.clock.runFor(60 * 60_000);
  const after = await sample(cdp);
  console.log(`[memory] ${label}, one hour`, { before, after });
  expect.soft(after.listeners - before.listeners, "listeners added in an hour").toBeLessThan(10);
  expect.soft(after.nodes - before.nodes, "nodes added in an hour").toBeLessThan(300);
  expect.soft(after.heapMb - before.heapMb, "heap (MB) added in an hour").toBeLessThan(3);
}

test.describe("memory", () => {
  // Thirteen pages, eight times over, plus the garbage collections.
  test.describe.configure({ timeout: 240_000 });

  test.describe("web site", () => {
    test("going round the pages again leaves nothing behind", async ({ page }) => {
      await roundsCostNothing(page, "web");
    });

    test("an hour on the home page leaves nothing behind", async ({ page }) => {
      await anHourCostsNothing(page, "web");
    });
  });

  test.describe("native app web view", () => {
    test.beforeEach(async ({ context }) => {
      await context.addInitScript(() => {
        (
          window as unknown as { CapacitorCustomPlatform: { name: string } }
        ).CapacitorCustomPlatform = { name: "android" };
      });
    });

    test("the native branches are taken", async ({ page }) => {
      await gotoApp(page, "/");
      await expect(page.locator("html")).toHaveClass(/native-app/);
    });

    test("going round the pages again leaves nothing behind", async ({ page }) => {
      await roundsCostNothing(page, "native");
    });

    test("an hour on the home page leaves nothing behind", async ({ page }) => {
      await anHourCostsNothing(page, "native");
    });
  });
});
