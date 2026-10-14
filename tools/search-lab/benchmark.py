#!/usr/bin/env python3
"""Reproducible offline comparison. Writes ONLY dedicated lab indexes."""

import argparse
import concurrent.futures
import hashlib
import http.client
import json
import math
import random
import re
import statistics
import subprocess
import threading
import time
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent
p = argparse.ArgumentParser()
p.add_argument("--snapshot", required=True)
p.add_argument("--keyboard", required=True)
p.add_argument("--output", required=True)
p.add_argument("--skip-index", action="store_true")
p.add_argument("--probes", nargs="*")
args = p.parse_args()
S = json.load(open(args.snapshot))
CASES = json.load(open(ROOT / "cases.json"))
ALIASES = json.load(open(ROOT / "aliases.json"))
KEYBOARD = json.load(open(args.keyboard))
ALIASES.update({"fromis_9": "프로미스나인", "에리카": "ERICA"})


def address(name, port):
    ip = subprocess.check_output(
        [
            "docker",
            "inspect",
            name,
            "--format",
            "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}",
        ],
        text=True,
    ).strip()
    return f"{ip}:{port}"


M = address("fromlog-search-lab-meilisearch", 7700)
O = address("fromlog-search-lab-opensearch", 9200)
local = threading.local()


def req(server, method, path, data=None, ndjson=False):
    if not hasattr(local, "connections"):
        local.connections = {}
    if server not in local.connections:
        local.connections[server] = http.client.HTTPConnection(server, timeout=45)
    body = (
        data
        if ndjson
        else None if data is None else json.dumps(data, ensure_ascii=False).encode()
    )
    c = local.connections[server]
    c.request(
        method,
        path,
        body,
        {"Content-Type": "application/x-ndjson" if ndjson else "application/json"},
    )
    r = c.getresponse()
    raw = r.read()
    out = json.loads(raw) if raw else {}
    if r.status >= 400:
        raise RuntimeError(f"{method} {path} HTTP {r.status}: {str(out)[:1500]}")
    return out


def task(r):
    start = time.perf_counter()
    while True:
        s = req(M, "GET", f'/tasks/{r["taskUid"]}')
        if s["status"] == "succeeded":
            return
        if s["status"] in ["failed", "canceled"]:
            raise RuntimeError(s)
        if time.perf_counter() - start > 120:
            raise TimeoutError(s)
        time.sleep(0.05)


def compact(s):
    return re.sub(r"[^\w가-힣]", "", unicodedata.normalize("NFC", s).lower()).replace(
        "_", ""
    )


EXTRAS = {int(x["id"]): x for x in S["extras"]}
RAW = S["documents"]
ENRICHED = []
for d in RAW:
    e = EXTRAS[d["id"]]
    r = {
        **d,
        "description": e["description"] or "",
        "source_name": " ".join(
            filter(None, [d["source_name"], e["broadcaster"], e["school_name"]])
        ),
    }
    ENRICHED.append(
        {
            k: unicodedata.normalize("NFC", v) if isinstance(v, str) else v
            for k, v in r.items()
        }
    )
BY_ID = {d["id"]: d for d in ENRICHED}
INDEXING = {}


def make_os(name, tuned=False, standard=False):
    analysis = {
        "tokenizer": {
            "ko_tokenizer": {"type": "nori_tokenizer", "decompound_mode": "mixed"}
        },
        "analyzer": {
            "ko": {
                "type": "custom",
                "tokenizer": "ko_tokenizer",
                "filter": [
                    "nori_part_of_speech",
                    "nori_readingform",
                    "lowercase",
                    "cjk_width",
                ],
            }
        },
    }
    fields = {
        k: {"type": "text", "analyzer": "standard" if standard else "ko"}
        for k in ["title", "description", "source_name", "category_name"]
    }
    if tuned:
        analysis["char_filter"] = {
            "compact_chars": {
                "type": "pattern_replace",
                "pattern": "[^\\p{L}\\p{N}]",
                "replacement": "",
            }
        }
        analysis["filter"] = {"grams": {"type": "ngram", "min_gram": 2, "max_gram": 12}}
        analysis["analyzer"].update(
            {
                "compact_index": {
                    "type": "custom",
                    "char_filter": ["compact_chars"],
                    "tokenizer": "keyword",
                    "filter": ["lowercase", "grams"],
                },
                "compact_search": {
                    "type": "custom",
                    "char_filter": ["compact_chars"],
                    "tokenizer": "keyword",
                    "filter": ["lowercase"],
                },
            }
        )
        for k in ["title", "source_name"]:
            fields[k]["fields"] = {
                "compact": {
                    "type": "text",
                    "analyzer": "compact_index",
                    "search_analyzer": "compact_search",
                },
                "literal": {"type": "text", "analyzer": "standard"},
            }
    fields.update(
        {
            "id": {"type": "integer"},
            "date": {"type": "date", "format": "yyyy-MM-dd"},
            "time": {"type": "keyword"},
            "category_id": {"type": "integer"},
            "category_color": {"type": "keyword"},
        }
    )
    return {
        "settings": {
            "number_of_shards": 1,
            "number_of_replicas": 0,
            "refresh_interval": "-1",
            "index.max_ngram_diff": 10,
            "analysis": analysis,
        },
        "mappings": {"dynamic": False, "properties": fields},
    }


