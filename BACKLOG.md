# Backlog

Este backlog cobre as etapas posteriores ao MVP autenticado. A etapa 1 foi
concluída com descoberta dinâmica, autenticação pelo OpenCode e uma inferência
real pelo protocolo OpenAI Chat Completions no OpenCode 2.0.3.

O projeto integra o Command Code de forma geral ao OpenCode 2. O GOAT é um dos
planos suportados, mas não define sozinho o escopo do plugin. Funcionalidades
dependentes de outros planos ou créditos adicionais devem possuir testes reais
opcionais.

Os modelos Claude não fazem parte do plano GOAT. Eles aparecem porque o
endpoint oficial `/provider/v1/models` retorna o catálogo global, inclusive
quando autenticado. O projeto não manterá uma allowlist estática apresentada
como catálogo oficial do GOAT.

## Resumo

| Etapa | Épico | Objetivo | Prioridade | Dependências | Estado |
| --- | --- | --- | --- | --- | --- |
| 2 | Erros e observabilidade | Transformar falhas da Provider API em diagnósticos claros e verificáveis | Alta | MVP autenticado | Concluída |
| 3 | Streaming e ferramentas | Validar os fluxos essenciais de uma sessão de programação real | Alta | Etapa 2 | Concluída |
| 4 | Catálogo e metadados | Aumentar a fidelidade dos modelos sem criar uma lista estática frágil | Alta | Etapas 2–3 | Pendente |
| 5 | Distribuição e segurança | Tornar instalação, atualização e operação reproduzíveis e seguras | Média | Etapas 2–4 | Pendente |
| 6 | Preparação para publicação | Estabelecer os critérios objetivos para tornar o repositório público | Média | Etapa 5 | Pendente |

## Classificação do trabalho

| Natureza principal | Significado |
| --- | --- |
| Implementação do plugin | Código pelo qual este projeto é diretamente responsável. |
| Teste de comportamento integrado | Validação de recursos fornecidos principalmente pelo OpenCode e pela Provider API. |
| Infraestrutura/documentação | Trabalho necessário para distribuir e manter o plugin, sem alterar o protocolo. |
| Governança/operação | Critérios e ações relacionados à publicação do projeto. |

## Backlogs detalhados

### Etapa 2 — Erros e observabilidade

Objetivo: distinguir erros de configuração, plano, quota, rate limit e falhas
temporárias sem expor credenciais ou depender de endpoints privados.

#### B2.1 — Classificação de erros oficiais

Estado: concluído.

- Mapear `unsupported_model`, `invalid_request_error`,
  `authentication_error`, `permission_error`, `upgrade_required`,
  `cmd_zdr_no_providers`, `rate_limit_error` e erros `5xx`.
- Tratar `MODEL_NOT_IN_PLAN` explicitamente, explicando que o catálogo é global.
- Preservar o envelope original do provider quando ele contiver informação útil.
- Nunca registrar headers de autenticação, chaves ou corpos potencialmente
  sensíveis.

Critérios de aceite:

- Cada classe documentada possui fixture e teste automatizado.
- `MODEL_NOT_IN_PLAN` produz uma mensagem acionável, sem sugerir que o modelo
  pertence ao GOAT.
- Erros desconhecidos continuam visíveis como falha do provider, sem serem
  classificados incorretamente.

#### B2.2 — Política de retry

Estado: concluído. A política nativa do OpenCode 2.0.3 foi confirmada e mantida;
o plugin apenas impede retry dos status determinísticos listados abaixo.

- Confirmar a política padrão do OpenCode para `429` e `5xx`.
- Implementar override somente se a política nativa não respeitar o contrato do
  Command Code.
- Honrar `Retry-After` quando presente e usar backoff limitado quando ausente.
- Não repetir automaticamente erros `400`, `401`, `403` ou `422`.

Critérios de aceite:

- Testes demonstram quais respostas são repetidas e quais falham imediatamente.
- Uma falha temporária não gera loop infinito nem tempestade de requisições.

#### B2.3 — Estado operacional

Estado: concluído. O OpenCode 2.0.3 não expõe um painel nativo de saúde para
providers via plugin; os diagnósticos são publicados em logs JSON estruturados.

- Registrar sucesso/falha da descoberta, quantidade de modelos e horário da
  última atualização bem-sucedida.
- Manter o último inventário válido durante indisponibilidade temporária.
- Avaliar uma superfície nativa do OpenCode para exibir diagnóstico; se não
  houver uma apropriada, manter logs estruturados e documentação.
