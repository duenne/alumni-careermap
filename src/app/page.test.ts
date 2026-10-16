import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import snapshot from "../test-fixtures/linkedin-snapshots/fictional-member.json";
import * as adapter from "../lib/normalization/adapt-linkedin-snapshot";
import Home from "./page";
import RootLayout from "./layout";

afterEach(() => vi.restoreAllMocks());

describe("UI.1 German entry", () => {
  it("explains the purpose and offers one primary demo action", () => {
    const html = renderToStaticMarkup(createElement(Home));
    expect(html).toContain("<h1>Alumni CareerMap</h1>");
    expect(html).toContain("welche Wege nach dem Studium möglich sind");
    expect(html).toMatch(/<a[^>]*href="\/review"[^>]*>Beispiel-Karriereweg ansehen<\/a>/);
    expect(html.match(/<a\b/g)).toHaveLength(1);
    expect(html).toContain("fiktiven Daten");
    expect(html).not.toMatch(/<(form|button|input)\b|href="[^" ]*(linkedin|upload|einwilligung|dashboard)\b/i);
  });

  it("provides German document language, a skip link and visible demo context", () => {
    const html = renderToStaticMarkup(createElement(RootLayout, null, createElement(Home)));
    expect(html).toContain('<html lang="de">');
    expect(html).toMatch(/<a[^>]*href="#inhalt"[^>]*>Zum Inhalt<\/a>/);
    expect(html).toContain('id="inhalt"');
    expect(html).toContain("Fiktives Beispiel");
    expect(html.match(/<main\b/g)).toHaveLength(1);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });

  it("previews every fixture observation exactly once using the real adapter", () => {
    const adapt = vi.spyOn(adapter, "adaptLinkedInSnapshot");
    const html = renderToStaticMarkup(createElement(Home));
    expect(adapt).toHaveBeenCalledWith(snapshot);
    const cards = [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].map(match => match[1]);
    expect(cards).toHaveLength(4);
    const expected = [
      ["Synthetic Research Assistant", "Synthetic University", "Positionsangabe"],
      ["Synthetic Internship", "Synthetic Workshop", "Positionsangabe"],
      ["Synthetic M.Sc.", "Synthetic University", "Ausbildungsangabe"],
      ["Synthetic Short Course", "Synthetic Workshop", "Ausbildungsangabe"],
    ];
    expected.forEach(([title, provider, category], index) => {
      expect(html.split(title)).toHaveLength(2);
      expect(cards[index]).toContain(provider);
      expect(cards[index]).toContain(category);
      expect(cards[index]).toContain("Zu prüfen");
    });
    expect(html).toContain("So kann ein Karriereweg aussehen");
    expect(html).toContain("keine bestätigte zeitliche Reihenfolge");
  });

  it("preserves source dates and uncertainty in the preview", () => {
    const html = renderToStaticMarkup(createElement(Home));
    expect(html).toContain('<time dateTime="2023-03">März 2023</time>');
    expect(html).toContain('<time dateTime="2019">2019</time>');
    expect(html).toContain('<time dateTime="2020-02">Februar 2020</time>');
    expect(html).toContain("around 2018");
    expect(html).toContain("ungenaue Angabe");
    expect(html.match(/Ende nicht angegeben/g)).toHaveLength(2);
    expect(html).not.toMatch(/Seit 2023|bis heute|2023-03-01|Abgeschlossen|Laufend|COMPLETED|ONGOING/);
  });

  it("keeps PROFILE, excluded metadata, IDs and raw enums out of preview HTML", () => {
    const html = renderToStaticMarkup(createElement(Home));
    for (const value of Object.values(snapshot.elements[0].snapshotData[0])) expect(html).not.toContain(value);
    expect(html).not.toMatch(/FICTIONAL_|fictional-private|snapshot:|PROFILE|POSITIONS|EDUCATION|ASSERTED|OBSERVED|REVIEW_REQUIRED/);
    expect(html).not.toMatch(/<pre\b|<script\b|Description|Activities|Member ID|Position ID|Education ID/);
  });

  it("projects only observed fields even if additional assertions exist", () => {
    const input = adapter.adaptLinkedInSnapshot(snapshot);
    Object.assign(input.stations[0], {
      classification: { kind: "ASSERTED", value: { type: "CAREER_STEP", careerStepType: "EMPLOYMENT" } },
      temporalStatus: { kind: "ASSERTED", value: "ONGOING" },
      position: { kind: "ASSERTED", value: 71 },
      catalog: { kind: "CONFIRMED", identity: { entity: "ORGANISATION", id: "00000000-0000-4000-8000-000000000071" }, confirmation: "EXPLICIT_SELECTION" },
    });
    input.stations[2].title = { kind: "ASSERTED", value: "ASSERTED_TITLE_NOT_OBSERVED" };
    vi.spyOn(adapter, "adaptLinkedInSnapshot").mockReturnValue(input);
    const html = renderToStaticMarkup(createElement(Home));
    expect(html).toContain("Synthetic Research Assistant");
    expect(html).not.toMatch(/00000000-0000|EMPLOYMENT|ONGOING|value="71"|ASSERTED_TITLE_NOT_OBSERVED|Zugeordnet/);
    expect(html.match(/Zu prüfen/g)).toHaveLength(4);
  });

  it("explains three planned steps and labels the result step as future functionality", () => {
    const html = renderToStaticMarkup(createElement(Home));
    const process = /<ol[^>]*aria-label="Geplanter Ablauf"[^>]*>([\s\S]*?)<\/ol>/.exec(html)?.[1] ?? "";
    const steps = [...process.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map(match => match[1]);
    expect(steps).toHaveLength(3);
    expect(steps[0]).toContain("Angaben übernehmen");
    expect(steps[1]).toContain("Stationen prüfen");
    expect(steps[2]).toContain("Karrierewege sichtbar machen");
    expect(steps[2]).toContain("Zukünftig");
    expect(html.match(/<section\b[^>]*aria-labelledby=/g)).toHaveLength(2);
    expect(html.match(/<h2\b/g)).toHaveLength(2);
    expect(html).not.toMatch(/<(form|input|button|select)\b/);
  });

  it("keeps the entry navigable with a redacted preview fallback", () => {
    vi.spyOn(adapter, "adaptLinkedInSnapshot").mockImplementationOnce(() => { throw new Error("PRIVATE_ERROR_MARKER"); });
    const html = renderToStaticMarkup(createElement(Home));
    expect(html).toContain("Beispiel derzeit nicht verfügbar");
    expect(html).toContain('href="/review"');
    expect(html).not.toContain("PRIVATE_ERROR_MARKER");
  });
});
