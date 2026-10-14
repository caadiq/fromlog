#!/usr/bin/env python3
# Engine-only control: one HTTP request, 20 IDs, no DB hydration or query expansion.
import http.client, json, random, statistics, subprocess, time, math
from pathlib import Path

root = Path(__file__).resolve().parent
cases = json.load(open(root / "cases.json"))


def connection(name, port):
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
    return http.client.HTTPConnection(ip, port, timeout=15)


M = connection("fromlog-search-lab-meilisearch", 7700)
O = connection("fromlog-search-lab-opensearch", 9200)


def request(engine, q, index=None):
    if engine == "meili":
        c = M
        path = f'/indexes/{index or "lab-current"}/search'
        body = {"q": q, "limit": 20, "attributesToRetrieve": ["id"]}
    else:
        c = O
        path = f'/{index or "lab-nori"}/_search'
        body = {
            "size": 20,
            "_source": ["id"],
            "query": {
                "multi_match": {
                    "query": q,
                    "fields": [
                        "title^4",
                        "source_name^2",
                        "description",
                        "category_name",
                    ],
                    "operator": "and",
                    "type": "cross_fields",
                }
            },
        }
    c.request(
        "POST",
        path,
        json.dumps(body, ensure_ascii=False).encode(),
        {"Content-Type": "application/json"},
    )
    r = c.getresponse()
    data = r.read()
    assert r.status == 200, data
    return json.loads(data)


for engine, index in [
    ("meili", "lab-current"),
    ("meili", "lab-meili-enriched"),
    ("meili", "lab-meili-tuned"),
    ("nori", "lab-nori"),
    ("nori", "lab-standard-tuned"),
    ("nori", "lab-nori-tuned"),
]:
    for case in cases:
        request(engine, case["q"], index)
jobs = [(e, c["q"]) for _ in range(10) for c in cases for e in ["meili", "nori"]]
random.Random(90).shuffle(jobs)
values = {"meili": [], "nori": []}
for e, q in jobs:
    start = time.perf_counter()
    request(e, q)
    values[e].append((time.perf_counter() - start) * 1000)
print(
    json.dumps(
        {
            e: {
                "n": len(v),
                "p50_ms": statistics.median(v),
                "p95_ms": sorted(v)[math.ceil(len(v) * 0.95) - 1],
            }
            for e, v in values.items()
        },
        indent=2,
    )
)