if not args.skip_index:
    for name, tuned in [
        ("lab-current", False),
        ("lab-meili-tuned", True),
        ("lab-meili-enriched", False),
    ]:
        try:
            req(M, "DELETE", f"/indexes/{name}")
        except RuntimeError:
            pass
        task(req(M, "POST", "/indexes", {"uid": name, "primaryKey": "id"}))
        settings = dict(S["settings"])
        if tuned:
            settings["typoTolerance"] = {
                **settings["typoTolerance"],
                "minWordSizeForTypos": {"oneTypo": 2, "twoTypos": 4},
                "disableOnNumbers": True,
            }
            settings["dictionary"] = []
        task(req(M, "PATCH", f"/indexes/{name}/settings", settings))
        start = time.perf_counter()
        task(
            req(
                M,
                "POST",
                f"/indexes/{name}/documents",
                ENRICHED if tuned or name == "lab-meili-enriched" else RAW,
            )
        )
        INDEXING[name] = (time.perf_counter() - start) * 1000
    for name, tuned, standard in [
        ("lab-nori", False, False),
        ("lab-standard-tuned", True, True),
        ("lab-nori-tuned", True, False),
    ]:
        try:
            req(O, "DELETE", f"/{name}")
        except RuntimeError:
            pass
        req(O, "PUT", f"/{name}", make_os(name, tuned, standard))
        start = time.perf_counter()
        docs = ENRICHED if tuned else RAW
        bulk = "".join(
            json.dumps({"index": {"_id": d["id"]}})
            + "\n"
            + json.dumps(d, ensure_ascii=False)
            + "\n"
            for d in docs
        ).encode()
        r = req(O, "POST", f"/{name}/_bulk", bulk, True)
        if r.get("errors"):
            raise RuntimeError([i for i in r["items"] if i["index"].get("error")][:2])
        req(O, "POST", f"/{name}/_refresh")
        req(O, "PUT", f"/{name}/_settings", {"index": {"refresh_interval": "1s"}})
        INDEXING[name] = (time.perf_counter() - start) * 1000

CATEGORIES = {d["category_name"]: d["category_id"] for d in RAW}


def in_filter(d, case):
    return (
        (not case.get("category") or d["category_name"] == case["category"])
        and (not case.get("from") or d["date"] >= case["from"])
        and (not case.get("to") or d["date"] <= case["to"])
    )


def grade(d, case):
    if not in_filter(d, case):
        return 0

    def matches(text):
        return all(
            any(compact(t) in compact(text) for t in alts) for alts in case["terms"]
        )

    if matches(d["title"]):
        return 3
    if matches(d["title"] + " " + d["source_name"]):
        return 2
    return (
        1
        if matches(d["title"] + " " + d["source_name"] + " " + d["description"])
        else 0
    )


QRELS = {
    c["q"]
    + "|"
    + str(c.get("category", "")): {
        d["id"]: grade(d, c) for d in ENRICHED if grade(d, c) > 0
    }
    for c in CASES
}
for c in CASES:
    truth = QRELS[c["q"] + "|" + str(c.get("category", ""))]
    if c.get("zero"):
        assert not truth, (c, truth)
    else:
        assert truth, ("No positive judgments", c)


def variants(q, tuned):
    out = [q]
    if tuned:
        if q in ALIASES and ALIASES[q] != q:
            out.append(ALIASES[q])
    else:
        if q in KEYBOARD:
            out.append(KEYBOARD[q])
    out.extend(s for s in S["schools"] if q.lower() in s.lower() and s not in out)
    return out


