import test from "node:test";
import assert from "node:assert/strict";

import { resolveActiveRailHref } from "./rail-active";

/**
 * R6 — kunci parity aturan aktif ketiga nav lama yang digantikan AppRail:
 * NavOuter (StudioFlow), MasterDataNavOuter, dan BqNavOuter (dengan logika
 * custom `/bq`-nya). Semantiknya: exact match menang, lalu prefix terpanjang.
 */

test("empty item list resolves to nothing", () => {
  assert.equal(resolveActiveRailHref("/", []), null);
});

test("StudioFlow: '/' is exact-only (Tasks active only on '/')", () => {
  const hrefs = ["/projects", "/", "/upcoming", "/library", "/settings"];
  assert.equal(resolveActiveRailHref("/", hrefs), "/");
  // Prefix-match untuk "/" dilarang: halaman mana pun tidak boleh
  // mengaktifkan Tasks.
  assert.equal(resolveActiveRailHref("/projects/p1", hrefs), "/projects");
  assert.equal(resolveActiveRailHref("/upcoming", hrefs), "/upcoming");
  assert.equal(resolveActiveRailHref("/settings", hrefs), "/settings");
});

test("StudioFlow: nested project route activates Projects, not Tasks", () => {
  const hrefs = ["/projects", "/", "/upcoming"];
  assert.equal(resolveActiveRailHref("/projects/abc/schedule", hrefs), "/projects");
});

test("MasterData: plain startsWith semantics preserved per section", () => {
  const hrefs = [
    "/masterdata/materials",
    "/masterdata/skus",
    "/masterdata/suppliers",
    "/masterdata/prices",
    "/masterdata/samples",
    "/masterdata/settings",
  ];
  for (const href of hrefs) {
    assert.equal(resolveActiveRailHref(href, hrefs), href);
  }
  assert.equal(
    resolveActiveRailHref("/masterdata/materials/brand-123", hrefs),
    "/masterdata/materials"
  );
});

test("BQ: '/bq' exact and detail route activate Breakdowns", () => {
  const hrefs = ["/bq", "/bq/library"];
  assert.equal(resolveActiveRailHref("/bq", hrefs), "/bq");
  assert.equal(resolveActiveRailHref("/bq/proj-1", hrefs), "/bq");
});

test("BQ: library route wins by longest prefix over Breakdowns", () => {
  const hrefs = ["/bq", "/bq/library"];
  assert.equal(resolveActiveRailHref("/bq/library", hrefs), "/bq/library");
  assert.equal(resolveActiveRailHref("/bq/library/x", hrefs), "/bq/library");
});

test("unknown pathname under no nav root resolves to null", () => {
  assert.equal(resolveActiveRailHref("/login", ["/projects", "/"]), null);
});
