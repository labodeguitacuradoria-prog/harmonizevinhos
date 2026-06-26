import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database, Search, Plus, Edit, Trash2 } from "lucide-react";

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
        <button 
          onClick={() => setEditingItem({ name: "" })}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> Novo Rótulo
        </button>
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
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Nome do Rótulo</label>
                <input 
                  value={editingItem.name || ""} 
                  onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Produtor</label>
                <input 
                  value={editingItem.producer || ""} 
                  onChange={e => setEditingItem({ ...editingItem, producer: e.target.value })}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">País</label>
                <input 
                  value={editingItem.country || ""} 
                  onChange={e => setEditingItem({ ...editingItem, country: e.target.value })}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Região</label>
                <input 
                  value={editingItem.region || ""} 
                  onChange={e => setEditingItem({ ...editingItem, region: e.target.value })}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Uvas</label>
                <input 
                  value={editingItem.grape || ""} 
                  onChange={e => setEditingItem({ ...editingItem, grape: e.target.value })}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Tipo</label>
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
                <label className="text-xs font-medium uppercase text-muted-foreground">Volume</label>
                <input 
                  value={editingItem.volume || ""} 
                  onChange={e => setEditingItem({ ...editingItem, volume: e.target.value })}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Ex: 750ml"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">URL da Imagem</label>
                <input 
                  value={editingItem.image_url || ""} 
                  onChange={e => setEditingItem({ ...editingItem, image_url: e.target.value })}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="col-span-2 grid gap-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Notas de Degustação</label>
                <textarea 
                  value={editingItem.tasting_notes || ""} 
                  onChange={e => setEditingItem({ ...editingItem, tasting_notes: e.target.value })}
                  className="h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="col-span-2 grid gap-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Harmonização</label>
                <textarea 
                  value={editingItem.pairing_notes || ""} 
                  onChange={e => setEditingItem({ ...editingItem, pairing_notes: e.target.value })}
                  className="h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="col-span-2 grid gap-2">
                <label className="text-xs font-medium uppercase text-muted-foreground">Elaboração e Maturação</label>
                <textarea 
                  value={editingItem.aging || ""} 
                  onChange={e => setEditingItem({ ...editingItem, aging: e.target.value })}
                  className="h-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
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
