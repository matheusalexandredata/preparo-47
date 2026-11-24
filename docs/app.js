"use strict";

const main = document.querySelector("#main");
const notice = document.querySelector("#notice");
const fileInput = document.querySelector("#config-file");
const printout = document.querySelector("#printout");
const numeros = new Intl.NumberFormat("pt-BR");
const letras = ["A", "B", "C", "D"];
const temas = ["matéria", "assunto", "subtópico", "detalhe"];
const chave = "caderno-pratica-v1";
const banco = globalThis.BANCO || [];
const indice = new Map(banco.map(q => [q.id, q]));
const configInicial = () => ({ total: 20, preliminary: true, tree: [] });
let state = { ...configInicial(), versao: 2, session: null, history: [] };
try {
    const salvo = JSON.parse(localStorage.getItem(chave));
    state = { ...state, ...salvo, versao: 2, preliminary: salvo?.versao === 2 ? salvo.preliminary !== false : true };
} catch {}
let aba = "build";
let materiasAbertas = Boolean(state.tree.length);
let gabaritosAbertos = false;
const temasAbertos = new WeakMap();

function el(tag, classe = "", texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
}

function botao(texto, acao, classe = "button") {
    const elemento = el("button", classe, texto);
    elemento.type = "button";
    elemento.onclick = acao;
    return elemento;
}

function link(texto, href, classe = "") {
    const elemento = el("a", classe, texto);
    elemento.href = href;
    return elemento;
}

function avisar(texto = "") {
    notice.textContent = texto;
    notice.hidden = !texto;
}

function salvar() {
    try { localStorage.setItem(chave, JSON.stringify(state)); }
    catch { avisar("O navegador não conseguiu salvar seu progresso neste dispositivo."); }
}

function pendente() {
    return state.session && state.session.position < state.session.ids.length;
}

function abrir(destino) {
    aba = destino;
    avisar();
    render("page-title");
}

function render(foco) {
    main.replaceChildren();
    for (const item of document.querySelectorAll("nav button")) {
        if (item.dataset.tab === aba) item.setAttribute("aria-current", "page");
        else item.removeAttribute("aria-current");
    }
    if (aba === "quiz") renderProva();
    else if (aba === "history") renderHistorico();
    else renderMontagem();
    if (foco === "page-title") window.scrollTo(0, 0);
    document.getElementById(foco)?.focus({ preventScroll: foco === "page-title" });
}

function cabecalho(titulo, descricao, acoes = []) {
    const header = el("header", "page-header");
    const texto = el("div");
    const h1 = el("h1", "", titulo);
    h1.id = "page-title";
    h1.tabIndex = -1;
    texto.append(h1);
    if (descricao) texto.append(el("p", "description", descricao));
    header.append(texto);
    if (acoes.length) {
        const barra = el("div", "actions");
        barra.append(...acoes);
        header.append(barra);
    }
    main.append(header);
}

function limparProva() {
    confirmarMudanca("Limpar esta prova?", "Limpar prova", () => {
        state.session = null;
        salvar();
        abrir("build");
    });
}

function iniciar(questoes) {
    if (!questoes.length) return;
    function comecar() {
        state.session = {
            ids: questoes.map(q => q.id), position: 0, selected: null, cut: [], done: false, hits: 0
        };
        salvar();
        abrir("quiz");
    }
    if (pendente()) confirmarMudanca("Substituir a prova em andamento?", "Iniciar nova prova", comecar);
    else comecar();
}

function confirmarMudanca(titulo, acao, concluir) {
    const modal = document.querySelector("#confirmacao");
    document.querySelector("#confirmacao-titulo").textContent = titulo;
    document.querySelector("#confirmacao-acao").textContent = acao;
    modal.returnValue = "";
    modal.onclose = () => {
        if (modal.returnValue === "confirmar") concluir();
    };
    modal.showModal();
}

