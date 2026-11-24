"use strict";

const LIMITE_QUESTOES = 200;
const NIVEIS = ["disciplina", "assunto", "subtópico", "detalhe"];

function distribuir(total, pesos) {
    const maior = Math.max(...pesos);
    if (maior <= 0 || !Number.isFinite(maior)) throw Error("Use pelo menos um peso maior que zero.");
    const relativos = pesos.map(peso => peso / maior);
    const soma = relativos.reduce((a, b) => a + b, 0);
    const cotas = relativos.map(peso => (peso / soma) * total);
    const numeros = cotas.map(Math.floor);
    const ordem = cotas.map((cota, i) => [i, cota - numeros[i]])
        .sort((a, b) => b[1] - a[1]);
    const faltam = total - numeros.reduce((a, b) => a + b, 0);
    for (const [i] of ordem.slice(0, faltam)) numeros[i]++;
    return numeros;
}

function sortear(items) {
    const copia = [...items];
    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
}

function planejar(pesos, total, banco) {
    const grupos = [];
    const erros = [];
    if (!Number.isSafeInteger(total) || total < 1 || total > LIMITE_QUESTOES) {
        const geral = "Escolha de 1 a " + LIMITE_QUESTOES + " questões.";
        return { linhas: [], grupos, erros: [geral], geral };
    }

    function visitar(opcoes, quantidade, conjunto, nivel, caminho) {
        let erro = quantidade > conjunto.length
            ? "Faltam " + (quantidade - conjunto.length) + " questões. Há " + conjunto.length + " disponíveis."
            : "";
        if (opcoes.length) {
            if (quantidade && (opcoes.some(item => !item.nome || !Number.isFinite(item.peso) || item.peso < 0) ||
                new Set(opcoes.map(item => item.nome)).size !== opcoes.length)) {
                erro = "Escolha temas distintos e informe pesos iguais ou maiores que zero.";
            } else if (quantidade && opcoes.every(item => item.peso === 0)) {
                erro = "Use pelo menos um peso maior que zero.";
            } else {
                if (erro) erros.push([caminho, erro].filter(Boolean).join(" · "));
                const cotas = quantidade ? distribuir(quantidade, opcoes.map(item => item.peso)) : opcoes.map(() => 0);
                const linhas = opcoes.map((item, i) => {
                    const recorte = conjunto.filter(q => q.tags[nivel] === item.nome);
                    const nome = caminho ? caminho + " › " + item.nome : item.nome;
                    const filho = visitar(item.filhos, cotas[i], recorte, nivel + 1, nome);
                    return {
                        item, quantidade: cotas[i], disponiveis: recorte.length,
                        erro: filho.erro, filhos: filho.linhas
                    };
                });
                return { linhas, erro };
            }
        } else if (!erro && quantidade) {
            grupos.push({ quantidade, conjunto });
        }
        if (erro) erros.push([caminho, erro].filter(Boolean).join(" · "));
        return { linhas: [], erro };
    }

    const raiz = visitar(pesos, total, banco, 0, "");
    return { linhas: raiz.linhas, grupos, erros, geral: raiz.erro };
}

function montar(pesos, total, banco) {
    const plano = planejar(pesos, total, banco);
    if (plano.erros.length) throw Error(plano.erros[0]);
    return sortear(plano.grupos.flatMap(({ quantidade, conjunto }) =>
        sortear(conjunto).slice(0, quantidade)));
}

function objetoComCampos(objeto, campos) {
    return objeto && typeof objeto === "object" && !Array.isArray(objeto) &&
        Object.keys(objeto).every(campo => campos.includes(campo));
}

