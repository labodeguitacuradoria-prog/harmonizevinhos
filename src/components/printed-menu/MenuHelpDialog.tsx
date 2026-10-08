import { useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

const STEPS = [
  {
    title: "Prepare os rótulos do restaurante",
    paragraphs: [
      "A carta usa os vinhos cadastrados no restaurante selecionado. Antes de começar, confira os nomes, safras, volumes e preços no Cadastro de Produtos.",
      "Se ainda não houver vinhos, cadastre seus rótulos primeiro e depois volte à Carta impressa. Nenhum vinho é cadastrado por este guia.",
    ],
    tip: "Confira o restaurante selecionado para montar a carta da operação correta.",
  },
  {
    title: "Escolha o modelo e o papel",
    paragraphs: [
      "Para iniciar uma versão, abra Nova carta e escolha Carta com modelo pronto. No painel Modelo, selecione o visual desejado, como Clássico, Duas colunas ou Minimalista.",
      "Escolha também o tamanho do papel. Em Cabeçalho e rodapé, preencha o título impresso, o subtítulo e os contatos. O Nome desta carta (uso interno) serve para localizar a versão salva e não aparece na impressão.",
    ],
    tip: "Se preferir um desenho exclusivo da nossa equipe, escolha Carta personalizada em Nova carta.",
  },
  {
    title: "Selecione e organize os vinhos",
    paragraphs: [
      "Confira os rótulos no bloco Seções. Use Reagrupar para organizar por tipo ou estilo, ou crie seções com os títulos que desejar.",
      "Em Rótulos fora da carta, pesquise pelo vinho ou produtor, escolha o destino em Incluir em e pressione Incluir. Use as setas para mudar a ordem e a seleção de seção para mover um vinho.",
      "O botão Retirar da carta remove o vinho apenas desta composição, sem excluir o produto do cadastro.",
    ],
    tip: "Exemplo de organização: Espumantes, Brancos, Rosés e Tintos, com subseções por país ou região.",
  },
  {
    title: "Defina as informações e as páginas",
    paragraphs: [
      "Em Informações do rótulo, marque o que deseja imprimir: produtor, safra, país, região, uvas, volume, código e preço.",
      "Ajuste fontes, espaçamentos, alinhamento e margens quando necessário. Na organização de folhas, distribua as seções entre páginas e acrescente folhas extras para capa, imagem ou texto.",
      "Acompanhe a Pré-visualização para conferir a ordem das folhas e se o conteúdo cabe no papel escolhido.",
    ],
    tip: "Em cartas exclusivas, o desenho é mantido pela nossa equipe; algumas opções de aparência não ficam disponíveis.",
  },
  {
    title: "Salve e reutilize sua carta",
    paragraphs: [
      "Clique em Salvar e informe um nome que identifique a carta. As seções, os rótulos escolhidos e a configuração ficam guardados para esse restaurante.",
      "Para continuar depois, abra Cartas salvas e selecione a versão desejada. Com uma carta salva aberta, use Duplicar para criar uma variação sem substituir a original.",
    ],
    tip: "Os preços vêm do cadastro atual. Confira-os antes de reimprimir e salve suas alterações antes de sair.",
  },
  {
    title: "Imprima ou salve em PDF",
    paragraphs: [
      "Revise os rótulos, os preços e todas as folhas na Pré-visualização. Clique em Imprimir / PDF para abrir a janela de impressão do navegador.",
      "Para gerar o arquivo, escolha Salvar como PDF como destino; para imprimir, selecione sua impressora. Confira o tamanho do papel e todas as páginas na prévia do navegador.",
      "No Chrome ou Edge, ative Gráficos de segundo plano em Mais configurações para preservar fundos e detalhes do desenho.",
    ],
    tip: "Salvar a carta no sistema e salvar um PDF são ações diferentes: faça os dois se precisar editar e compartilhar depois.",
  },
];

export function MenuHelpDialog() {
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);
  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (value) setStep(0); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-primary">
          <CircleHelp aria-hidden="true" /> Como usar
        </Button>
      </DialogTrigger>
      <DialogContent className="no-print flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl flex-col gap-0 overflow-hidden rounded-lg p-0">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-5 text-left">
          <DialogTitle className="flex items-center gap-2 pr-6 tracking-normal text-primary">
            <BookOpen className="h-5 w-5 shrink-0" aria-hidden="true" /> Como usar a Carta impressa
          </DialogTitle>
          <DialogDescription>Do cadastro dos vinhos à impressão, em seis passos.</DialogDescription>
        </DialogHeader>
        <div className="no-scrollbar min-h-0 overflow-y-auto px-6 py-5">
          <nav aria-label="Etapas do guia" className="mb-6 grid grid-cols-6 gap-2">
            {STEPS.map((item, index) => (
              <Button key={item.title} variant={index === step ? "default" : "outline"}
                className="h-9 min-w-0 px-0 tabular-nums" aria-current={index === step ? "step" : undefined}
                aria-label={`Passo ${index + 1}: ${item.title}`} title={item.title} onClick={() => setStep(index)}>
                {index + 1}
              </Button>
            ))}
          </nav>
          <section aria-live="polite" aria-atomic="true">
            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Passo {step + 1} de {STEPS.length}</p>
            <h2 className="mb-4 text-lg font-semibold">{current.title}</h2>
            <div className="space-y-3 text-sm leading-relaxed text-foreground">
              {current.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
            <p className="mt-5 border-l-2 border-primary pl-3 text-sm leading-relaxed text-muted-foreground">{current.tip}</p>
          </section>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-6 py-4">
          <Button variant="outline" size="sm" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>
            <ArrowLeft aria-hidden="true" /> Anterior
          </Button>
          {last ? (
            <Button size="sm" onClick={() => setOpen(false)}><Check aria-hidden="true" /> Concluir</Button>
          ) : (
            <Button size="sm" onClick={() => setStep((value) => value + 1)}>Próximo <ArrowRight aria-hidden="true" /></Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}