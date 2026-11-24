"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { distribuir, planejar, montar, lerConfiguracao, formatarTexto, textoDaAlternativa, recuperarRespostas } = require("./docs/motor.js");

test("divisão de questões e desempate determinístico", () => {
    assert.deepEqual(distribuir(20, [3, 1]), [15, 5]);
    assert.deepEqual(distribuir(15, [2, 1]), [10, 5]);
    assert.deepEqual(distribuir(5, [1, 1, 1]), [2, 2, 1]);
    assert.deepEqual(distribuir(4, [0, Number.MAX_VALUE, Number.MAX_VALUE]), [0, 2, 2]);
});

test("importação valida hierarquia, campos permitidos e tamanho", () => {
    const banco = [{ tags: ["Penal", "Crimes", "Homicídio", "Qualificado"] }];
    const json = (temas = [], outros = {}) => JSON.stringify({ versao: 1, quantidade: 1, temas, ...outros });
    assert.deepEqual(lerConfiguracao(json(), banco), { total: 1, preliminary: true, tree: [] });
    assert.equal(lerConfiguracao(json([], { incluir_preliminares: false }), banco).preliminary, false);
    assert.equal(lerConfiguracao(json([{ nome: "Penal" }]), banco).tree[0].peso, 1);
    assert.throws(() => lerConfiguracao("[{}]", banco), /versão 1/);
    assert.throws(() => lerConfiguracao(json([], { questoes: [] }), banco), /versão 1/);
    assert.throws(() => lerConfiguracao(json([], { quantidade: 201 }), banco), /200/);
    assert.throws(() => lerConfiguracao(json([{ nome: "Penal", peso: "2" }]), banco), /peso numérico/);
    assert.throws(() => lerConfiguracao(json([{ nome: "Penal" }, { nome: "Penal" }]), banco), /repetido/);
    assert.throws(() => lerConfiguracao(json([{ nome: "Penal", filhos: [{ nome: "Homicídio" }] }]), banco),
        /não encontrado/);
});

test("o plano informa a falta no ramo e o sorteio respeita essa validação", () => {
    const banco = [{ id: "1", tags: ["Penal", "Crimes"] }, { id: "2", tags: ["Penal"] }];
    const tree = lerConfiguracao('{"versao":1,"quantidade":2,"temas":[{"nome":"Penal","filhos":[{"nome":"Crimes"}]}]}', banco).tree;
    const plano = planejar(tree, 2, banco);
    assert.equal(plano.linhas[0].filhos[0].quantidade, 2);
    assert.equal(plano.linhas[0].filhos[0].disponiveis, 1);
    assert.match(plano.linhas[0].filhos[0].erro, /Há 1/);
    assert.throws(() => montar(tree, 2, banco), /Penal › Crimes/);
    assert.equal(montar(tree, 1, banco)[0].id, "1");
});

test("texto corrido elimina quebras do PDF e preserva listas e parágrafos", () => {
    assert.equal(formatarTexto("pode atuar\n \nem \ncausas \nque \nnão"), "pode atuar em causas que não");
    assert.equal(formatarTexto("Leia:\r\nI. Primeiro\r\nitem.\r\nII – Segundo item.\r\n\r\nAssinale a correta."),
        "Leia:\nI. Primeiro item.\nII – Segundo item.\n\nAssinale a correta.");
});

test("remove o rodapé na alternativa D e preserva números do enunciado", () => {
    assert.equal(textoDaAlternativa("Destituição do poder familiar.\n13", 3), "Destituição do poder familiar.");
    assert.equal(textoDaAlternativa("Aplica-se o art.\n13", 3), "Aplica-se o art. 13");
    assert.equal(textoDaAlternativa("Resultado.\n13", 2), "Resultado. 13");
});

test("recupera a sessão antiga sem atribuir uma letra desconhecida", () => {
    const prova = { ids: ["a", "b"], position: 1, done: true, selected: "B" };
    const historico = [{ id: "z", correct: true }, { id: "a", correct: false }, { id: "b", correct: true }];
    assert.deepEqual(recuperarRespostas(prova, historico), [
        { choice: null, correct: false }, { choice: "B", correct: true }
    ]);
});

const origem = path.join(__dirname, "docs/banco.js");
test("o guia, as cotas e a formatação conferem com o banco local", { skip: !fs.existsSync(origem) }, () => {
    require(origem);
    const banco = globalThis.BANCO;
    const disponiveis = banco.filter(q => q.status === "confirmada");
    const exemplo = fs.readFileSync(path.join(__dirname, "docs/exemplo-prova.json"), "utf8");
    const { total, tree, preliminary } = lerConfiguracao(exemplo, banco);
    const prova = montar(tree, total, preliminary ? banco : disponiveis);
    assert.equal(new Set(prova.map(q => q.id)).size, 20);
    assert.equal(prova.filter(q => q.tags[0] === "Direito Penal").length, 15);
    assert.equal(prova.filter(q => q.tags[1] === "Crimes contra a pessoa").length, 10);
    assert.equal(prova.filter(q => q.tags[1] === "Teoria do crime").length, 5);
    assert.equal(prova.filter(q => q.tags[0] === "Ética profissional e Estatuto da OAB").length, 5);

    const { temas } = require("./docs/temas.json");
    const contar = (chave) => temas.reduce((acc, tema) => acc + tema[chave], 0);
    assert.equal(contar("definitivas"), disponiveis.length);
    assert.equal(contar("definitivas") + contar("preliminares"), banco.length);

    const palavras = texto => texto.replace(/\s+/g, " ").trim();
    for (const q of banco)
        for (const trecho of [q.stem, ...q.choices])
            assert.equal(palavras(formatarTexto(trecho)), palavras(trecho), q.id);
    const pedro = banco.find(q => q.id === "43/caderno-de-prova-tipo-1/005");
    assert.ok(pedro);
    assert.doesNotMatch(formatarTexto(pedro.choices[2]), /\n/);
    const angelica = banco.find(q => q.id === "25/caderno-de-prova-tipo-1/043");
    assert.match(textoDaAlternativa(angelica.choices[3], 3), /mãe Teresa\.$/);
});
