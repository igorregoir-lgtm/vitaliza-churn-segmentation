# EDA Report: Gym Churn

Este relatório resume 10 insights acionáveis para apoiar a retenção de clientes da academia a partir da análise exploratória da base de churn.

## 10 insights acionáveis

1. **Queda de frequência recente é o principal alerta operacional.** Clientes que reduzem a frequência no mês atual devem entrar em uma régua de contato preventivo antes do fim do contrato.

2. **Clientes com pouco tempo de relacionamento precisam de onboarding.** Usuários nos primeiros meses ainda não criaram hábito e devem receber acompanhamento ativo, metas semanais e incentivo para experimentar modalidades.

3. **Contratos curtos concentram maior risco de cancelamento.** Planos mensais ou de curta duração devem receber campanhas de migração para contratos mais longos com benefícios claros.

4. **Proximidade física ajuda na retenção.** Clientes que moram ou trabalham perto tendem a ter menor atrito de uso; campanhas locais e parcerias de bairro podem aumentar presença.

5. **Aulas em grupo funcionam como vínculo social.** Clientes que participam de atividades coletivas tendem a criar rotina e pertencimento; estimular uma primeira aula em grupo pode reduzir churn.

6. **Indicação por amigos é um sinal de retenção potencial.** Clientes vindos por promoção de amigos podem ser trabalhados com desafios em dupla, benefícios compartilhados e metas coletivas.

7. **Gastos extras indicam engajamento além do plano.** Maior consumo de serviços adicionais sugere vínculo com a operação; clientes sem gastos extras podem receber ofertas de baixo atrito.

8. **Clientes antigos com frequência baixa formam o segmento “sleeping dog”.** Eles já conhecem a academia, mas perderam hábito; campanhas de reativação são mais adequadas que ações genéricas de aquisição.

9. **A diferença entre frequência histórica e atual antecipa abandono.** A feature `ratio_freq_atual_vs_lifetime` deve ser monitorada para detectar deterioração antes do churn acontecer.

10. **O modelo deve priorizar recall em ações de retenção.** Para campanhas preventivas, é melhor capturar mais clientes em risco, mesmo com alguns falsos positivos, do que perder cancelamentos reais.

## Recomendações de ação

- Criar uma lista semanal de clientes com baixa frequência atual, contrato perto do vencimento e alto risco previsto.
- Oferecer uma trilha de onboarding para novos clientes nos primeiros 30 dias.
- Incentivar aulas em grupo e programas com amigos para aumentar vínculo social.
- Monitorar clientes antigos que pararam de frequentar e oferecer reativação personalizada.
- Usar o `top_3_drivers` da API para explicar por que cada cliente foi classificado como risco.