- Não apresentar estatísticas locais como quota oficial do GOAT.

Critérios de aceite:

- É possível diferenciar “sem credencial”, “catálogo indisponível” e “modelo
  fora do plano”.
- Logs não contêm segredos e possuem testes para os principais estados.

### Etapa 3 — Streaming e ferramentas

Objetivo: comprovar compatibilidade com os fluxos usados pelo agente do
OpenCode, além de uma resposta textual simples.

#### B3.1 — Streaming OpenAI-compatible

Estado: concluído. O adaptador nativo do OpenCode 2.0.3 foi validado contra um
servidor SSE local: deltas de texto, `finish_reason`, usage/cache, interrupção e
fechamento antecipado da conexão chegam corretamente sem parser próprio no
plugin. O teste real permanece opt-in por consumir créditos.

- **Escopo:** essencial.
- **Natureza principal:** majoritariamente teste de comportamento integrado.
- **Avaliação:** o streaming é implementado principalmente pelo runtime
  OpenAI-compatible do OpenCode e pela Provider API do Command Code. O plugin
  deve configurar corretamente modelo, protocolo e endpoint, sem reimplementar
  o parser SSE sem necessidade. Implementação adicional no plugin ocorrerá
  somente se os testes identificarem incompatibilidade na fronteira de
  integração.

- Validar eventos incrementais de texto.
- Confirmar propagação de `finish_reason` e usage no evento final.
- Testar cancelamento via `AbortSignal` e encerramento antecipado da conexão.

Critérios de aceite:

- Uma execução real no OpenCode exibe conteúdo incremental e termina sem
  eventos perdidos ou duplicados.
- Tokens de entrada, saída e cache retornados pela API chegam às estatísticas da
  sessão quando suportados pelo OpenCode.

#### B3.2 — Tool calling

Estado: concluído. Chamadas fragmentadas únicas e múltiplas, reconstrução de
argumentos, respostas inválidas e continuação estão cobertas na fronteira do
runtime. O teste live opt-in executa um ciclo inofensivo completo. Como o
catálogo oficial não declara suporte a tools, o plugin agora usa uma política
conservadora `toolModels`, sem anunciar a capacidade para todo modelo.

- **Escopo:** essencial.
- **Natureza principal:** majoritariamente teste de comportamento integrado,
  com possível implementação no plugin.
- **Avaliação:** execução, reconstrução de argumentos e controle das ferramentas
  pertencem principalmente ao OpenCode. O plugin é responsável por declarar as
  capacidades dos modelos e encaminhar as chamadas pelo protocolo adequado.
  Poderá ser necessária uma política de capacidades caso nem todos os modelos
  do catálogo suportem ferramentas.

- Executar uma ferramenta inofensiva em um modelo GOAT compatível.
- Validar chamada única, múltiplas chamadas e continuação após o resultado.
- Cobrir argumentos fragmentados durante streaming e respostas inválidas.
- Revisar se `capabilities.tools = true` pode ser inferido com segurança para
  todo o catálogo ou se precisa de uma política conservadora configurável.

Critérios de aceite:

- O agente completa ao menos um ciclo modelo → ferramenta → modelo.
- Argumentos são reconstruídos corretamente e nenhuma ferramenta é executada
  duas vezes.

#### B3.3 — Protocolo Anthropic

Estado: concluído. O roteamento unitário/integrado comprova `/messages`, SSE,
tool use, usage e autenticação por `x-api-key` ou Bearer, sem permitir que um
Claude alcance `/chat/completions`. O teste real é opt-in e explica o skip
quando modelo, chave ou acesso elegível não foram fornecidos.

- **Escopo:** essencial para o suporte geral ao Command Code.
- **Natureza principal:** investigação e implementação real no plugin,
  acompanhadas por testes.
- **Avaliação:** modelos Claude fazem parte do catálogo geral do Command Code,
  embora não estejam incluídos no GOAT. A falha de validação já observada ocorre
  antes da requisição chegar à API, portanto o roteamento atual ainda não está
  comprovadamente funcional. Os testes reais devem ser opcionais porque exigem
  um plano compatível ou créditos adicionais.

- Validar `/messages` com uma credencial de plano Pro/Max ou créditos extras,
  sem tratar essa validação como requisito do GOAT.
- Confirmar streaming, tool use, usage e autenticação `x-api-key`/Bearer.
- Manter testes unitários do roteamento Claude mesmo quando o teste real não
  estiver habilitado.

