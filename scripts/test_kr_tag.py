import os, re
from discover import is_mostly_korean
for f in os.listdir("data/deepcrawl"):
    if not f.endswith(".md"): continue
    path = os.path.join("data/deepcrawl", f)
    with open(path) as fd:
        content = fd.read()
    # Strip frontmatter
    content = re.sub(r'^---\n.*?\n---\n', '', content, flags=re.DOTALL)
    clean_text = re.sub(r'[\s\n\r\t.,!?;:()\[\]{}]+', '', content)
    kr_chars = len(re.findall(r'[\uac00-\ud7a3\u1100-\u11ff\u3130-\u318f]', clean_text))
    ratio = kr_chars / len(clean_text) if len(clean_text) > 0 else 0
    if ratio > 0.01:
        print(f"{f}: len={len(clean_text)}, kr={kr_chars}, ratio={ratio:.3f}")
    if ratio > 0.2:
        print(f"  --> MATCHED KR_ONLY: {f}")
