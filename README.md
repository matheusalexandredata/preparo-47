# Estudos da Gabia

Simulador estático da 1ª fase da OAB. Para rodar localmente, execute `python gerar.py` e abra `docs/index.html` no navegador. O gerador usa o acervo local em `../oabs`.

- **Montar prova** permite escolher o tamanho, as matérias e os recortes por assunto. O resumo mostra as quantidades antes do sorteio. O padrão inclui gabaritos definitivos e preliminares.
- **Minha prova** permite voltar a questões já confirmadas e retomar a questão atual. **PDF da prova** imprime o caderno em branco. **PDF da tentativa** inclui as marcações, acertos, erros e desempenho por matéria. Escolha **Salvar como PDF** na janela de impressão.
- **Histórico e revisão** guarda provas concluídas e permite rever, exportar ou refazer cada uma na ordem original. Também é possível refazer as questões cuja última resposta foi errada. O histórico antigo por questão é preservado. Provas antigas já substituídas não têm um registro completo para recuperar.

Para importar uma configuração criada por uma IA, veja o [guia de configuração](docs/guia-json.html), o [catálogo de temas](docs/temas.json) e o [exemplo em JSON](docs/exemplo-prova.json).

A publicação usa `main` e `docs/`. O site carrega `docs/banco.js` automaticamente. O gerador também atualiza as contagens em `docs/temas.json`. O progresso fica no mesmo navegador.

Após gerar o banco, execute `node --test testes.js` para validar as cotas, o exemplo JSON e a formatação.

A formatação rearranja o texto do acervo. Os registros `15/caderno-de-prova-01/009`, `15/caderno-de-prova-01/021` e `22/caderno-de-prova-tipo-1/020` apresentam cortes na extração e precisam de conferência no PDF original.