function renderMontagem() {
    const importar = botao("Importar configuração JSON", () => fileInput.click());
    importar.disabled = !banco.length;
    cabecalho("Montar prova", "Escolha quantas questões quer resolver. Você pode misturar matérias ou focar em alguns temas.", [importar]);
    if (!banco.length) {
        const vazio = el("section", "card empty");
        vazio.append(el("h2", "", "O banco de questões não carregou"),
            el("p", "muted", "Atualize a página para tentar de novo."),
            botao("Atualizar página", () => location.reload(), "button primary"));
        main.append(vazio);
        return;
    }

    if (pendente()) {
        const retomar = el("section", "resume");
        const respondidas = state.session.position + Number(state.session.done);
        retomar.append(el("p", "", "Prova em andamento · " + respondidas + " de " + state.session.ids.length + " respondidas"),
            botao("Continuar prova", () => abrir("quiz")));
        main.append(retomar);
    }

    const pool = state.preliminary ? banco : banco.filter(q => q.status === "confirmada");
    const grid = el("div", "builder");
    const configuracao = el("section", "card configuration");
    const quantidade = el("div", "quantity");
    const label = el("label", "section-label", "Quantidade de questões");
    label.htmlFor = "quantidade";
    const count = el("input", "number");
    Object.assign(count, { id: "quantidade", type: "number", min: 1, max: LIMITE_QUESTOES, value: state.total || "" });
    const presets = el("div", "presets");
    const valores = [10, 20, 40, 80].map(valor => [valor, botao(String(valor), () => {
        count.value = valor;
        alterarQuantidade();
    }, "button preset")]);
    presets.append(...valores.map(([, item]) => item));
    function alterarQuantidade() {
        state.total = count.valueAsNumber || 0;
        salvar();
        atualizarResumo();
    }
    count.oninput = alterarQuantidade;
    quantidade.append(label, count, presets, el("p", "hint", "De 1 a " + LIMITE_QUESTOES + " questões."));

    const escolher = el("details", "disclosure subjects");
    escolher.open = materiasAbertas;
    escolher.ontoggle = () => { materiasAbertas = escolher.open; };
    escolher.append(el("summary", "", "Escolher matérias e assuntos"),
        el("p", "hint", "Pesos iguais dividem as questões igualmente. Aumente o peso para dar mais espaço a um tema. Os assuntos dividem só as questões da própria matéria."));
    const linhas = new Map();
    renderTemas(escolher, state.tree, 0, pool, "", linhas, atualizarResumo);

    const opcoes = el("details", "disclosure options");
    opcoes.open = gabaritosAbertos;
    opcoes.ontoggle = () => { gabaritosAbertos = opcoes.open; };
    const check = el("input");
    check.type = "checkbox";
    check.checked = !state.preliminary;
    check.onchange = () => {
        state.preliminary = !check.checked;
        gabaritosAbertos = true;
        salvar();
        render("definitivos");
    };
    check.id = "definitivos";
    const labelCheck = el("label", "check", "Somente gabaritos definitivos");
    labelCheck.prepend(check);
    opcoes.append(el("summary", "", "Opções de gabarito"), labelCheck,
        el("p", "hint", "Por padrão, entram questões com gabarito definitivo ou preliminar. O preliminar pode mudar após a análise dos recursos."));
    configuracao.append(quantidade, escolher, opcoes);

    const resumo = el("section", "card plan");
    const total = el("strong", "plan-total");
    const plano = el("div", "plan-rows");
    const erro = el("p", "inline-error");
    erro.setAttribute("role", "status");
    const gerar = botao("Gerar prova", () => {
        try { iniciar(montar(state.tree, state.total, pool)); }
        catch (error) { avisar(error.message); }
    }, "button primary");
    const limpar = botao("Limpar configuração", () => {
        Object.assign(state, configInicial());
        materiasAbertas = false;
        gabaritosAbertos = false;
        salvar();
        render("quantidade");
    }, "button quiet");
    resumo.append(el("h2", "", "Resumo da prova"), total,
        el("p", "muted", numeros.format(pool.length) + " questões disponíveis" + (state.preliminary ? "" : " com gabarito definitivo")),
        plano, erro, gerar, limpar);
    grid.append(configuracao, resumo);
    main.append(grid);
    atualizarResumo();

    function atualizarResumo() {
        for (const [valor, item] of valores) item.setAttribute("aria-pressed", String(state.total === valor));
        const { linhas: dados, erros, geral } = planejar(state.tree, state.total, pool);
        total.textContent = state.total ? numeros.format(state.total) + (state.total === 1 ? " questão" : " questões") : "—";
        plano.replaceChildren();
        for (const campos of linhas.values()) {
            campos.contagem.textContent = "";
            campos.aviso.textContent = "";
        }
        function mostrar(itens, parent) {
            const lista = el("ul", "breakdown");
            for (const { item, quantidade, disponiveis, erro, filhos } of itens) {
                const campos = linhas.get(item);
                campos.contagem.textContent = quantidade + " na prova · " + disponiveis + " disponíveis";
                campos.aviso.textContent = erro;
                const li = el("li");
                const row = el("div", "breakdown-row");
                row.append(el("span", "", item.nome), el("strong", "", String(quantidade)));
                li.append(row);
                if (filhos.length) mostrar(filhos, li);
                lista.append(li);
            }
            parent.append(lista);
        }
        if (dados.length) mostrar(dados, plano);
        else if (!state.tree.length) plano.append(el("p", "mixed", "Prova mista · todas as matérias"));
        erro.textContent = geral || (erros.length ? "Ajuste os temas destacados para gerar a prova." : "");
        gerar.disabled = Boolean(erros.length);
        limpar.hidden = state.total === 20 && state.preliminary && !state.tree.length;
    }
}

