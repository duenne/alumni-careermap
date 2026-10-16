import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import snapshot from "../../test-fixtures/linkedin-snapshots/fictional-member.json";
import * as adapter from "../../lib/normalization/adapt-linkedin-snapshot";
import type { NormalizationInput } from "../../lib/normalization/contract";
import CareerReview from "./career-review";
import ReviewPage from "./page";

const render = (input: NormalizationInput = adapter.adaptLinkedInSnapshot(snapshot)) =>
  renderToStaticMarkup(createElement(CareerReview, { input }));
const articles = (html: string) => [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].map(match => match[1]);

afterEach(() => vi.restoreAllMocks());

describe("UI.1 read-only career observations", () => {
  it("uses the real adapter in the example route", () => {
    const adapt = vi.spyOn(adapter, "adaptLinkedInSnapshot");
    const html = renderToStaticMarkup(createElement(ReviewPage));
    expect(adapt).toHaveBeenCalledWith(snapshot);
    expect(articles(html)).toHaveLength(4);
    expect(html).toContain("Ein Beispiel-Karriereweg");
    expect(html).toContain("fiktiven Daten");
  });

  it("shows all source titles and organisation labels in traversal order", () => {
    const html = render();
    const cards = articles(html);
    expect(cards).toHaveLength(4);
    const expected = [
      ["Synthetic Research Assistant", "Synthetic University"],
      ["Synthetic Internship", "Synthetic Workshop"],
      ["Synthetic M.Sc.", "Synthetic University"],
      ["Synthetic Short Course", "Synthetic Workshop"],
    ];
    expected.forEach(([title, organisation], index) => {
      expect(cards[index]).toContain(title);
      expect(html.split(title)).toHaveLength(2);
      expect(cards[index]).toContain(organisation);
      expect(cards[index]).toContain("Zu prüfen");
    });
  });

  it("distinguishes observed facts, open decisions and a future review action", () => {
    const html = render();
    expect(html).toContain("Beobachtet");
    expect(html).toContain("Noch offen");
    expect(html).toContain("keine bestätigte zeitliche Reihenfolge");
    expect(html).toContain("Als Nächstes: Angaben selbst prüfen");
    expect(html).toContain("Künftig können Sie jede Station prüfen");
    expect(html).toContain("In dieser Demo bleiben alle Angaben unverändert");
    expect(html).not.toMatch(/<(form|button|input|select)\b|RESOLVED_|CLASSIFICATION_UNCERTAIN|<pre\b/);
  });

  it("labels source domains without asserting a Degree or employment classification", () => {
    const cards = articles(render());
    expect(cards.slice(0, 2).every(card => card.includes("Positionsangabe"))).toBe(true);
    expect(cards.slice(2).every(card => card.includes("Ausbildungsangabe"))).toBe(true);
    expect(render()).toContain("Noch keine Angabe bestätigt");
    expect(render()).not.toMatch(/Masterabschluss|RESOLVED_DEGREE|COMPLETED|ONGOING|Abgeschlossen|Laufend|Referenzabschluss ausgewählt/);
  });

  it("preserves month/year precision and imprecise source text without inventing dates", () => {
    const cards = articles(render());
    expect(cards[0]).toContain('<time dateTime="2023-03">März 2023</time>');
    expect(cards[1]).toContain('<time dateTime="2019">2019</time>');
    expect(cards[1]).toContain('<time dateTime="2020-02">Februar 2020</time>');
    expect(cards[2]).toContain('<time dateTime="2022">2022</time>');
    expect(cards[3]).toContain("around 2018");
    expect(cards[3]).toContain("ungenaue Angabe");
    expect(cards[3]).not.toContain("<time");
    expect(render()).not.toMatch(/2023-03-01|2019-01-01|Seit 2023|bis heute/);
  });

  it("shows absent end dates explicitly, without inferring ongoing status", () => {
    const cards = articles(render());
    expect(cards[0]).toContain("Ende nicht angegeben");
    expect(cards[3]).toContain("Ende nicht angegeben");
    expect(cards[0]).not.toMatch(/laufend|aktuell beschäftigt|ongoing/i);
  });

  it("does not promote supplied assertions into observed facts or leak catalog IDs", () => {
    const input = adapter.adaptLinkedInSnapshot(snapshot);
    Object.assign(input.stations[2], {
      classification: { kind: "ASSERTED", value: { type: "DEGREE", level: "MASTER" } },
      degreeStatus: { kind: "ASSERTED", value: "COMPLETED" },
      position: { kind: "ASSERTED", value: 71 },
      catalog: { kind: "CONFIRMED", identity: { entity: "PROGRAM", id: "00000000-0000-4000-8000-000000000071" }, confirmation: "EXPLICIT_SELECTION" },
    });
    const html = render(input);
    expect(articles(html)[2]).toContain("Ausbildungsangabe");
    expect(html).not.toMatch(/00000000-0000|COMPLETED|MASTER|Zugeordnet|value="71"/);
    input.stations[2].title = { kind: "ASSERTED", value: "ASSERTED_TITLE_NOT_OBSERVED" };
    expect(render(input)).not.toContain("ASSERTED_TITLE_NOT_OBSERVED");
  });

  it("omits every PROFILE value, excluded metadata, provider ID and source key", () => {
    const html = renderToStaticMarkup(createElement(ReviewPage));
    for (const value of Object.values(snapshot.elements[0].snapshotData[0])) {
      expect(html).not.toContain(value);
    }
    expect(html).not.toMatch(/FICTIONAL_|fictional-private|snapshot:|Position ID|Education ID|Member ID|Profile URL|@example\.invalid/);
    for (const element of snapshot.elements.slice(1)) {
      for (const record of element.snapshotData) {
        for (const [key, value] of Object.entries(record)) {
          if (["Description", "Location", "Activities", "Notes", "Position ID", "Education ID"].includes(key) && value) {
            expect(html).not.toContain(value);
          }
        }
      }
    }
  });

  it("offers navigation only, without review controls or a saving/confirmation action", () => {
    const html = render();
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*>Zur Startseite<\/a>/);
    expect(html).not.toMatch(/<(form|input|select|textarea|button)\b/);
    expect(html).not.toMatch(/href="[^" ]*(linkedin|upload|einwilligung|api)\b/i);
  });

  it("uses one main heading, a named list and heading-labelled station articles", () => {
    const html = render();
    expect(html.match(/<main\b/g)).toHaveLength(1);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toMatch(/<ul[^>]*aria-label="Angaben in Quellenreihenfolge"/);
    const cards = [...html.matchAll(/<article\b[^>]*aria-labelledby="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)];
    expect(cards).toHaveLength(4);
    cards.forEach(([, id, card]) => expect(card).toContain(`<h3 id="${id}">`));
    expect(html.match(/<dt>Beginn laut Quelle<\/dt>/g)).toHaveLength(4);
  });

  it("has an honest empty state", () => {
    const html = render({ stations: [] });
    expect(html).toContain("Keine Stationsangaben vorhanden");
    expect(articles(html)).toHaveLength(0);
    expect(html).not.toMatch(/<(form|button)\b/);
  });

  it("keeps missing and explicitly unknown source facts distinguishable", () => {
    const input = adapter.adaptLinkedInSnapshot(snapshot);
    Object.assign(input.stations[0], {
      title: { kind: "MISSING" }, providerLabel: { kind: "MISSING" },
      start: { kind: "UNKNOWN", origin: "OBSERVED" },
    });
    const card = articles(render(input))[0];
    expect(card).toContain("Bezeichnung nicht angegeben");
    expect(card).toContain("Organisation nicht angegeben");
    expect(card).toContain("Beginn unbekannt");
  });

  it("escapes observed text and preserves input immutability", () => {
    const input = adapter.adaptLinkedInSnapshot(snapshot);
    input.stations[0].title = { kind: "OBSERVED", value: '<script>alert("fictional")</script>' };
    const before = structuredClone(input);
    const html = render(input);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(input).toEqual(before);
  });

  it("shows a redacted error and return link if the fixed demo cannot be adapted", () => {
    vi.spyOn(adapter, "adaptLinkedInSnapshot").mockImplementationOnce(() => { throw new Error("PRIVATE_ERROR_MARKER"); });
    const html = renderToStaticMarkup(createElement(ReviewPage));
    expect(html).toContain("Beispiel derzeit nicht verfügbar");
    expect(html).toContain('href="/"');
    expect(html).not.toContain("PRIVATE_ERROR_MARKER");
  });
});