Critérios de aceite:

- O teste live é opt-in e pula com explicação quando a conta não possui acesso.
- Selecionar Claude nunca envia a requisição para `/chat/completions`.

### Etapa 4 — Catálogo e metadados

Objetivo: melhorar o catálogo automático usando apenas fontes oficiais e sem
transformar metadados estimados em fatos.

#### B4.1 — Fidelidade da descoberta

- **Escopo:** essencial.
- **Natureza principal:** implementação real do plugin e testes unitários.
- **Avaliação:** buscar, validar, normalizar e atualizar o catálogo externo é
  responsabilidade direta do plugin. Essa tarefa fortalece uma funcionalidade
  própria do projeto, e não apenas testa o comportamento do OpenCode.

- Versionar e testar o parser do schema observado de `/models`.
- Ignorar entradas inválidas individualmente e rejeitar inventários totalmente
  inválidos.
- Detectar adições, remoções e mudanças de metadados sem reload desnecessário.
- Validar IDs contendo `/`, `:` e outros caracteres aceitos pelo OpenCode.

Critérios de aceite:

- Fixtures cobrem mudanças de catálogo e IDs reais representativos.
- Um modelo removido desaparece após `catalog.reload()`.

#### B4.2 — Capacidades, limites e custos

- **Escopo:** parcial.
- **Natureza principal:** investigação e implementação real do plugin.
- **Avaliação:** capacidades e limites afetam diretamente como o OpenCode usa
  cada modelo e pertencem ao plugin quando houver dados oficiais. Custos são
  informativos e só devem ser incluídos se existirem em fonte pública e
  estruturada. Campos obrigatórios sem fonte oficial continuarão usando
  fallbacks explícitos e documentados.

- Verificar se fontes públicas oficiais fornecem output limit, vision, tools,
  reasoning, cache e preços de forma consumível dinamicamente.
- Usar fallback explícito apenas para campos obrigatórios do OpenCode.
- Permitir overrides locais documentados sem sobrescrever a fonte oficial.
- Não fazer scraping de páginas HTML como dependência operacional.

Critérios de aceite:

- Todo campo do catálogo possui origem documentada ou está marcado como
  fallback.
- O README explica quais valores o endpoint não fornece.

#### B4.3 — Catálogo global versus acesso da conta

- **Escopo:** essencial.
- **Natureza principal:** implementação de experiência e documentação, com
  investigação periódica.
- **Avaliação:** `/models` retorna um catálogo global, não os entitlements da
  conta. O plugin deve comunicar isso e transformar `MODEL_NOT_IN_PLAN` em um
  diagnóstico acionável, sem manter allowlists por plano. A filtragem por conta
  só será implementada se surgir uma API pública e documentada para isso.

- Documentar que `/models` retorna o mesmo inventário com e sem autenticação.
- Investigar periodicamente se surge um endpoint público de entitlements.
- Caso exista, filtrar dinamicamente pela conta; enquanto não existir, manter o
  catálogo global e tratar `MODEL_NOT_IN_PLAN` de forma clara.
- Não introduzir allowlists manuais por plano como fonte de verdade.

Critérios de aceite:

- A interface e a documentação não prometem que todos os modelos listados estão
  incluídos no plano atual.
- O comportamento muda para filtragem somente após contrato público e teste de
  integração.

### Etapa 5 — Distribuição e segurança

Objetivo: permitir instalação e atualização previsíveis sem ampliar a
superfície de confiança.

#### B5.1 — Empacotamento

- **Escopo:** necessário para distribuição.
- **Natureza principal:** implementação de pacote e testes de instalação.
- **Avaliação:** não altera o protocolo da integração, mas é responsabilidade
  direta do projeto. Deve garantir que a instalação local e o pacote publicado
  carreguem o mesmo plugin, definir compatibilidade e impedir a publicação de
  arquivos indevidos.

- Validar instalação por caminho local e por pacote empacotado com `npm pack`.
- Definir política de compatibilidade com OpenCode 2.x e manter CI contra 2.0.3.
- Revisar `exports`, arquivos publicados, licença e metadata do pacote.
- Adicionar changelog e versionamento semântico antes da primeira release.

Critérios de aceite:

- O tarball não contém `.env`, testes temporários, logs ou artefatos secretos.
- Uma instalação limpa carrega o plugin e lista o catálogo dinâmico.

#### B5.2 — Segurança de credenciais