function lerConfiguracao(json, banco) {
    let dados;
    try { dados = JSON.parse(json.replace(/^\uFEFF/, "")); }
    catch { throw Error("O arquivo não é um JSON válido. Confira o exemplo do guia."); }
    if (!objetoComCampos(dados, ["versao", "quantidade", "incluir_preliminares", "temas"]) ||
        dados.versao !== 1 || !Array.isArray(dados.temas)) {
        throw Error("Use um JSON de configuração no formato do guia, com versão 1.");
    }
    if (!Number.isInteger(dados.quantidade) || dados.quantidade < 1 || dados.quantidade > LIMITE_QUESTOES)
        throw Error("A configuração deve pedir de 1 a " + LIMITE_QUESTOES + " questões.");
    if ("incluir_preliminares" in dados && typeof dados.incluir_preliminares !== "boolean")
        throw Error("Use true ou false no campo incluir_preliminares.");

    function lerTemas(temas, conjunto, nivel, caminho) {
        const usados = new Set();
        return temas.map(item => {
            if (nivel >= NIVEIS.length) throw Error("A configuração aceita até quatro níveis: " + caminho + ".");
            if (!objetoComCampos(item, ["nome", "peso", "filhos"]) || typeof item.nome !== "string")
                throw Error("Informe o nome de cada " + NIVEIS[nivel] + " no formato do guia.");
            const nome = caminho ? caminho + " › " + item.nome : item.nome;
            const recorte = conjunto.filter(q => q.tags[nivel] === item.nome);
            if (!recorte.length) throw Error("Tema não encontrado: " + nome + ".");
            if (usados.has(item.nome)) throw Error("Tema repetido: " + nome + ".");
            usados.add(item.nome);
            const peso = "peso" in item ? item.peso : 1;
            if (!Number.isFinite(peso) || peso < 0)
                throw Error("Use um peso numérico igual ou maior que zero em " + nome + ".");
            const filhos = "filhos" in item ? item.filhos : [];
            if (!Array.isArray(filhos)) throw Error("O campo filhos deve ser uma lista em " + nome + ".");
            return { nome: item.nome, peso, nivel, filhos: lerTemas(filhos, recorte, nivel + 1, nome) };
        });
    }

    return {
        total: dados.quantidade,
        preliminary: dados.incluir_preliminares ?? true,
        tree: lerTemas(dados.temas, banco, 0, "")
    };
}

function formatarTexto(texto) {
    const lista = /^(?:\(?[IVXLCDM]+[.)]|\(?\d{1,2}[.)]|[a-z]\)|[IVXLCDM]+\s*[-–—]|[•–—-])\s/u;
    const frases = [];
    let anterior = "";
    let vazio = false;
    for (const linha of texto.replace(/\r\n?/g, "\n").split("\n")) {
        const atual = linha.trim().replace(/[ \t]+/g, " ");
        if (!atual) {
            vazio = true;
            continue;
        }
        if (frases.length) {
            const paragrafo = vazio && /[.!?:”"]$/.test(anterior) && /^[\p{Lu}\d“"«]/u.test(atual);
            frases.push(paragrafo ? "\n\n" : lista.test(atual) ? "\n" : " ");
        }
        frases.push(atual);
        anterior = atual;
        vazio = false;
    }
    return frases.join("");
}

function textoDaAlternativa(texto, posicao) {
    // Cadernos antigos podem trazer o número da página em uma linha após a alternativa D.
    if (posicao === 3) {
        const rodape = texto.match(/^(.*[.!?])[ \t]*\r?\n\s*(\d{1,2})[ \t]*$/s);
        if (rodape && Number(rodape[2]) >= 1 && Number(rodape[2]) <= 40 &&
            !/\b(?:art|inc|fl|pág|n)\.$/i.test(rodape[1])) texto = rodape[1];
    }
    return formatarTexto(texto);
}

function recuperarRespostas(prova, historico) {
    const quantidade = prova.position + Number(prova.done);
    if (!quantidade) return [];
    const recentes = historico.slice(-quantidade);
    return Array.from({ length: quantidade }, (_, i) => {
        const registro = recentes.length === quantidade && recentes[i].id === prova.ids[i] ? recentes[i] : null;
        return registro ? {
            choice: registro.choice ?? (prova.done && i === prova.position ? prova.selected : null),
            correct: registro.correct
        } : null;
    });
}

if (typeof module === "object")
    module.exports = { distribuir, planejar, montar, lerConfiguracao, formatarTexto, textoDaAlternativa, recuperarRespostas };
