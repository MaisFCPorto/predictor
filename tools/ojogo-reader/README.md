# Teste local de leitura de O Jogo

Este teste abre uma janela separada do Google Chrome no teu computador e tenta
ler o texto visível de uma notícia pública. Requer Node 20 ou superior e Chrome
instalado. Não precisa de chaves. A instalação usa pacotes npm com versões fixas.

Na raiz do repositório:

```sh
npm --prefix tools/ojogo-reader ci
npm --prefix tools/ojogo-reader run check
```

Sem argumentos, testa a notícia do mercado de verão, ID 18147554. Para outra:

```sh
npm --prefix tools/ojogo-reader run check -- "https://www.ojogo.pt/futebol/artigo/slug/12345678"
```

O terminal mostra o título, a data, a quantidade de texto e o ficheiro guardado.
O JSON em `tools/ojogo-reader/output/` tem o formato de entrada de uma notícia do
Hub, até 6.000 caracteres. Está ignorado no Git e é criado com permissões
privadas. Para comunicar o resultado do teste basta enviar o relatório do
terminal, sem o texto integral nem dados de sessão.

Nesta fase não envia dados para o Hub, não chama a IA, não publica notícias e
não agenda recolhas. Primeiro é necessário confirmar a leitura no computador
local. Depois poderá ser ligada a entrega ao Hub. Um coletor local periódico
precisará de um computador ligado nos horários das recolhas.

A janela tem um perfil temporário, sem ler o perfil pessoal, palavras-passe ou
cookies existentes do Chrome. O teste não altera a página original, não tenta
resolver verificações humanas e para em erros de acesso. Não extrai texto oculto
nem usa texto de metadados como substituto do corpo visível. Restrições de
assinatura detetadas também interrompem a leitura. Um resultado positivo confirma
a extração de texto suficiente, mas o texto guardado ainda deve ser revisto.

O teste pode ler uma notícia antiga para diagnóstico, mas assinala quando está
fora das 48 horas da importação do Hub. A execução fecha a janela, no máximo,
ao fim de um minuto. Não mantém um navegador ou serviço a correr.

## Validação de desenvolvimento

```sh
npm --prefix tools/ojogo-reader test
npm --prefix tools/ojogo-reader run test:browser
```

Os testes usam páginas sintéticas. O ensaio de navegador pode usar o Chromium
do sistema através de `OJOGO_TEST_CHROMIUM` (apenas no teste); não consulta o
site de O Jogo nem faz chamadas a serviços de IA.
