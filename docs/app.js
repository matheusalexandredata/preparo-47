"use strict";
const main = document.querySelector("#main");
const notice = document.querySelector("#notice");
const letters = ["A", "B", "C", "D"];
const levels = ["Disciplina", "Assunto", "Subtópico", "Detalhe"];
const key = "caderno-pratica-v1";
const node = (tag, text, css) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (css) el.className = css;
    return el;
};
const button = (text, fn, css) => {
    const el = node("button", text, css);
    el.type = "button";
    el.onclick = fn;
    return el;
};
let state = { total: 20, preliminary: false, tree: [], session: null, history: [] };
try { state = { ...state, ...JSON.parse(localStorage.getItem(key)) }; } catch {}
let bank = globalThis.BANCO || [];
let index = new Map(bank.map(q => [q.id, q]));
let tab = state.session ? "quiz" : "build";
const tell = text => { notice.textContent = text; };
function save() {
    try { localStorage.setItem(key, JSON.stringify(state)); }
    catch { tell("O navegador não conseguiu salvar o progresso neste dispositivo."); }
}
function openTab(next) {
    tab = next;
    tell("");
    render();
}
function render() {
    main.replaceChildren();
    for (const el of document.querySelectorAll("nav button"))
        el.setAttribute("aria-current", el.dataset.tab === tab ? "page" : "false");
    if (tab === "quiz") renderQuiz();
    else if (tab === "history") renderHistory();
    else renderBuilder();
}
function heading(label, title, description) {
    main.append(node("p", label, "eyebrow"), node("h1", title), node("p", description, "intro"));
}
function available() {
    return bank.filter(q => q.status === "confirmada" || (state.preliminary && q.status === "preliminar"));
}
function start(questions) {
    if (!questions.length) return tell("Este recorte ainda não tem questões disponíveis.");
    if (state.session && state.session.position < state.session.ids.length &&
        !window.confirm("Substituir a prova em andamento? O histórico das respostas será preservado.")) return;
    state.session = { ids: questions.map(q => q.id), position: 0, selected: null, cut: [], done: false, hits: 0 };
    save();
    openTab("quiz");
}
function renderBuilder() {
    heading("PLANEJAMENTO", "Monte sua prova", "Escolha o tamanho da sessão e distribua as questões pelos temas que quer praticar.");
    const panel = node("section", undefined, "card");
    const controls = node("div", undefined, "controls");
    const label = node("label", "Questões na prova");
    const count = node("input");
    Object.assign(count, { type: "number", min: 1, max: 200, value: state.total });
    count.onchange = () => { state.total = count.valueAsNumber || 0; save(); };
    label.append(count);
    const prelim = node("label", undefined, "check");
    const check = node("input");
    Object.assign(check, { type: "checkbox", checked: state.preliminary });
    check.onchange = () => { state.preliminary = check.checked; save(); render(); };
    prelim.append(check, " Incluir gabaritos preliminares");
    controls.append(label, prelim);
    const pool = available();
    panel.append(controls, node("p", pool.length.toLocaleString("pt-BR") + " questões disponíveis", "count"));
    const config = node("div", undefined, "weights");
    config.append(node("h2", "Distribuição por tema"),
        node("p", "Pesos são proporcionais dentro de cada nível. Três pesos 33 dividem a prova em três partes iguais. Sem subdivisões, o sorteio usa todo o tema.", "muted"));
    if (!state.tree.length) config.append(node("p", "Nenhum filtro selecionado. O sorteio usará todo o banco disponível.", "empty"));
    renderWeights(config, state.tree, 0, pool);
    panel.append(config, button("Gerar prova", () => {
        state.total = count.valueAsNumber || 0;
        save();
        try { start(montar(state.tree, state.total, pool)); }
        catch (error) { tell(error.message); }
    }, "primary"));
    main.append(panel);
}
function renderWeights(container, items, depth, pool) {
    const names = [...new Set(pool.map(q => q.tags[depth]).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "pt-BR"));
    for (const [i, item] of items.entries()) {
        const itemPool = pool.filter(q => q.tags[depth] === item.nome);
        const box = node("div", undefined, "weight-node");
        const line = node("div", undefined, "weight-line");
        const title = node("label", levels[depth]);
        const select = node("select");
        select.append(new Option("Escolha " + levels[depth].toLowerCase(), ""));
        for (const name of [...new Set([...names, item.nome])].filter(Boolean)) {
            const used = items.some((other, j) => i !== j && other.nome === name);
            if (!used || name === item.nome) select.append(new Option(name, name));
        }
        select.value = item.nome;
        select.onchange = () => { item.nome = select.value; item.filhos = []; save(); render(); };
        title.append(select);
        const label = node("label", "Peso");
        const weight = node("input");
        Object.assign(weight, { type: "number", min: 0, step: "any", value: item.peso });
        weight.onchange = () => { item.peso = weight.valueAsNumber || 0; save(); };
        label.append(weight);
        const remove = button("×", () => { items.splice(i, 1); save(); render(); }, "icon");
        remove.setAttribute("aria-label", "Remover tema");
        line.append(title, label, remove);
        box.append(line);
        if (item.nome) box.append(node("small", itemPool.length + " disponíveis", "muted"));
        if (item.nome && depth < 3) {
            const children = node("div", undefined, "nested");
            renderWeights(children, item.filhos, depth + 1, itemPool);
            box.append(children);
        }
        container.append(box);
    }
    const next = names.find(name => !items.some(item => item.nome === name));
    if (next) container.append(button("+ Adicionar " + levels[depth].toLowerCase(), () => {
        items.push({ nome: next, peso: 1, nivel: depth, filhos: [] });
        save(); render();
    }, "secondary small"));
}
function readingText(text) {
    // PDF extraction inserts hard wraps. Keep paragraphs and numbered items.
    return text.trim().replace(/\r\n?/g, "\n").split(/\n(?:[ \t]*\n)+/).map(paragraph =>
        paragraph.replace(/[ \t]*\n[ \t]*(?![ \t]|(?:[IVXLCDM]+|\d+)\s*[.)–-]\s|[•–—]\s)/g, " ")
    ).join("\n\n");
}

