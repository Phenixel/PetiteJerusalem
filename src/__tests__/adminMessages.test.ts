import { describe, expect, it } from "vitest";
import { i18n, loadAdminMessages } from "../i18n";
import frAdmin from "../locales/frAdmin";
import routes from "../router/routes";

/**
 * The back office's French messages are not in the initial bundle (every
 * visitor downloaded them with fr.ts): the /admin route loads them before
 * its first page. See also initialBundle.test.ts.
 */
describe("the back office messages", () => {
  it("arrive with loadAdminMessages, merged into French", async () => {
    (i18n.global.locale as unknown as { value: string }).value = "fr";
    const t = i18n.global.t as (key: string) => string;
    expect(t("admin.title")).toBe(frAdmin.title);
    expect(t("admin.clearSelection")).toBe("admin.clearSelection");
    await loadAdminMessages();
    expect(t("admin.clearSelection")).toBe(frAdmin.clearSelection);
    expect(t("admin.title")).toBe(frAdmin.title);
  });

  it("are loaded by the /admin route before its pages", () => {
    const admin = routes.find((route) => route.path === "/admin");
    expect(admin?.beforeEnter).toBeTypeOf("function");
  });
});
