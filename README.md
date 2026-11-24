# Estudos da Gabia

Simulador estático da 1ª fase da OAB. Para rodar localmente, execute `python gerar.py` e abra `docs/index.html` no navegador. O gerador usa o acervo local em `../oabs`.

- **Montar prova** permite escolher o tamanho, as matérias e os recortes por assunto. O resumo mostra as quantidades antes do sorteio. O padrão inclui gabaritos definitivos e preliminares.
- **Minha prova** permite confirmar respostas, exportar o caderno pela opção **Salvar como PDF** da janela de impressão e limpar a prova. As respostas confirmadas ficam no histórico.
- **Histórico e revisão** mostra os resultados e permite refazer as questões cuja última resposta foi errada.

Para importar uma configuração criada por uma IA, veja o [guia de configuração](docs/guia-json.html), o [catálogo de temas](docs/temas.json) e o [exemplo em JSON](docs/exemplo-prova.json).

A publicação usa `main` e `docs/`. O site carrega `docs/banco.js` automaticamente. O gerador também atualiza as contagens em `docs/temas.json`. O progresso fica no mesmo navegador.

Após gerar o banco, execute `node --test testes.js` para validar as cotas, o exemplo JSON e a formatação.

A formatação rearranja o texto do acervo. Os registros `15/caderno-de-prova-01/009`, `15/caderno-de-prova-01/021` e `22/caderno-de-prova-tipo-1/020` apresentam cortes na extração e precisam de conferência no PDF original.