function renderQuiz() {
    const run = state.session;
    if (!run) {
        heading("PRÁTICA", "Minha prova", "Monte uma prova para começar.");
        main.append(button("Montar prova", () => openTab("build"), "primary"));
        return;
    }
    if (run.position >= run.ids.length) {
        heading("RESULTADO", "Prova concluída", run.hits + " de " + run.ids.length + " acertos.");
        main.append(button("Ver histórico e revisão", () => openTab("history"), "primary"));
        return;
    }
    const q = index.get(run.ids[run.position]);
    if (!q) {
        heading("PRÁTICA", "Minha prova", "Importe o banco usado para montar esta prova e retomar.");
        return;
    }
    heading("PRÁTICA", "Questão " + (run.position + 1) + " de " + run.ids.length, q.tags.join(" › "));
    const progress = node("progress");
    progress.max = run.ids.length;
    progress.value = run.position + Number(run.done);
    progress.setAttribute("aria-label", "Questões respondidas");
    const card = node("section", undefined, "card quiz-card");
    card.append(node("p", readingText(q.stem), "stem"));
    for (const [i, choice] of q.choices.entries()) {
        const letter = letters[i];
        const line = node("div", undefined, "option");
        line.classList.toggle("cut", run.cut.includes(letter));
        line.classList.toggle("selected", run.selected === letter);
        line.classList.toggle("right", run.done && letter === q.answer);
        line.classList.toggle("wrong", run.done && letter === run.selected && letter !== q.answer);
        const answer = button("", () => { run.selected = letter; save(); render(); }, "answer");
        answer.append(node("span", letter, "answer-letter"), node("span", readingText(choice), "answer-text"));
        answer.disabled = run.done;
        answer.setAttribute("aria-pressed", run.selected === letter);
        const cut = button("✂", () => {
            run.cut = run.cut.includes(letter) ? run.cut.filter(c => c !== letter) : [...run.cut, letter];
            save(); render();
        }, "icon");
        cut.disabled = run.done;
        cut.setAttribute("aria-label", "Alternar descarte de " + letter);
        cut.setAttribute("aria-pressed", run.cut.includes(letter));
        line.append(answer, cut);
        card.append(line);
    }
    if (run.done) {
        const feedback = node("div", undefined, "feedback");
        feedback.append(node("strong", run.selected === q.answer ? "Resposta correta" : "Resposta incorreta"),
            node("p", "Gabarito " + q.answer + (q.status === "preliminar" ? " · preliminar" : " · definitivo")));
        if (q.explanation) feedback.append(node("p", readingText(q.explanation), "stem"));
        const url = q.source;
        if (typeof url === "string" && /^https:\/\//i.test(url)) {
            const link = node("a", "Consultar gabarito");
            Object.assign(link, { href: url, target: "_blank", rel: "noopener noreferrer" });
            feedback.append(link);
        }
        const nextLabel = run.position + 1 === run.ids.length ? "Ver resultado →" : "Próxima questão →";
        card.append(feedback, button(nextLabel, () => {
            run.position++; run.selected = null; run.cut = []; run.done = false; save(); render();
        }, "primary"));
    } else {
        const confirm = button("Confirmar resposta", () => {
            if (run.done || !run.selected) return;
            run.done = true;
            const correct = run.selected === q.answer;
            run.hits += Number(correct);
            state.history.push({ id: q.id, correct, tags: q.tags, at: Date.now() });
            save(); render();
        }, "primary");
        confirm.disabled = !run.selected;
        card.append(confirm);
    }
    main.append(progress, card);
}
function renderHistory() {
    const history = state.history;
    const hits = history.filter(r => r.correct).length;
    heading("DESEMPENHO", "Histórico e revisão", "Acompanhe as tentativas deste navegador e refaça as questões que errou.");
    const stats = node("div", undefined, "stats");
    for (const [label, value] of [["Respondidas", history.length], ["Acertos", hits], ["Erros", history.length - hits],
        ["Aproveitamento", history.length ? Math.round(100 * hits / history.length) + "%" : "—"]]) {
        const card = node("div", undefined, "card metric");
        card.append(node("strong", value), node("small", label));
        stats.append(card);
    }
    main.append(stats);
    const wrong = [...new Set(history.filter(r => !r.correct).map(r => r.id))].map(id => index.get(id)).filter(Boolean);
    main.append(button("Revisar meus erros · " + wrong.length, () => start(sortear(wrong).slice(0, 200)), "primary"));
    const groups = new Map();
    for (const r of history) {
        const name = r.tags[0];
        const group = groups.get(name) || { total: 0, hits: 0 };
        group.total++; group.hits += Number(r.correct);
        groups.set(name, group);
    }
    if (groups.size) {
        const summary = node("section", undefined, "card");
        summary.append(node("h2", "Por disciplina"));
        for (const [name, g] of groups)
            summary.append(node("p", name + " · " + g.hits + "/" + g.total + " acertos"));
        summary.append(node("h2", "Tentativas recentes"));
        for (const r of history.slice(-20).reverse())
            summary.append(node("p", (r.correct ? "Acerto" : "Erro") + " · " + r.tags.join(" › ") + " · " + new Date(r.at).toLocaleDateString("pt-BR")));
        main.append(summary);
    }
}

