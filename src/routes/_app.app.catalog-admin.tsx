import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Database, Search, Plus, Edit, Trash2, Info } from "lucide-react";

function FieldLabel({ children, hint }: { children: React.ReactNode; hint: string }) {
  return (
    <label className="flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
      <span>{children}</span>
      <span
        title={hint}
        className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full text-muted-foreground/60 hover:text-primary"
        aria-label={hint}
      >
        <Info className="h-3 w-3" />
      </span>
    </label>
  );
}


export const Route = createFileRoute("/_app/app/catalog-admin")({
  component: CatalogAdmin,
});

type WineCatalog = {
  id: string;
  name: string;
  producer: string | null;
  region: string | null;
  country: string | null;
  grape: string | null;
  wine_type: string | null;
  volume: string | null;
  tasting_notes: string | null;
  pairing_notes: string | null;
  aging: string | null;
  image_url: string | null;
};

function CatalogAdmin() {
  const { role } = useAuth();
  const canEdit = role === "admin";
  const [items, setItems] = useState<WineCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingItem, setEditingItem] = useState<Partial<WineCatalog> | null>(null);


  useEffect(() => {
    fetchCatalog();
  }, []);

  async function fetchCatalog() {
    setLoading(true);
    const { data, error } = await supabase.from("wine_catalog").select("*").order("name", { ascending: true });
    if (data) setItems(data as WineCatalog[]);
    setLoading(false);
  }

  async function handleSave() {
    if (!editingItem || !editingItem.name) return;
    
    if (editingItem.id) {
      const { error } = await supabase.from("wine_catalog").update(editingItem as any).eq("id", editingItem.id);
      if (error) alert(error.message);
    } else {
      const { error } = await supabase.from("wine_catalog").insert([editingItem as any]);
      if (error) alert(error.message);
    }
    
    setEditingItem(null);
    fetchCatalog();
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza?")) return;
    const { error } = await supabase.from("wine_catalog").delete().eq("id", id);
    if (!error) fetchCatalog();
  }

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.producer?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Database className="h-8 w-8 text-primary" />
          <h1 className="page-title text-3xl font-bold tracking-tight">Catálogo Global</h1>
        </div>
        {canEdit && (
          <button 
            onClick={() => setEditingItem({ name: "" })}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Novo Rótulo
          </button>
        )}

      </header>

      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input 
            placeholder="Buscar por nome ou produtor..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-10 pr-4 py-2 text-sm"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Rótulo</th>
              <th className="px-4 py-3">Produtor</th>
              <th className="px-4 py-3">Região/País</th>
              <th className="px-4 py-3">Uvas</th>
              <th className="px-4 py-3">Volume</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredItems.map(item => (
              <tr key={item.id} className="hover:bg-accent/50">
                <td className="px-4 py-3 font-medium">{item.name}</td>
                <td className="px-4 py-3">{item.producer}</td>
                <td className="px-4 py-3">{item.region}, {item.country}</td>
                <td className="px-4 py-3">{item.grape}</td>
                <td className="px-4 py-3">{item.volume}</td>
                <td className="px-4 py-3 text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => setEditingItem(item)}
                        className="rounded p-1 hover:bg-accent"
                      >
                        <Edit className="h-4 w-4 text-primary" />
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="rounded p-1 hover:bg-accent"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    </div>
                  )}
                </td>

              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className="p-8 text-center">Carregando catálogo...</div>}
        {!loading && filteredItems.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">Nenhum item encontrado.</div>
        )}
      </div>

      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">{editingItem.id ? "Editar Rótulo" : "Novo Rótulo"}</h3>
              <button 
                onClick={() => setEditingItem(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            <p className="mb-4 text-xs italic text-muted-foreground/70">
              Os textos em cinza claro dentro dos campos são apenas exemplos. Passe o mouse no ícone <Info className="inline h-3 w-3" /> ao lado de cada rótulo para ver a explicação.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <FieldLabel hint="Nome completo do rótulo como aparece no contra-rótulo, sem incluir produtor ou safra. Ex.: 'Alpha Cabernet Sauvignon', 'Brut Réserve'.">
                  Nome do Rótulo
                </FieldLabel>
                <input
                  value={editingItem.name || ""}
                  onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                  placeholder="Ex: Alpha Cabernet Sauvignon"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/40"
                />
              </div>
              <div className="grid gap-2">
                <FieldLabel hint="Vinícola ou produtor responsável pela elaboração. Ex.: 'Viña Montes', 'Moët & Chandon'.">
                  Produtor
                </FieldLabel>
                <input
                  value={editingItem.producer || ""}
                  onChange={e => setEditingItem({ ...editingItem, producer: e.target.value })}
                  placeholder="Ex: Viña Montes"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/40"
                />
              </div>
              <div className="grid gap-2">
                <FieldLabel hint="País de origem do vinho, por extenso e em português. Ex.: 'Chile', 'França', 'Itália'.">
                  País
                </FieldLabel>
                <input
                  value={editingItem.country || ""}
                  onChange={e => setEditingItem({ ...editingItem, country: e.target.value })}
                  placeholder="Ex: Chile"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/40"
                />
              </div>
              <div className="grid gap-2">
                <FieldLabel hint="Região vitivinícola, denominação ou apelação de origem. Ex.: 'Vale do Colchagua', 'Bordeaux', 'Mendoza'.">
                  Região
                </FieldLabel>
                <input
                  value={editingItem.region || ""}
                  onChange={e => setEditingItem({ ...editingItem, region: e.target.value })}
                  placeholder="Ex: Vale do Colchagua"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/40"
                />
              </div>
              <div className="grid gap-2">
                <FieldLabel hint="Castas/uvas e seus percentuais quando houver corte. Separe por vírgula. Ex.: 'Cabernet Sauvignon 85%, Merlot 15%'.">
                  Uvas
                </FieldLabel>
                <input
                  value={editingItem.grape || ""}
                  onChange={e => setEditingItem({ ...editingItem, grape: e.target.value })}
                  placeholder="Ex: Cabernet Sauvignon 85%, Merlot 15%"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/40"
                />
              </div>
              <div className="grid gap-2">
                <FieldLabel hint="Categoria geral do vinho. Use 'Outros' apenas quando nenhuma das opções padrão se aplicar.">
                  Tipo
                </FieldLabel>
                <select
                  value={editingItem.wine_type || ""}
                  onChange={e => setEditingItem({ ...editingItem, wine_type: e.target.value })}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecione...</option>
                  <option value="Espumante">Espumante</option>
                  <option value="Branco">Branco</option>
                  <option value="Rosé">Rosé</option>
                  <option value="Tinto">Tinto</option>
                  <option value="Fortificado">Fortificado</option>
                  <option value="Sobremesa">Sobremesa</option>
                </select>
              </div>
              <div className="grid gap-2">
                <FieldLabel hint="Capacidade da garrafa em mililitros, com a unidade. Padrões comuns: 750ml, 375ml, 187ml, 1500ml (magnum).">
                  Volume
                </FieldLabel>
                <input
                  value={editingItem.volume || ""}
                  onChange={e => setEditingItem({ ...editingItem, volume: e.target.value })}
                  placeholder="Ex: 750ml"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/40"
                />
              </div>
              <div className="grid gap-2">
                <FieldLabel hint="Endereço (URL) público da foto do rótulo. Deve iniciar com https:// e apontar diretamente para uma imagem (.jpg, .png, .webp).">
                  URL da Imagem
                </FieldLabel>
                <input
                  value={editingItem.image_url || ""}
                  onChange={e => setEditingItem({ ...editingItem, image_url: e.target.value })}
                  placeholder="https://exemplo.com/rotulo.jpg"
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/40"
                />
              </div>
              <div className="col-span-2 grid gap-2">
                <FieldLabel hint="Descrição sensorial: cor, aromas, sabor, corpo, taninos e final de boca. Texto corrido, 2 a 4 linhas.">
                  Notas de Degustação
                </FieldLabel>
                <textarea
                  value={editingItem.tasting_notes || ""}
                  onChange={e => setEditingItem({ ...editingItem, tasting_notes: e.target.value })}
                  placeholder="Ex: Rubi intenso. Aromas de frutas negras maduras, especiarias e notas de baunilha. Em boca apresenta taninos firmes, corpo médio e final persistente."
                  className="h-20 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/40"
                />
              </div>
              <div className="col-span-2 grid gap-2">
                <FieldLabel hint="Sugestões gastronômicas: pratos, proteínas, queijos e temperos que combinam com o vinho.">
                  Harmonização
                </FieldLabel>
                <textarea
                  value={editingItem.pairing_notes || ""}
                  onChange={e => setEditingItem({ ...editingItem, pairing_notes: e.target.value })}
                  placeholder="Ex: Carnes vermelhas grelhadas, cordeiro, massas com molhos encorpados e queijos curados."
                  className="h-20 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/40"
                />
              </div>
              <div className="col-span-2 grid gap-2">
                <FieldLabel hint="Como o vinho foi vinificado e envelhecido: tipo de fermentação, tempo e tipo de barrica, guarda em garrafa, etc.">
                  Elaboração e Maturação
                </FieldLabel>
                <textarea
                  value={editingItem.aging || ""}
                  onChange={e => setEditingItem({ ...editingItem, aging: e.target.value })}
                  placeholder="Ex: Fermentação em tanques de inox, maturação por 12 meses em barricas de carvalho francês (30% novas) e 6 meses adicionais em garrafa."
                  className="h-20 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/40"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditingItem(null)}
                className="rounded-md px-4 py-2 text-sm font-medium hover:bg-accent"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
