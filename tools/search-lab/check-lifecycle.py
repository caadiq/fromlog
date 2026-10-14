#!/usr/bin/env python3
"""Lab-only update/delete/filter/paging/highlight/persistence checks."""

import json, time, urllib.request, urllib.error, subprocess

names = ["fromlog-search-lab-meilisearch", "fromlog-search-lab-opensearch"]


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
    return f"http://{ip}:{port}"


M = address(names[0], 7700)
O = address(names[1], 9200)


def req(base, method, path, data=None):
    r = urllib.request.urlopen(
        urllib.request.Request(
            base + path,
            data=(
                None if data is None else json.dumps(data, ensure_ascii=False).encode()
            ),
            method=method,
            headers={"Content-Type": "application/json"},
        ),
        timeout=10,
    )
    return json.load(r) if r.status != 204 else None


def wait(task):
    for _ in range(200):
        r = req(M, "GET", f'/tasks/{task["taskUid"]}')
        if r["status"] == "succeeded":
            return
        if r["status"] == "failed":
            raise RuntimeError(r)
        time.sleep(0.05)
    raise TimeoutError("Meili task")


for base in [M, O]:
    try:
        req(base, "DELETE", "/indexes/lab-lifecycle" if base == M else "/lab-lifecycle")
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise
wait(req(M, "POST", "/indexes", {"uid": "lab-lifecycle", "primaryKey": "id"}))
wait(
    req(
        M,
        "PATCH",
        "/indexes/lab-lifecycle/settings",
        {"filterableAttributes": ["category", "date"], "sortableAttributes": ["date"]},
    )
)
req(
    O,
    "PUT",
    "/lab-lifecycle",
    {
        "settings": {"number_of_shards": 1, "number_of_replicas": 0},
        "mappings": {
            "properties": {
                "id": {"type": "integer"},
                "title": {"type": "text", "analyzer": "nori"},
                "category": {"type": "keyword"},
                "date": {"type": "date"},
            }
        },
    },
)
docs = [
    {
        "id": i,
        "title": "계약결혼 테스트",
        "category": "예능",
        "date": f"2026-10-{10+i:02d}",
    }
    for i in range(1, 4)
]
wait(req(M, "POST", "/indexes/lab-lifecycle/documents", docs))
for d in docs:
    req(O, "PUT", f'/lab-lifecycle/_doc/{d["id"]}?refresh=true', d)
for base in [M, O]:
    if base == M:
        r = req(
            base,
            "POST",
            "/indexes/lab-lifecycle/search",
            {
                "q": "계약결혼",
                "filter": "category = 예능 AND date >= 2026-10-12",
                "sort": ["date:desc"],
                "offset": 1,
                "limit": 1,
                "attributesToHighlight": ["title"],
            },
        )
        assert [x["id"] for x in r["hits"]] == [2]
        assert "<em>" in r["hits"][0]["_formatted"]["title"]
    else:
        r = req(
            base,
            "POST",
            "/lab-lifecycle/_search",
            {
                "query": {
                    "bool": {
                        "must": {"match": {"title": "계약결혼"}},
                        "filter": [
                            {"term": {"category": "예능"}},
                            {"range": {"date": {"gte": "2026-10-12"}}},
                        ],
                    }
                },
                "sort": [{"date": "desc"}],
                "from": 1,
                "size": 1,
                "highlight": {"fields": {"title": {}}},
            },
        )
        assert [x["_source"]["id"] for x in r["hits"]["hits"]] == [2]
        assert "<em>" in r["hits"]["hits"][0]["highlight"]["title"][0]
changed = {**docs[0], "title": "변경된검증제목"}
wait(req(M, "POST", "/indexes/lab-lifecycle/documents", [changed]))
req(O, "PUT", "/lab-lifecycle/_doc/1?refresh=true", changed)
wait(req(M, "DELETE", "/indexes/lab-lifecycle/documents/2"))
req(O, "DELETE", "/lab-lifecycle/_doc/2?refresh=true")
assert req(M, "GET", "/indexes/lab-lifecycle/stats")["numberOfDocuments"] == 2
assert req(O, "GET", "/lab-lifecycle/_count")["count"] == 2
assert req(M, "GET", "/indexes/lab-lifecycle/documents/1")["title"] == changed["title"]
assert req(O, "GET", "/lab-lifecycle/_doc/1")["_source"]["title"] == changed["title"]
counts_before = (
    req(M, "GET", "/indexes/lab-current/stats")["numberOfDocuments"],
    req(O, "GET", "/lab-nori-tuned/_count")["count"],
)
# Restrict restart operations to the two explicit lab containers.
restart = {}
for name in names:
    base = M if name == names[0] else O
    start = time.perf_counter()
    subprocess.run(["docker", "restart", name], check=True, stdout=subprocess.DEVNULL)
    for _ in range(240):
        try:
            r = req(
                base,
                "GET",
                (
                    "/indexes/lab-lifecycle/stats"
                    if base == M
                    else "/lab-lifecycle/_count"
                ),
            )
            assert r["numberOfDocuments" if base == M else "count"] == 2
            restart[name] = round(time.perf_counter() - start, 2)
            break
        except Exception:
            time.sleep(0.25)
    else:
        raise TimeoutError(name)
# Persisted changes and production-sized indexes survived both restarts.
assert req(M, "GET", "/indexes/lab-lifecycle/documents/1")["title"] == changed["title"]
assert req(O, "GET", "/lab-lifecycle/_doc/1")["_source"]["title"] == changed["title"]
assert (
    req(M, "GET", "/indexes/lab-current/stats")["numberOfDocuments"] == counts_before[0]
)
assert req(O, "GET", "/lab-nori-tuned/_count")["count"] == counts_before[1]
wait(req(M, "DELETE", "/indexes/lab-lifecycle"))
req(O, "DELETE", "/lab-lifecycle")
print(
    json.dumps(
        {
            "update_delete_filter_paging_highlight_persistence": "pass",
            "restart_to_queryable_seconds": restart,
        },
        ensure_ascii=False,
        indent=2,
    )
)
