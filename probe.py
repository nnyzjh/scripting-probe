# Scripting Python 入口探测（probe.py）
# 用法：新建一个 Scripting 项目，在高级设置里把入口改成 probe.py，再运行。
# 看日志输出：每一项 PASS/FAIL，FAIL 也是答案。
import sys
import json
import io
import zipfile
import urllib.request

results = []


def check(name, fn):
    try:
        detail = fn()
        results.append((name, True, str(detail)))
    except Exception as e:
        results.append((name, False, type(e).__name__ + ": " + str(e)))


def _version():
    return sys.version.split()[0]


def _zip():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("hello.txt", "hi")
    buf.seek(0)
    with zipfile.ZipFile(buf) as z:
        return z.read("hello.txt").decode()


def _net():
    url = "https://raw.githubusercontent.com/nnyzjh/cloudflare-scripting/main/script.json"
    with urllib.request.urlopen(url, timeout=15) as r:
        return "HTTP " + str(r.status) + " " + str(len(r.read())) + "B"


def _write():
    with open("probe_test.txt", "w") as f:
        f.write("ok")
    with open("probe_test.txt") as f:
        return f.read()


def _requests():
    import requests
    return requests.__version__


check("Python 版本", _version)
check("zipfile 解压/压缩", _zip)
check("urllib 联网", _net)
check("写文件再读回", _write)
check("import requests", _requests)

ok = sum(1 for _, passed, _ in results if passed)
print("边界探测（Python）：" + str(ok) + "/" + str(len(results)) + " 通过")
for name, passed, detail in results:
    print(("✅ " if passed else "❌ ") + name + " - " + detail)
print(json.dumps(
    [{"name": n, "ok": p, "detail": d} for n, p, d in results],
    ensure_ascii=False,
))
