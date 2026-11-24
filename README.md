# Caderno de prática

Simulador estático da 1ª fase da OAB. O gerador reúne as questões, tags e gabaritos do acervo local ao lado deste repositório.

1. Execute `python gerar.py` nesta pasta.
2. Abra `docs/index.html` no navegador. A versão local usa `docs/banco.js`.
3. Em **Montar prova**, adicione disciplinas e atribua seus pesos. Para distribuir as questões de uma disciplina entre assuntos, adicione os assuntos dentro dela. Repita para subtópicos e detalhes.

Pesos são relativos a irmãos. Pesos 33, 33 e 33 equivalem a partes iguais. A divisão em números inteiros usa os maiores restos em cada nível. Uma categoria sem subdivisões sorteia entre todas as suas questões. Se um recorte não comportar a quantidade pedida, o simulador mostra a disponibilidade e pede que você ajuste o tamanho ou os pesos.

A correção usa o gabarito vinculado. O banco local reúne um registro por grupo equivalente, omite anuladas e oferece gabaritos preliminares mediante seleção. O histórico e a prova em andamento ficam no navegador.

## GitHub Pages

A pasta `docs/` está preparada para publicação estática. O gerador também exporta `banco.json`, na pasta do repositório. Os dois formatos do banco ficam no `.gitignore`. Uma instalação sem o banco embutido aceita o JSON pelo menu lateral. Cada item tem `id`, `tags` (uma lista de 1 a 4 níveis), `stem`, `choices` (quatro textos), `answer` (A–D), `status` (`confirmada` ou `preliminar`) e `source` (URL do gabarito). `explanation` é opcional.

O repositório foi preparado para uso local. As diretivas de indexação pedem que buscadores não indexem o site. O acesso a uma publicação pública continua disponível para quem tiver o endereço.
