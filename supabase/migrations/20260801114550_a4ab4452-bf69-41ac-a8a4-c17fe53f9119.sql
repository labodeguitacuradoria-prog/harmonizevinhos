CREATE TABLE public.pairing_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'classic',
  title text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  guidance text NOT NULL,
  notes text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.pairing_knowledge TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pairing_knowledge TO authenticated;
GRANT ALL ON public.pairing_knowledge TO service_role;

ALTER TABLE public.pairing_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pairing_knowledge_read_active" ON public.pairing_knowledge
  FOR SELECT USING (active = true OR public.is_admin(auth.uid()));

CREATE POLICY "pairing_knowledge_admin_write" ON public.pairing_knowledge
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER pairing_knowledge_set_updated_at
  BEFORE UPDATE ON public.pairing_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.pairing_knowledge (kind, title, keywords, guidance, sort_order) VALUES
('classic','Ostras e frutos do mar iodados', ARRAY['ostra','ostras','frutos do mar','vieira','mariscos'],
 'Harmonização histórica obrigatória: Ostras com Chablis (Borgonha, casta **Chardonnay**, solo calcário Kimeridgiano). Alternativa nacional: espumante premium de **Chardonnay** e **Pinot Noir** do Vale dos Vinhedos ou **Alvarinho**/**Sauvignon Blanc** de altitude catarinense.',10),
('classic','Peixes gordos e taninos', ARRAY['salmão','atum','cavala','sardinha','peixe gordo'],
 'Nunca indique tintos tânicos ou com muito carvalho: a reação com os óleos do peixe gera retrogosto metálico. Prefira brancos de alta acidez, espumantes ou rosés secos.',20),
('classic','Sobremesas e doçura', ARRAY['sobremesa','doce','chocolate','torta','pudim','mousse'],
 'O vinho deve ser igual ou mais doce que a sobremesa. Indique colheita tardia, Moscatel, Porto, Sauternes ou vinhos de sobremesa nacionais; vinhos secos ficam amargos e metálicos.',30),
('classic','Pratos picantes', ARRAY['pimenta','picante','curry','apimentado','jalapeño','tailandês'],
 'Álcool alto e taninos firmes amplificam a queimação da capsaicina. Indique brancos aromáticos com leve açúcar residual (**Riesling**, **Gewürztraminer**), rosés frescos ou espumantes demi-sec.',40),
('classic','Alta untuosidade e gordura', ARRAY['manteiga','fritura','queijo','risoto','creme','confit','barriga'],
 'Corte a gordura com acidez (espumantes, brancos vibrantes) ou com taninos firmes em carnes vermelhas ricas (**Cabernet Sauvignon**, **Tannat**, **Syrah**).',50),
('classic','Acidez proeminente no prato', ARRAY['limão','vinagre','tomate','cítrico','ceviche','picles'],
 'O vinho precisa ter acidez igual ou superior à do prato, senão parecerá plano. Indique **Sauvignon Blanc**, **Riesling**, **Alvarinho**, **Sangiovese** ou **Barbera**.',60),
('classic','Grelhados e defumados', ARRAY['grelhado','brasa','churrasco','defumado','tostado','carvão'],
 'Amargor tostado combina com tintos frutados e taninos macios (**Merlot**, **Pinot Noir**, **Marselan**); taninos muito adstringentes somam amargor.',70),
('classic','Sal e umami', ARRAY['bacalhau','parmesão','presunto','shoyu','curados','embutidos'],
 'Salinidade pede acidez alta e efervescência: espumantes Método Tradicional, brancos minerais e rosés secos. Sal também amacia a percepção de taninos.',80),
('oak','Barrica leve (1 a 3 meses)', ARRAY['leve','fresco','frutado'],
 'Use vinhos com 1 a 3 meses de madeira quando o prato for delicado, com poucas notas tostadas: a madeira apenas arredonda a textura sem dominar.',110),
('oak','Barrica média (4 a 12 meses)', ARRAY['grelhado','assado','manteiga'],
 'Indique 4 a 12 meses de barrica para pratos assados, grelhados leves e molhos amanteigados: notas de baunilha e coco integram-se ao tostado do prato.',120),
('oak','Barrica longa (acima de 12 meses)', ARRAY['brasa','defumado','cordeiro','caça','queijo curado'],
 'Reserve vinhos com mais de 12 meses de madeira para pratos intensos, defumados na brasa, caça e queijos de longa cura, onde a complexidade terciária faz frente à intensidade.',130);