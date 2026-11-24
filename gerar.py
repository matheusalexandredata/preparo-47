"""Exporta o acervo local para o simulador, com Python padrão."""
import json
import re
from pathlib import Path

repo = Path(__file__).resolve().parent
acervo = repo.parent / "oabs"
tags = acervo / "tags"
answers = {
    row["id"]: row
    for line in (tags / "gabaritos.jsonl").read_text(encoding="utf-8").splitlines()
    if (row := json.loads(line))
}
classification = {}
for line in (tags / "CLASSIFICACAO.md").read_text(encoding="utf-8").splitlines():
    match = re.match(r"^\| \[([^]]+)\]\(\.\./[^)]+\) \| (.*)$", line)
    if not match:
        continue
    key, rest = match.groups()
    discipline, subject, topic, detail, origin = [
        value.strip() for value in rest.split("|")[:5]
    ]
    alias = re.fullmatch(r"caderno equivalente \(([^)]+)\)", origin)
    classification[key] = (
        [tag for tag in (discipline, subject, topic, detail) if tag != "—"],
        alias[1] if alias else key,
    )

bank = []
seen = set()
for block in re.split(r"(?m)^### Questão \d+ — [^\n]+\n",
                      (acervo / "README.md").read_text(encoding="utf-8"))[1:]:
    refs = re.search(r"(?m)^\*\*Ocorrências:\*\* .+$", block)
    number, pdf = re.search(r"questão (\d+)\]\(([^)]+)\)", refs[0]).groups()
    path = Path(pdf)
    key = f"{path.parent.parent.name.removeprefix('exame-')}/{path.stem}/{int(number):03}"
    tag, canonical = classification[key]
    answer = answers[key]
    seen.add(key)
    if key != canonical or answer["status"] == "anulada":
        continue
    body = re.split(r"(?m)^## Exame \d+\s*$", block[refs.end():], maxsplit=1)[0]
    pieces = re.split(r"(?m)^([A-D])\) ", body.strip())
    assert pieces[1::2] == list("ABCD"), key
    assert answer["correct_option"] in list("ABCD"), key
    bank.append({
        "id": key,
        "tags": tag,
        "stem": pieces[0].strip(),
        "choices": [choice.strip() for choice in pieces[2::2]],
        "answer": answer["correct_option"],
        "status": answer["status"],
        "source": answer["source_url"],
    })

assert len(seen) == len(classification) == len(answers) and seen == answers.keys()
assert all(canonical in seen for _, canonical in classification.values())
assert len(bank) == len({q["id"] for q in bank})
payload = json.dumps(bank, ensure_ascii=False, separators=(",", ":"))
(repo / "docs" / "banco.js").write_text("globalThis.BANCO=" + payload + ";\n", encoding="utf-8")
(repo / "banco.json").write_text(payload + "\n", encoding="utf-8")
print(f"{len(bank)} questoes em docs/banco.js")