def meili_search(case, tuned=False, limit=20, enriched=False):
    name = (
        "lab-meili-enriched"
        if enriched
        else "lab-meili-tuned" if tuned else "lab-current"
    )
    q = case["q"]
    qs = variants(q, tuned)
    allhits = {}
    opts = {"limit": limit if tuned else 10000, "showRankingScore": True}
    if tuned:
        opts["matchingStrategy"] = "all"
        filters = []
        if case.get("category"):
            filters.append(f'category_id = {CATEGORIES[case["category"]]}')
        if case.get("from"):
            filters.append(f'date >= "{case["from"]}"')
        if case.get("to"):
            filters.append(f'date <= "{case["to"]}"')
        if filters:
            opts["filter"] = filters

    def run(query):
        r = req(M, "POST", f"/indexes/{name}/search", {"q": query, **opts})
        for d in r["hits"]:
            if d["_rankingScore"] < S["minScore"] or not in_filter(
                BY_ID[d["id"]], case
            ):
                continue
            if (
                d["id"] not in allhits
                or d["_rankingScore"] > allhits[d["id"]]["_rankingScore"]
            ):
                allhits[d["id"]] = d

    for query in qs:
        run(query)
    if tuned and not allhits and q in KEYBOARD:
        run(KEYBOARD[q])
    if (
        tuned
        and not allhits
        and len(q.split()) == 1
        and len(q) >= 3
        and not re.search(r"\d", q)
    ):
        opts["matchingStrategy"] = "last"
        for query in qs:
            run(query)
    hits = sorted(
        allhits.values(),
        key=lambda d: (d["_rankingScore"], d["date"], d.get("time", ""), d["id"]),
        reverse=True,
    )
    return [d["id"] for d in hits[:limit]]


def os_search(case, tuned=False, standard=False, limit=20):
    name = (
        "lab-standard-tuned" if standard else "lab-nori-tuned" if tuned else "lab-nori"
    )
    filters = []
    if case.get("category"):
        filters.append({"term": {"category_id": CATEGORIES[case["category"]]}})
    if case.get("from") or case.get("to"):
        filters.append(
            {
                "range": {
                    "date": {
                        **({"gte": case["from"]} if case.get("from") else {}),
                        **({"lte": case["to"]} if case.get("to") else {}),
                    }
                }
            }
        )

    def run(qs, fuzzy=False):
        should = []
        for q in qs:
            should.append(
                {
                    "multi_match": {
                        "query": q,
                        "fields": (
                            ["title.literal^4", "source_name.literal^2"]
                            if fuzzy and tuned
                            else [
                                "title^4",
                                "source_name^2",
                                "description",
                                "category_name",
                            ]
                        ),
                        "type": "best_fields" if fuzzy else "cross_fields",
                        "operator": "and",
                        **(
                            {"fuzziness": "AUTO:3,6", "prefix_length": 1}
                            if fuzzy
                            else {}
                        ),
                    }
                }
            )
            if tuned and not fuzzy:
                should.extend(
                    [
                        {
                            "multi_match": {
                                "query": q,
                                "fields": ["title.literal^4", "source_name.literal^2"],
                                "operator": "and",
                            }
                        },
                        {"match_phrase": {"title": {"query": q, "boost": 8}}},
                        {
                            "multi_match": {
                                "query": q,
                                "fields": ["title.compact^5", "source_name.compact^2"],
                                "operator": "and",
                            }
                        },
                    ]
                )
        body = {
            "size": limit,
            "track_total_hits": True,
            "_source": ["id"],
            "query": {
                "bool": {"filter": filters, "should": should, "minimum_should_match": 1}
            },
            "sort": [
                {"_score": "desc"},
                {"date": "desc"},
                {"time": "desc"},
                {"id": "desc"},
            ],
        }
        r = req(O, "POST", f"/{name}/_search", body)
        assert not r.get("timed_out") and r["_shards"]["failed"] == 0, r
        return [x["_source"]["id"] for x in r["hits"]["hits"]]

    qs = variants(case["q"], tuned) if tuned else [case["q"]]
    hits = run(qs)
    if tuned and not hits and case["q"] in KEYBOARD:
        hits = run([KEYBOARD[case["q"]]])
    if tuned and not hits and not re.search(r"\d", case["q"]):
        hits = run(qs, True)
    return hits


ENGINES = {
    "meili_enriched": lambda c, n: meili_search(c, False, n, True),
    "current": lambda c, n: meili_search(c, False, n),
    "meili_tuned": lambda c, n: meili_search(c, True, n),
    "nori_basic": lambda c, n: os_search(c, False, False, n),
    "standard_tuned": lambda c, n: os_search(c, True, True, n),
    "nori_tuned": lambda c, n: os_search(c, True, False, n),
}
if args.probes:
    probes = {
        q: {name: fn({"q": q}, 20) for name, fn in ENGINES.items()} for q in args.probes
    }
    Path(args.output).write_text(json.dumps(probes, ensure_ascii=False, indent=2))
    print(json.dumps(probes, ensure_ascii=False))
    raise SystemExit(0)