function validBank(value) {
    return Array.isArray(value) && value.length > 0 && new Set(value.map(q => q?.id)).size === value.length &&
        value.every(q => q && typeof q.id === "string" && q.id && typeof q.stem === "string" &&
            Array.isArray(q.tags) && q.tags.length > 0 && q.tags.length <= 4 && q.tags.every(t => typeof t === "string" && t) &&
            Array.isArray(q.choices) && q.choices.length === 4 && q.choices.every(c => typeof c === "string") &&
            letters.includes(q.answer) && ["confirmada", "preliminar"].includes(q.status));
}
function bankStorage(mode, handler) {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open("caderno-pratica", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("data");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction("data", mode);
            const operation = handler(tx.objectStore("data"));
            tx.oncomplete = () => { db.close(); resolve(operation.result); };
            tx.onabort = () => { db.close(); reject(tx.error); };
        };
    });
}
function replaceBank(value) {
    bank = value;
    index = new Map(bank.map(q => [q.id, q]));
}
document.querySelector("#import").onchange = async event => {
    try {
        const file = event.target.files[0];
        if (!file) return;
        const value = JSON.parse(await file.text());
        if (!validBank(value)) throw Error("Banco inválido. Confira os campos do formato JSON.");
        replaceBank(value);
        render();
        try { await bankStorage("readwrite", store => store.put(value, "bank")); }
        catch { return tell("Banco carregado nesta sessão. Neste navegador será preciso importar novamente ao reabrir."); }
        tell("Banco importado.");
    } catch (error) { tell(error.message); }
    finally { event.target.value = ""; }
};
for (const el of document.querySelectorAll("nav button")) el.onclick = () => openTab(el.dataset.tab);
render();
bankStorage("readonly", store => store.get("bank")).then(value => {
    if (validBank(value)) { replaceBank(value); render(); }
}).catch(() => {});
