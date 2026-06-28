import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Building2, Save, Plus, Trash2, Mail, Phone, Globe, Instagram, FileText, Clock, MapPin, Users } from "lucide-react";

export const Route = createFileRoute("/_app/app/restaurant-profile")({
  component: RestaurantProfile,
});

type Restaurant = {
  id: string;
  name: string;
  legal_name: string | null;
  cnpj: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip_code: string | null;
  delivery_instructions: string | null;
  business_hours: string | null;
  website: string | null;
  instagram: string | null;
};

type Contact = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
};

type WineList = {
  id: string;
  file_url: string;
  version_label: string | null;
  is_current: boolean;
  created_at: string;
};

function RestaurantProfile() {
  const { restaurantId } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [wineLists, setWineLists] = useState<WineList[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (restaurantId) {
      fetchData();
    }
  }, [restaurantId]);

  async function fetchData() {
    if (!restaurantId) return;
    setLoading(true);
    const { data: rest } = await supabase.from("restaurants").select("*").eq("id", restaurantId).single();
    const { data: cont } = await supabase.from("restaurant_contacts").select("*").eq("restaurant_id", restaurantId).order("created_at", { ascending: true });
    const { data: lists } = await supabase.from("restaurant_wine_lists").select("*").eq("restaurant_id", restaurantId).order("created_at", { ascending: false });

    if (rest) setRestaurant(rest as Restaurant);
    if (cont) setContacts(cont as Contact[]);
    if (lists) setWineLists(lists.map(l => ({ ...l, is_current: !!l.is_current })) as WineList[]);
    setLoading(false);
  }

  async function handleSaveRestaurant() {
    if (!restaurant || !restaurantId) return;
    setSaving(true);
    const { error } = await supabase.from("restaurants").update(restaurant).eq("id", restaurantId);
    if (error) alert("Erro ao salvar: " + error.message);
    setSaving(false);
  }

  async function handleAddContact() {
    if (!restaurantId) return;
    const newContact = {
      restaurant_id: restaurantId,
      name: "Novo Contato",
      role: "",
      email: "",
      phone: "",
      whatsapp: "",
    };
    const { data, error } = await supabase.from("restaurant_contacts").insert(newContact).select().single();
    if (data) setContacts([...contacts, data as Contact]);
  }

  function handleUpdateContactLocal(id: string, updates: Partial<Contact>) {
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }

  async function handleSaveContact(id: string, updates: Partial<Contact>) {
    await supabase.from("restaurant_contacts").update(updates).eq("id", id);
  }

  async function handleDeleteContact(id: string) {
    const { error } = await supabase.from("restaurant_contacts").delete().eq("id", id);
    if (!error) {
      setContacts(contacts.filter(c => c.id !== id));
    }
  }


  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !restaurantId) return;

    const fileExt = file.name.split('.').pop();
    const fileName = `${restaurantId}/${Math.random()}.${fileExt}`;
    const filePath = `wine-lists/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("product-media")
      .upload(filePath, file);

    if (uploadError) {
      alert("Erro no upload: " + uploadError.message);
      return;
    }

    const { data: urlData } = supabase.storage.from("product-media").getPublicUrl(filePath);
    
    const { data, error } = await supabase.from("restaurant_wine_lists").insert({
      restaurant_id: restaurantId,
      file_url: urlData.publicUrl,
      version_label: `Versão ${new Date().toLocaleDateString()}`,
      is_current: true
    }).select().single();

    if (data) {
      const newList = { ...data, is_current: !!data.is_current } as WineList;
      setWineLists([newList, ...wineLists.map(l => ({ ...l, is_current: false }))]);
    }
  }

  if (loading) return <div className="p-8">Carregando...</div>;

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <h1 className="page-title text-3xl font-bold tracking-tight">Perfil do Restaurante</h1>
        </div>
        <button 
          onClick={handleSaveRestaurant}
          disabled={saving}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar Alterações"}
        </button>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Informações Gerais */}
        <section className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Building2 className="h-5 w-5 text-primary" />
            Dados Institucionais
          </h2>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Nome Fantasia</label>
              <input 
                value={restaurant?.name || ""} 
                onChange={e => setRestaurant({ ...restaurant!, name: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Razão Social</label>
              <input 
                value={restaurant?.legal_name || ""} 
                onChange={e => setRestaurant({ ...restaurant!, legal_name: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">CNPJ</label>
              <input 
                value={restaurant?.cnpj || ""} 
                onChange={e => setRestaurant({ ...restaurant!, cnpj: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="00.000.000/0000-00"
              />
            </div>
          </div>
        </section>

        {/* Endereço */}
        <section className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MapPin className="h-5 w-5 text-primary" />
            Localização
          </h2>
          <div className="grid gap-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 grid gap-2">
                <label className="text-sm font-medium">Rua</label>
                <input 
                  value={restaurant?.address_street || ""} 
                  onChange={e => setRestaurant({ ...restaurant!, address_street: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Número</label>
                <input 
                  value={restaurant?.address_number || ""} 
                  onChange={e => setRestaurant({ ...restaurant!, address_number: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Bairro</label>
                <input 
                  value={restaurant?.address_neighborhood || ""} 
                  onChange={e => setRestaurant({ ...restaurant!, address_neighborhood: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">CEP</label>
                <input 
                  value={restaurant?.address_zip_code || ""} 
                  onChange={e => setRestaurant({ ...restaurant!, address_zip_code: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Cidade</label>
                <input 
                  value={restaurant?.address_city || ""} 
                  onChange={e => setRestaurant({ ...restaurant!, address_city: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Estado</label>
                <input 
                  value={restaurant?.address_state || ""} 
                  onChange={e => setRestaurant({ ...restaurant!, address_state: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Horários e Entrega */}
        <section className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Clock className="h-5 w-5 text-primary" />
            Operação
          </h2>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Horário de Funcionamento (Texto Livre)</label>
              <textarea 
                value={restaurant?.business_hours || ""} 
                onChange={e => setRestaurant({ ...restaurant!, business_hours: e.target.value })}
                className="h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Ex: Seg-Sex: 12h-23h, Sab: 12h-00h..."
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Instruções de Recebimento / Entrega</label>
              <textarea 
                value={restaurant?.delivery_instructions || ""} 
                onChange={e => setRestaurant({ ...restaurant!, delivery_instructions: e.target.value })}
                className="h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Ex: Entrar pela porta lateral, falar com o encarregado do estoque..."
              />
            </div>
          </div>
        </section>

        {/* Presença Digital */}
        <section className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Globe className="h-5 w-5 text-primary" />
            Links e Redes
          </h2>
          <div className="grid gap-4">
            <div className="flex items-center gap-3">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <input 
                value={restaurant?.website || ""} 
                onChange={e => setRestaurant({ ...restaurant!, website: e.target.value })}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="https://restaurante.com.br"
              />
            </div>
            <div className="flex items-center gap-3">
              <Instagram className="h-4 w-4 text-muted-foreground" />
              <input 
                value={restaurant?.instagram || ""} 
                onChange={e => setRestaurant({ ...restaurant!, instagram: e.target.value })}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="@restaurante"
              />
            </div>
          </div>
        </section>
      </div>

      {/* Contatos */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Users className="h-5 w-5 text-primary" />
            Contatos do Restaurante
          </h2>
          <button 
            onClick={handleAddContact}
            className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar Contato
          </button>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {contacts.map(contact => (
            <div key={contact.id} className="relative space-y-3 rounded-lg border border-border p-4">
              <button 
                onClick={() => handleDeleteContact(contact.id)}
                className="absolute right-2 top-2 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <input 
                value={contact.name} 
                onChange={e => handleUpdateContact(contact.id, { name: e.target.value })}
                className="w-full border-none bg-transparent p-0 text-sm font-semibold focus:ring-0"
                placeholder="Nome"
              />
              <input 
                value={contact.role || ""} 
                onChange={e => handleUpdateContact(contact.id, { role: e.target.value })}
                className="w-full border-none bg-transparent p-0 text-xs text-muted-foreground focus:ring-0"
                placeholder="Cargo (ex: Financeiro, Gerente)"
              />
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <input 
                    value={contact.email || ""} 
                    onChange={e => handleUpdateContact(contact.id, { email: e.target.value })}
                    className="w-full border-none bg-transparent p-0 text-xs focus:ring-0"
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <input 
                    value={contact.phone || ""} 
                    onChange={e => handleUpdateContact(contact.id, { phone: e.target.value })}
                    className="w-full border-none bg-transparent p-0 text-xs focus:ring-0"
                    placeholder="Telefone"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Cartas de Vinho */}
      <section className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FileText className="h-5 w-5 text-primary" />
            Cartas de Vinhos (PDF)
          </h2>
          <div className="relative">
            <input 
              type="file" 
              accept=".pdf" 
              onChange={handleFileUpload}
              className="absolute inset-0 cursor-pointer opacity-0" 
            />
            <button className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent">
              <Plus className="h-3.5 w-3.5" /> Upload Nova Carta
            </button>
          </div>
        </div>

        <div className="grid gap-3">
          {wineLists.map(list => (
            <div key={list.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">{list.version_label}</div>
                  <div className="text-xs text-muted-foreground">{new Date(list.created_at).toLocaleDateString()}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {list.is_current && (
                  <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                    ATUAL
                  </span>
                )}
                <a 
                  href={list.file_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Visualizar
                </a>
              </div>
            </div>
          ))}
          {wineLists.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma carta de vinhos enviada ainda.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
