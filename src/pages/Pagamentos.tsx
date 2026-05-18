import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch, isAdmin } from "@/lib/api";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Wallet, TrendingUp, Banknote, CreditCard, RefreshCw, Cpu } from "lucide-react";
import { Card } from "@/components/ui/card";

interface MaquinaItem {
  id: string;
  nome?: string;
}

interface ClienteItem {
  id: string;
  nome: string;
  Maquina: MaquinaItem[];
}

interface PagamentosData {
  // Client fields
  total?: number | string;
  pix?: number | string;
  especie?: number | string;
  debito?: number | string;
  creditoRemoto?: number | string;
  // Admin fields
  cash?: number | string;
  creditosRemotos?: number | string;
  credito?: number | string;
  [key: string]: unknown;
}

interface MaquinaResumo {
  id: string;
  nome: string;
  estabelecimentoNome?: string;
  total: number;
  pix: number;
  especie: number;
  debito: number;
  creditoRemoto: number;
}

const toNum = (v?: unknown): number => {
  if (v == null) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

const fmt = (v: number) => {
  return `R$ ${v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
};

import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export default function Pagamentos() {
  const [resumos, setResumos] = useState<MaquinaResumo[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // Fetch all machines
      let machines: (MaquinaItem & { estabelecimentoNome?: string })[] = [];
      if (isAdmin()) {
        const clientes = await apiFetch<ClienteItem[]>("/clientes");
        machines = Array.isArray(clientes) ? clientes.flatMap((c) => 
          (c.Maquina || []).map(m => ({ ...m, estabelecimentoNome: c.nome }))
        ) : [];
      } else {
        // O servidor usa /maquina no singular
        const list = await apiFetch<MaquinaItem[]>("/maquina");
        machines = Array.isArray(list) ? list : [];
      }

      // Fetch pagamentos per machine
      const results: MaquinaResumo[] = [];
      await Promise.allSettled(
        machines.map(async (m) => {
          try {
            const path = isAdmin() ? `/pagamentos-adm/${m.id}` : `/pagamentos/${m.id}`;
            const data = await apiFetch<PagamentosData>(path);
            results.push({
              id: m.id,
              nome: m.nome || m.id,
              estabelecimentoNome: (m as any).estabelecimentoNome,
              total: toNum(data.total),
              pix: toNum(data.pix),
              especie: toNum(data.especie ?? data.cash),
              debito: toNum(data.debito),
              creditoRemoto: toNum(data.creditoRemoto ?? data.creditosRemotos),
            });
          } catch (err) {
            console.warn(`[Pagamentos] Erro máquina ${m.id}:`, err);
          }
        })
      );

      results.sort((a, b) => b.total - a.total);
      setResumos(results);
      setLastUpdate(new Date());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar pagamentos");
      console.error("[Pagamentos] Error:", err);
    }
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
    intervalRef.current = setInterval(fetchData, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  if (loading) return <LoadingSpinner text="Carregando pagamentos..." />;

  const filtered = resumos.filter(r => 
    r.nome.toLowerCase().includes(search.toLowerCase()) || 
    r.estabelecimentoNome?.toLowerCase().includes(search.toLowerCase())
  );

  const grandTotal = filtered.reduce((acc, r) => acc + r.total, 0);
  const grandPix = filtered.reduce((acc, r) => acc + r.pix, 0);
  const grandEspecie = filtered.reduce((acc, r) => acc + r.especie, 0);
  const grandDebito = filtered.reduce((acc, r) => acc + r.debito, 0);
  const grandCredito = filtered.reduce((acc, r) => acc + r.creditoRemoto, 0);

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-wider text-foreground">Pagamentos</h1>
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
          placeholder="Buscar por estabelecimento ou máquina..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-card/60 border-primary/10"
        />
      </div>

      {/* Grand total card */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-4 shadow-gold">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 border border-primary/30">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Geral</p>
            <p className="font-display text-2xl font-bold text-primary">{fmt(grandTotal)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatRow icon={Banknote} label="PIX" value={fmt(grandPix)} color="text-blue-400" />
          <StatRow icon={Banknote} label="Espécie" value={fmt(grandEspecie)} color="text-green-400" />
          <StatRow icon={CreditCard} label="Débito" value={fmt(grandDebito)} color="text-yellow-400" />
          <StatRow icon={CreditCard} label="Cred. Remoto" value={fmt(grandCredito)} color="text-purple-400" />
        </div>
      </Card>

      {/* Per machine breakdown */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
            Por Máquina
          </h2>
          {filtered.map((r) => (
            <Card key={r.id} className="border-border/40 bg-card/60 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Cpu className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex flex-col">
                    <p className="text-sm font-semibold text-foreground">
                      {r.estabelecimentoNome || r.nome}
                    </p>
                    {r.estabelecimentoNome && r.nome !== r.estabelecimentoNome && (
                      <p className="text-[10px] text-muted-foreground/60">{r.nome}</p>
                    )}
                  </div>
                </div>
                <p className="font-display text-base font-bold text-primary">{fmt(r.total)}</p>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <StatRow icon={Banknote} label="PIX" value={fmt(r.pix)} color="text-blue-400" small />
                <StatRow icon={Banknote} label="Espécie" value={fmt(r.especie)} color="text-green-400" small />
                <StatRow icon={CreditCard} label="Débito" value={fmt(r.debito)} color="text-yellow-400" small />
                <StatRow icon={CreditCard} label="C. Remoto" value={fmt(r.creditoRemoto)} color="text-purple-400" small />
              </div>
            </Card>
          ))}
        </div>
      )}

      {resumos.length === 0 && !error && (
        <Card className="border-border bg-card/60 p-8 text-center">
          <TrendingUp className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum pagamento encontrado</p>
        </Card>
      )}
    </div>
  );
}

function StatRow({
  icon: Icon,
  label,
  value,
  color,
  small,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  small?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-secondary/40 px-2 py-1.5">
      <Icon className={`h-3 w-3 shrink-0 ${color}`} />
      <span className={`text-muted-foreground ${small ? "text-[10px]" : "text-xs"}`}>{label}</span>
      <span className={`ml-auto font-medium text-foreground ${small ? "text-[10px]" : "text-xs"}`}>
        {value}
      </span>
    </div>
  );
}