def metrics(ids, truth):
    def dcg(values):
        return sum((2**x - 1) / math.log2(i + 2) for i, x in enumerate(values))

    if not truth:
        return {"unexpected": len(ids)}
    ideal = dcg(sorted(truth.values(), reverse=True)[:10])
    k = min(5, len(truth))
    return {
        "hit5": int(any(i in truth for i in ids[:5])),
        "p5_normalized": sum(i in truth for i in ids[:k]) / k,
        "ndcg10": dcg([truth.get(i, 0) for i in ids[:10]]) / ideal,
        "recall10": sum(i in truth for i in ids[:10]) / len(truth),
        "recall_all": sum(i in truth for i in ids) / len(truth),
    }


RESULTS = []
for c in CASES:
    truth = QRELS[c["q"] + "|" + str(c.get("category", ""))]
    r = {"case": c, "relevant": len(truth), "results": {}}
    for name, fn in ENGINES.items():
        ids = fn(c, 10000)
        r["results"][name] = {
            "metrics": metrics(ids, truth),
            "total": len(ids),
            "top": [
                {
                    "id": i,
                    "title": BY_ID[i]["title"],
                    "date": BY_ID[i]["date"],
                    "grade": truth.get(i, 0),
                }
                for i in ids[:10]
            ],
        }
    RESULTS.append(r)
    print(
        c["q"],
        c.get("category", ""),
        {
            n: round(v["metrics"].get("ndcg10", v["metrics"].get("unexpected", 0)), 3)
            for n, v in r["results"].items()
        },
        flush=True,
    )


def percentile(a, p):
    return sorted(a)[min(len(a) - 1, math.ceil(len(a) * p) - 1)]


def timing(values):
    return {
        "n": len(values),
        "p50_ms": statistics.median(values),
        "p95_ms": percentile(values, 0.95),
        "max_ms": max(values),
    }


# Warm up all engines, then interleave requests in a fixed random order.
for fn in ENGINES.values():
    for c in CASES:
        fn(c, 20)
LAT = {name: [] for name in ENGINES}
jobs = [(name, c) for _ in range(6) for c in CASES for name in ENGINES]
random.Random(42).shuffle(jobs)
for name, c in jobs:
    start = time.perf_counter()
    ENGINES[name](c, 20)
    LAT[name].append((time.perf_counter() - start) * 1000)
CONCURRENT = {}
for name, fn in ENGINES.items():

    def run(c):
        start = time.perf_counter()
        fn(c, 20)
        return (time.perf_counter() - start) * 1000

    start = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        values = list(pool.map(run, CASES * 4))
    CONCURRENT[name] = {
        **timing(values),
        "requests_per_second": len(values) / (time.perf_counter() - start),
    }
SUMMARY = {}
for name in ENGINES:
    vals = [r["results"][name]["metrics"] for r in RESULTS if r["relevant"]]
    SUMMARY[name] = {k: statistics.mean(v[k] for v in vals) for k in vals[0]}
    SUMMARY[name]["empty_correct"] = sum(
        r["results"][name]["total"] == 0 for r in RESULTS if not r["relevant"]
    )
ANALYSIS = {}
for name in ["lab-nori", "lab-nori-tuned", "lab-standard-tuned"]:
    ANALYSIS[name] = {
        q: [
            t["token"]
            for t in req(O, "POST", f"/{name}/_analyze", {"field": "title", "text": q})[
                "tokens"
            ]
        ]
        for q in [
            "박지원이",
            "이채영의",
            "계약결혼",
            "아는형님",
            "워크돌",
            "건대",
            "호서대학교",
            "프로미스나인",
            "방판소녀들 시즌2",
        ]
    }
STATS = {
    "meili": req(M, "GET", "/stats"),
    "opensearch": req(O, "GET", "/_stats/store,docs"),
    "nodes": req(O, "GET", "/_nodes/stats/jvm,process,indices"),
}
out = {
    "snapshotAt": S["capturedAt"],
    "snapshotSha256": hashlib.sha256(Path(args.snapshot).read_bytes()).hexdigest(),
    "documentCount": len(RAW),
    "cases": len(CASES),
    "positiveCases": sum(bool(v) for v in QRELS.values()),
    "versions": {
        "meili": S["version"]["pkgVersion"],
        "opensearch": req(O, "GET", "/")["version"]["number"],
    },
    "summary": SUMMARY,
    "latency": {k: timing(v) for k, v in LAT.items()},
    "concurrent4": CONCURRENT,
    "indexing_ms": INDEXING,
    "analysis": ANALYSIS,
    "results": RESULTS,
    "qrels": QRELS,
    "stats": STATS,
}
Path(args.output).write_text(json.dumps(out, ensure_ascii=False, indent=2))
print(
    json.dumps(
        {k: out[k] for k in ["summary", "latency", "concurrent4", "indexing_ms"]},
        ensure_ascii=False,
        indent=2,
    ),
    flush=True,
)
