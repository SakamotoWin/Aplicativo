import { useEffect, useState, useRef, useCallback } from "react";
import { apiFetch, apiFetchFirst, isAdmin } from "@/lib/api";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Gift, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface PremioItem {
  id?: string;
  data?: string;
  dataHora?: string;
  quantidade?: number;
  observacao?: string;
  maquinaNome?: string;
  estabelecimentoNome?: string;
  [key: string]: unknown;
}

interface PremiosResponse {
  premios?: PremioItem[];
  totalEntregues?: number;
  estoqueAtual?: number;
  [key: string]: unknown;
}

interface MaquinaItem {
  id: string;
  nome?: string;
}

interface ClienteItem {
  id: string;
  nome: string;
  Maquina: MaquinaItem[];
}

export default function Premios() {
  const [premios, setPremios] = useState<PremioItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // Step 1: fetch all machines
      let machines: (MaquinaItem & { estabelecimentoNome?: string })[] = [];
      if (isAdmin()) {
        const clientes = await apiFetch<ClienteItem[]>("/clientes");
        machines = Array.isArray(clientes) ? clientes.flatMap((c) => 
          (c.Maquina || []).map(m => ({ ...m, estabelecimentoNome: c.nome }))
        ) : [];
      } else {
        // Tentar plural e depois singular
        try {
          const list = await apiFetch<MaquinaItem[]>("/maquinas");
          machines = Array.isArray(list) ? list : [];
        } catch (err) {
          const list = await apiFetch<MaquinaItem[]>("/maquina");
          machines = Array.isArray(list) ? list : [];
        }
      }

      // Step 2: fetch prizes per machine
      const allPremios: PremioItem[] = [];
      await Promise.allSettled(
        machines.map(async (m) => {
          try {
            const paths = isAdmin()
              ? [`/premios-entregues-adm/${m.id}`, `/api/premios-entregues-adm/${m.id}`]
              : [`/premios-entregues/${m.id}`, `/api/premios-entregues/${m.id}`];
            
            const data = await apiFetchFirst<PremiosResponse | PremioItem[]>(paths);
            // Backend may return { premios: [...] } or an array directly
            let list: PremioItem[] = [];
            if (Array.isArray(data)) {
              list = data;
            } else if (data && typeof data === "object" && Array.isArray((data as PremiosResponse).premios)) {
              list = (data as PremiosResponse).premios!;
            }
            list.forEach((p) => {
              allPremios.push({ 
                ...p, 
                maquinaNome: m.nome || m.id, 
                estabelecimentoNome: (m as any).estabelecimentoNome 
              });
            });
          } catch (err) {
            console.warn(`[Premios] Erro máquina ${m.id}:`, err);
          }
        })
      );

      // Sort by date descending
      allPremios.sort((a, b) => {
        const da = a.data || a.dataHora;
        const db = b.data || b.dataHora;
        return (db ? new Date(db).getTime() : 0) - (da ? new Date(da).getTime() : 0);
      });

      setPremios(allPremios);
      setLastUpdate(new Date());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar prêmios");
      console.error("[Premios] Error:", err);
    }
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
    intervalRef.current = setInterval(fetchData, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  if (loading) return <LoadingSpinner text="Carregando prêmios..." />;

  const filtered = premios.filter(p => 
    p.maquinaNome?.toLowerCase().includes(search.toLowerCase()) || 
    p.estabelecimentoNome?.toLowerCase().includes(search.toLowerCase()) ||
    p.observacao?.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (p: PremioItem) => {
    const d = p.data || p.dataHora;
    return d ? new Date(d).toLocaleString("pt-BR") : "—";
  };

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-wider text-foreground">Prêmios Entregues</h1>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3 animate-spin text-primary/60" style={{ animationDuration: "3s" }} />
          {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Search Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por estabelecimento, máquina ou observação..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card/60 border-primary/10"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="border-border bg-card/60 p-8 text-center">
          <Gift className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum prêmio entregue encontrado</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((p, i) => (
            <Card key={p.id || i} className="border-border/40 bg-card/60 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                  <Gift className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {p.quantidade != null
                      ? `${p.quantidade}x prêmio${p.quantidade > 1 ? "s" : ""}`
                      : "Prêmio entregue"}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(p)}</p>
                  {(p.maquinaNome || p.estabelecimentoNome) && (
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {p.estabelecimentoNome || p.maquinaNome}
                      {p.estabelecimentoNome && p.maquinaNome && p.maquinaNome !== p.estabelecimentoNome && ` - ${p.maquinaNome}`}
                    </p>
                  )}
                  {p.observacao && (
                    <p className="text-xs text-muted-foreground/70 mt-1">{String(p.observacao)}</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