function renderTemas(container, items, nivel, pool, caminho, linhas, atualizar) {
    const nomes = [...new Set(pool.map(q => q.tags[nivel]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    for (const [i, item] of items.entries()) {
        const id = "tema" + caminho + "-" + i;
        const recorte = pool.filter(q => q.tags[nivel] === item.nome);
        const box = el("div", "topic");
        const linha = el("div", "topic-fields");
        const label = el("label", "topic-name", temas[nivel][0].toUpperCase() + temas[nivel].slice(1));
        const select = el("select");
        select.id = id;
        select.append(new Option("Selecione…", ""));
        for (const nome of [...new Set([...nomes, item.nome])].filter(Boolean)) {
            if (nome === item.nome || !items.some(outro => outro.nome === nome)) select.append(new Option(nome, nome));
        }
        select.value = item.nome;
        select.onchange = () => {
            item.nome = select.value;
            item.filhos = [];
            temasAbertos.delete(item);
            salvar();
            render(id);
        };
        label.append(select);
        const labelPeso = el("label", "weight", "Peso");
        const peso = el("input", "number");
        Object.assign(peso, { type: "number", min: 0, step: "any", value: item.peso });
        peso.oninput = () => { item.peso = peso.valueAsNumber || 0; salvar(); atualizar(); };
        labelPeso.append(peso);
        const remover = botao("×", () => {
            items.splice(i, 1);
            salvar();
            render(items.length ? "tema" + caminho + "-" + Math.min(i, items.length - 1) : "adicionar" + caminho);
        }, "button icon remove");
        remover.setAttribute("aria-label", "Remover " + (item.nome || temas[nivel]));
        linha.append(label, labelPeso, remover);
        const contagem = el("p", "topic-count");
        const aviso = el("p", "inline-error");
        linhas.set(item, { contagem, aviso });
        box.append(linha, contagem, aviso);
        if (item.nome && nivel < temas.length - 1 && (item.filhos.length || recorte.some(q => q.tags[nivel + 1]))) {
            const filhos = el("details", "disclosure nested");
            filhos.open = temasAbertos.get(item) ?? Boolean(item.filhos.length);
            filhos.ontoggle = () => temasAbertos.set(item, filhos.open);
            filhos.append(el("summary", "", "Refinar " + (nivel === 0 ? "assuntos" : nivel === 1 ? "subtópicos" : "detalhes")));
            renderTemas(filhos, item.filhos, nivel + 1, recorte, caminho + "-" + i, linhas, atualizar);
            box.append(filhos);
        }
        container.append(box);
    }
    if (nomes.some(nome => !items.some(item => item.nome === nome))) {
        const add = botao("Adicionar " + temas[nivel], () => {
            items.push({ nome: "", peso: 1, nivel, filhos: [] });
            salvar();
            render("tema" + caminho + "-" + (items.length - 1));
        }, "button small");
        add.id = "adicionar" + caminho;
        add.disabled = items.some(item => !item.nome);
        container.append(add);
    }
}

function acoesDaProva(run) {
    const pdf = botao("Exportar PDF", () => window.print());
    pdf.disabled = run.ids.some(id => !indice.has(id));
    pdf.title = "Selecione Salvar como PDF na janela de impressão.";
    return [pdf, botao("Limpar prova", limparProva, "button quiet")];
}

function renderProva() {
    const run = state.session;
    if (!run) {
        cabecalho("Minha prova");
        const vazio = el("section", "card empty");
        vazio.append(el("h2", "", "Você ainda não montou uma prova"),
            el("p", "muted", "Escolha a quantidade de questões e as matérias que quer praticar."),
            botao("Montar prova", () => abrir("build"), "button primary"));
        main.append(vazio);
        return;
    }
    if (run.position >= run.ids.length) {
        renderResultado(run);
        return;
    }
    const questao = indice.get(run.ids[run.position]);
    if (!questao) {
        cabecalho("Minha prova", "Esta questão não está disponível no banco atual.", acoesDaProva(run));
        main.append(botao("Montar nova prova", () => abrir("build"), "button primary"));
        return;
    }

    cabecalho("Questão " + (run.position + 1) + " de " + run.ids.length, questao.tags.join(" › "), acoesDaProva(run));
    const progresso = el("div", "progress");
    const respondidas = run.position + Number(run.done);
    const barra = el("progress");
    barra.max = run.ids.length;
    barra.value = respondidas;
    barra.setAttribute("aria-label", "Questões respondidas");
    progresso.append(barra, el("span", "hint", respondidas + " de " + run.ids.length + " respondidas"));
    const card = el("section", "card question");
    card.append(el("p", "reading stem", formatarTexto(questao.stem)));
    const grupo = el("fieldset", "answers");
    grupo.append(el("legend", "sr-only", "Escolha uma alternativa"));
    const opcoes = questao.choices.map((texto, i) => {
        const letra = letras[i];
        const linha = el("div", "option");
        const answer = el("label", "answer");
        const radio = el("input", "sr-only");
        Object.assign(radio, { type: "radio", name: "answer", value: letra, disabled: run.done });
        radio.onchange = () => {
            if (run.done) return;
            run.selected = letra;
            salvar();
            atualizarOpcoes();
        };
        const corpo = el("span", "answer-body");
        const status = el("span", "answer-status");
        corpo.append(el("span", "reading answer-text", formatarTexto(texto)), status);
        answer.append(radio, el("span", "answer-letter", letra), corpo);
        const tesoura = botao("✂", () => {
            run.cut = run.cut.includes(letra) ? run.cut.filter(l => l !== letra) : [...run.cut, letra];
            salvar();
            atualizarOpcoes();
        }, "button icon cut-button");
        tesoura.disabled = run.done;
        linha.append(answer, tesoura);
        grupo.append(linha);
        return { letra, linha, radio, status, tesoura };
    });
    const confirmar = botao("Confirmar resposta", () => {
        if (run.done || !run.selected) return;
        run.done = true;
        const correta = run.selected === questao.answer;
        run.hits += Number(correta);
        state.history.push({ id: questao.id, correct: correta, tags: questao.tags, at: Date.now() });
        salvar();
        render("correcao");
    }, "button primary");
    atualizarOpcoes();
    card.append(grupo);
    if (run.done) {
        const correta = run.selected === questao.answer;
        const feedback = el("section", "feedback " + (correta ? "success" : "failure"));
        const titulo = el("h2", "", correta ? "Resposta correta" : "Resposta incorreta");
        titulo.id = "correcao";
        titulo.tabIndex = -1;
        feedback.append(titulo, el("p", "", "Gabarito: " + questao.answer +
            (questao.status === "preliminar" ? " · preliminar" : " · definitivo")));
        if (questao.explanation) feedback.append(el("p", "reading", formatarTexto(questao.explanation)));
        if (typeof questao.source === "string" && /^https:\/\//i.test(questao.source)) {
            const fonte = link("Consultar gabarito oficial", questao.source);
            Object.assign(fonte, { target: "_blank", rel: "noopener noreferrer" });
            feedback.append(fonte);
        }
        const ultima = run.position + 1 === run.ids.length;
        card.append(feedback, botao(ultima ? "Ver resultado" : "Próxima questão", () => {
            run.position++;
            run.selected = null;
            run.cut = [];
            run.done = false;
            salvar();
            render("page-title");
        }, "button primary"));
    } else {
        card.append(confirmar);
    }
    const leitura = el("div", "quiz");
    leitura.append(progresso, card);
    main.append(leitura);

    function atualizarOpcoes() {
        confirmar.disabled = !run.selected;
        for (const { letra, linha, radio, status, tesoura } of opcoes) {
            const selecionada = letra === run.selected;
            const descartada = run.cut.includes(letra);
            const correta = run.done && letra === questao.answer;
            radio.checked = selecionada;
            linha.classList.toggle("selected", selecionada && !run.done);
            linha.classList.toggle("discarded", descartada);
            linha.classList.toggle("correct", correta);
            linha.classList.toggle("incorrect", run.done && selecionada && !correta);
            status.textContent = correta ? (selecionada ? "Sua resposta · correta" : "Resposta correta") :
                run.done && selecionada ? "Sua resposta · incorreta" : "";
            tesoura.setAttribute("aria-label", (descartada ? "Restaurar alternativa " : "Descartar alternativa ") + letra);
            tesoura.setAttribute("aria-pressed", String(descartada));
            tesoura.title = descartada ? "Restaurar alternativa" : "Descartar alternativa";
        }
    }
}

function listarDisciplinas(registros, card) {
    const grupos = new Map();
    for (const registro of registros) {
        const nome = registro.tags[0];
        const grupo = grupos.get(nome) || { total: 0, acertos: 0 };
        grupo.total++;
        grupo.acertos += Number(registro.correct);
        grupos.set(nome, grupo);
    }
    const lista = el("ul", "scores");
    for (const [nome, grupo] of grupos) {
        const linha = el("li");
        const barra = el("progress");
        barra.max = grupo.total;
        barra.value = grupo.acertos;
        barra.setAttribute("aria-label", "Acertos em " + nome);
        linha.append(el("span", "", nome), el("strong", "", grupo.acertos + " de " + grupo.total), barra);
        lista.append(linha);
    }
    card.append(el("h2", "", "Por matéria"), lista);
}

function renderResultado(run) {
    cabecalho("Prova concluída", "Veja como foi e refaça as questões que errou.", acoesDaProva(run));
    const ultimas = state.history.slice(-run.ids.length);
    const registros = ultimas.length === run.ids.length && ultimas.every((item, i) => item.id === run.ids[i]) ? ultimas : [];
    const erros = registros.filter(item => !item.correct).map(item => indice.get(item.id)).filter(Boolean);
    const resultado = el("section", "card outcome");
    resultado.append(el("h2", "", "Você acertou " + run.hits + " de " + run.ids.length +
        (run.ids.length === 1 ? " questão" : " questões")));
    const acoes = el("div", "actions");
    if (erros.length) acoes.append(botao("Revisar " + erros.length + (erros.length === 1 ? " erro" : " erros"),
        () => iniciar(erros), "button primary"));
    acoes.append(botao("Montar outra prova", () => abrir("build"), erros.length ? "button" : "button primary"));
    resultado.append(acoes);
    main.append(resultado);
    if (registros.length) {
        const card = el("section", "card report");
        listarDisciplinas(registros, card);
        main.append(card);
    }
}

function renderHistorico() {
    cabecalho("Histórico e revisão", "Acompanhe suas respostas e refaça as questões pendentes. Seu progresso fica salvo neste navegador.");
    const registros = state.history;
    if (!registros.length) {
        const vazio = el("section", "card empty");
        vazio.append(el("h2", "", "Ainda não há respostas"),
            el("p", "muted", "Depois da primeira questão, seus acertos e erros aparecem aqui."),
            botao("Montar prova", () => abrir("build"), "button primary"));
        main.append(vazio);
        return;
    }
    const hits = registros.filter(r => r.correct).length;
    const ultimas = new Map(registros.map(r => [r.id, r]));
    const pendentes = [...ultimas.values()].filter(r => !r.correct).sort((a, b) => b.at - a.at)
        .map(r => indice.get(r.id)).filter(Boolean);
    const metricas = el("section", "metrics");
    for (const [nome, valor] of [["Respostas", registros.length], ["Acertos", hits],
        ["Erros", registros.length - hits], ["Aproveitamento", Math.round(100 * hits / registros.length) + "%"]]) {
        const card = el("div", "card metric");
        card.append(el("span", "muted", nome), el("strong", "", String(valor)));
        metricas.append(card);
    }
    const revisao = el("section", "card review");
    const texto = el("div");
    texto.append(el("h2", "", "Revisar meus erros"), el("p", "muted",
        pendentes.length ? pendentes.length + (pendentes.length === 1 ? " questão pendente" : " questões pendentes") :
            "Você não tem questões pendentes de revisão."));
    revisao.append(texto);
    if (pendentes.length) revisao.append(botao("Iniciar revisão", () => iniciar(pendentes.slice(0, LIMITE_QUESTOES)), "button primary"));
    const totais = el("section", "card report");
    listarDisciplinas(registros, totais);
    const recentes = el("section", "card report");
    recentes.append(el("h2", "", "Tentativas recentes"));
    const itens = el("ul", "attempts");
    for (const registro of registros.slice(-20).reverse()) {
        const linha = el("li");
        const texto = el("div");
        texto.append(el("strong", "", registro.tags[0]), el("span", "hint", registro.tags.slice(1).join(" › ")));
        const estado = el("div", "attempt-meta");
        estado.append(el("span", "badge " + (registro.correct ? "success" : "failure"), registro.correct ? "Acerto" : "Erro"),
            el("time", "hint", new Date(registro.at).toLocaleDateString("pt-BR")));
        linha.append(texto, estado);
        itens.append(linha);
    }
    recentes.append(itens);
    main.append(metricas, revisao, totais, recentes);
}

fileInput.onchange = async () => {
    const arquivo = fileInput.files[0];
    if (!arquivo) return;
    fileInput.disabled = true;
    try {
        if (arquivo.size > 1024 * 1024) throw Error("Selecione uma configuração JSON de até 1 MB.");
        const config = lerConfiguracao(await arquivo.text(), banco);
        Object.assign(state, config);
        materiasAbertas = Boolean(config.tree.length);
        gabaritosAbertos = false;
        salvar();
        abrir("build");
        avisar("Configuração importada. Confira o resumo antes de gerar a prova.");
    } catch (error) {
        avisar(error.message);
    } finally {
        fileInput.value = "";
        fileInput.disabled = false;
    }
};

window.addEventListener("beforeprint", () => {
    printout.replaceChildren();
    const run = state.session;
    if (!run || run.ids.some(id => !indice.has(id))) return;
    const topo = el("header", "print-header");
    topo.append(el("p", "", "1ª fase da OAB"), el("h1", "", "Estudos da Gabia"),
        el("p", "", run.ids.length + (run.ids.length === 1 ? " questão" : " questões")),
        el("p", "print-fields", "Nome: ___________________________________     Data: ____/____/______"));
    printout.append(topo);
    run.ids.forEach((id, i) => {
        const q = indice.get(id);
        const item = el("article", "print-question");
        item.append(el("h2", "", "Questão " + (i + 1)), el("p", "reading", formatarTexto(q.stem)));
        const opcoes = el("ol");
        for (const texto of q.choices) opcoes.append(el("li", "reading", formatarTexto(texto)));
        item.append(opcoes);
        printout.append(item);
    });
    document.body.classList.add("print-ready");
});
window.addEventListener("afterprint", () => {
    document.body.classList.remove("print-ready");
    printout.replaceChildren();
});

for (const item of document.querySelectorAll("nav button")) item.onclick = () => abrir(item.dataset.tab);
render();