- **Escopo:** essencial.
- **Natureza principal:** implementação e validação de segurança do plugin.
- **Avaliação:** qualquer código com acesso à credencial do Command Code deve
  garantir armazenamento e transmissão seguros. O plugin deve depender apenas
  do gerenciamento de credenciais do OpenCode ou de `CMD_API_KEY`, evitar
  segredos em logs e erros e documentar rotação.

- Garantir uso exclusivo da integração de credenciais do OpenCode ou
  `CMD_API_KEY`.
- Testar ausência de segredos em erros, logs e snapshots.
- Documentar rotação/revogação e permissões recomendadas para `.env.local`.
- Revisar dependências e registrar vulnerabilidades transitivas sem correção na
  versão alvo do OpenCode.

Critérios de aceite:

- Varredura automatizada não encontra chaves no histórico ou no pacote.
- Dependências de produção têm auditoria registrada e riscos conhecidos.

#### B5.3 — Automação de qualidade

- **Escopo:** necessário para manutenção e publicação.
- **Natureza principal:** infraestrutura de testes e CI.
- **Avaliação:** não adiciona funcionalidade ao provider. Garante que mudanças
  não quebrem autenticação, catálogo, build ou empacotamento. Testes reais que
  consumam créditos devem permanecer separados, opcionais e dependentes de
  secrets.

- Criar CI para typecheck, testes, build, `npm pack --dry-run` e auditoria.
- Separar testes unitários de testes live que consomem créditos.
- Fazer testes live dependerem explicitamente de secret e opt-in.
- Adicionar matriz de sistemas operacionais apenas quando houver valor real.

Critérios de aceite:

- Pull requests não podem integrar com checks essenciais falhando.
- Forks executam a suíte padrão sem precisar de uma chave Command Code.

### Etapa 6 — Preparação para publicação

Objetivo: tornar o projeto publicável somente quando a experiência principal
for confiável, segura e compreensível.

#### B6.1 — Documentação de usuário

- **Escopo:** necessário para distribuição.
- **Natureza principal:** documentação.
- **Avaliação:** usuários precisam compreender instalação, autenticação,
  seleção de modelos, catálogo global, diferenças entre planos e ausência de
  quota global oficial. Também deve ficar claro quais dados são enviados ao
  Command Code.

- Revisar instalação, `/connect`, `CMD_API_KEY`, `/models` e troubleshooting.
- Incluir exemplos de configuração local e pacote publicado.
- Explicar catálogo global, diferenças entre planos e ausência de quota global
  oficial.
- Documentar privacidade e quais dados são enviados ao Command Code.

Critérios de aceite:

- Um usuário novo instala e executa uma sessão seguindo apenas o README.
- Nenhuma instrução depende de endpoint privado ou arquivo interno do CLI.

#### B6.2 — Critérios de release pública

- **Escopo:** governança de publicação.
- **Natureza principal:** processo, auditoria e validação.
- **Avaliação:** não implementa funcionalidade no plugin. Define quando o
  projeto está suficientemente seguro e estável para deixar de ser privado,
  incluindo checks essenciais, revisão do histórico Git, compatibilidade e
  preparação dos canais de suporte.

- Concluir B2.1, B3.1, B3.2, B3.3, B4.1, B5.1, B5.2 e B5.3.
- Não possuir vulnerabilidade crítica conhecida introduzida pelo projeto.
- Ter teste real bem-sucedido no OpenCode 2.0.3 e na versão 2.x mais recente
  suportada no momento da release.
- Confirmar nome do pacote e ausência de conflito no npm.
- Preparar política de suporte, issue templates e aviso de projeto comunitário.

Critérios de aceite:

- Checklist de release aprovado e primeira versão candidata instalada a partir
  do artefato final.
- O repositório só é alterado de privado para público após revisão do histórico
  Git em busca de segredos e dados pessoais indevidos.

#### B6.3 — Release inicial

- **Escopo:** distribuição.
- **Natureza principal:** governança/operação de release.
- **Avaliação:** não altera a integração. Abrange versionamento, tag, notas de
  release, correspondência entre pacote e commit e reprodução da instalação.
  Tornar o repositório público continua dependendo de decisão explícita do
  mantenedor.

- Criar tag assinada ou verificável para `v0.1.0` após os critérios anteriores.
- Publicar notas de release com funcionalidades e limitações conhecidas.
- Tornar o repositório público somente com decisão explícita do mantenedor.

Critérios de aceite:

- Tag, pacote e código-fonte correspondem ao mesmo commit.
- Instalação documentada foi reproduzida em ambiente limpo.
