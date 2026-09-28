/* Aircraft catalogue service.
   The UI never fetches data/aircraft.json itself; it calls these functions.
   To move to a real data service, change loadCatalogue() to call the API and
   keep returning the same record shape. Search and filters are pure, so they
   are unit tested in test/data.test.mjs. */
import { DATA_SOURCES } from "./config.js";

export const STATES = ["verified", "reported", "unverified", "unknown"];

export const STATE_TEXT = {
  verified: "Directly supported by a reliable source.",
  reported: "Supported by a credible secondary source.",
  unverified: "A claim exists but has not been substantiated.",
  unknown: "Insufficient evidence."
};

let cache = null;

export async function loadCatalogue() {
  if (!cache) {
    cache = fetch(DATA_SOURCES.aircraft, { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("Catalogue request failed with status " + res.status);
        return res.json();
      })
      .then(normaliseCatalogue)
      .catch(function (err) {
        cache = null;
        throw err;
      });
  }
  return cache;
}

export function normaliseCatalogue(raw) {
  const list = Array.isArray(raw) ? raw : (raw && raw.aircraft) || [];
  return {
    dataset: (raw && raw.dataset) || { demo: false },
    aircraft: list.map(function (a) {
      return Object.assign({ evidence: [], attestations: [], history: [], specs: [], verification: {} }, a);
    })
  };
}

/* Collapse registrations and serials so "n650tr", "N 650 TR" and "N650TR" match. */
export function squash(value) {
  return String(value == null ? "" : value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/* Overall state of a record = the weakest state among its identity fields. */
export function overallState(aircraft) {
  const keys = ["registration", "msn", "year", "status"];
  let worst = 0;
  keys.forEach(function (k) {
    const s = STATES.indexOf((aircraft.verification || {})[k] || "unknown");
    if (s > worst) worst = s;
  });
  return STATES[worst];
}

export const SEARCH_FIELDS = {
  any: "All fields",
  registration: "Registration",
  model: "Model",
  manufacturer: "Manufacturer",
  msn: "Serial / MSN"
};

export function searchAircraft(list, query, options) {
  options = options || {};
  const field = options.field || "any";
  const q = String(query || "").trim();
  const sq = squash(q);
  const lower = q.toLowerCase();

  function hit(a) {
    if (!q) return true;
    const byField = {
      registration: function () { return squash(a.registration).indexOf(sq) >= 0; },
      msn: function () { return squash(a.msn).indexOf(sq) >= 0; },
      model: function () { return a.model.toLowerCase().indexOf(lower) >= 0 || squash(a.model).indexOf(sq) >= 0; },
      manufacturer: function () { return a.manufacturer.toLowerCase().indexOf(lower) >= 0; }
    };
    if (field !== "any") return byField[field] ? byField[field]() : false;
    return Object.keys(byField).some(function (k) { return byField[k](); }) ||
      (a.manufacturer + " " + a.model).toLowerCase().indexOf(lower) >= 0;
  }

  function score(a) {
    if (!q) return 0;
    if (squash(a.registration) === sq) return 3;
    if (squash(a.registration).indexOf(sq) === 0) return 2;
    return 1;
  }

  return list
    .filter(hit)
    .filter(function (a) { return !options.manufacturer || a.manufacturer === options.manufacturer; })
    .filter(function (a) { return !options.category || a.category === options.category; })
    .filter(function (a) { return !options.status || a.status === options.status; })
    .filter(function (a) { return !options.state || overallState(a) === options.state; })
    .map(function (a, i) { return { a: a, s: score(a), i: i }; })
    .sort(function (x, y) {
      if (y.s !== x.s) return y.s - x.s;
      if (options.sort === "year") return y.a.year - x.a.year || x.i - y.i;
      if (options.sort === "manufacturer") return (x.a.manufacturer + x.a.model).localeCompare(y.a.manufacturer + y.a.model);
      return x.a.registration.localeCompare(y.a.registration);
    })
    .map(function (x) { return x.a; });
}

export function facets(list) {
  function uniq(key) {
    return Array.from(new Set(list.map(function (a) { return a[key]; }))).sort();
  }
  return { manufacturer: uniq("manufacturer"), category: uniq("category"), status: uniq("status") };
}

export function findAircraft(list, key) {
  const k = squash(key);
  if (!k) return null;
  return list.find(function (a) {
    return squash(a.registration) === k || squash(a.assetId) === k || squash(a.msn) === k;
  }) || null;
}

export function findEvidence(list, query) {
  const q = String(query || "").trim().toLowerCase();
  const out = [];
  list.forEach(function (a) {
    a.evidence.forEach(function (e) {
      if (!q || e.hash.toLowerCase() === q || e.id.toLowerCase() === q || squash(e.reference) === squash(q) ||
          squash(a.registration) === squash(q) || squash(a.assetId) === squash(q)) {
        out.push({ aircraft: a, evidence: e });
      }
    });
  });
  return out;
}

export function findAttestations(list, query) {
  const q = String(query || "").trim().toLowerCase();
  const out = [];
  list.forEach(function (a) {
    a.attestations.forEach(function (t) {
      if (!q || t.id.toLowerCase() === q || squash(a.registration) === squash(q) || squash(a.assetId) === squash(q) ||
          (t.issuer || "").toLowerCase().indexOf(q) >= 0 || t.type.toLowerCase().indexOf(q) >= 0) {
        out.push({ aircraft: a, attestation: t });
      }
    });
  });
  return out;
}
