"use strict";

function distribuir(total, pesos) {
    const soma = pesos.reduce((a, b) => a + b, 0);
    if (!soma || !Number.isFinite(soma)) throw Error("Informe pesos positivos.");
    const cotas = pesos.map(peso => (peso / soma) * total);
    const numeros = cotas.map(Math.floor);
    const ordem = cotas.map((cota, i) => [i, cota - numeros[i]])
        .sort((a, b) => b[1] - a[1]);
    let faltam = total - numeros.reduce((a, b) => a + b, 0);
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

function montar(pesos, total, banco) {
    if (!Number.isSafeInteger(total) || total < 1 || total > 200)
        throw Error("Escolha entre 1 e 200 questões.");
    function alocar(opcoes, quantidade, prefixo, conjunto) {
        if (quantidade === 0) return [];
        if (!opcoes.length) {
            if (conjunto.length < quantidade)
                throw Error(prefixo + ": pediu " + quantidade + " e há " + conjunto.length + " disponíveis.");
            return sortear(conjunto).slice(0, quantidade);
        }
        if (opcoes.some(item => !item.nome || !Number.isFinite(item.peso) || item.peso < 0) ||
            new Set(opcoes.map(item => item.nome)).size !== opcoes.length)
            throw Error("Escolha temas distintos e use pesos válidos.");
        const cotas = distribuir(quantidade, opcoes.map(item => item.peso));
        return opcoes.flatMap((item, i) => {
            if (item.peso === 0) return [];
            const nome = prefixo ? prefixo + " → " + item.nome : item.nome;
            return alocar(item.filhos, cotas[i], nome,
                conjunto.filter(q => q.tags[item.nivel] === item.nome));
        });
    }
    return sortear(alocar(pesos, total, "", banco));
}

if (typeof module === "object") module.exports = { distribuir, montar };
