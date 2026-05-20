import { useEffect, useState, useRef, useCallback } from "react";
import { apiFetch, isAdmin, getUserId, getUserType } from "@/lib/api";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Cpu, TrendingUp, Wifi, BarChart3, Zap, CreditCard, RefreshCw, Banknote } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface FormasPagamento {
  pix: number;
  especie: number;
  debito: number;
  credito: number;
  creditoRemoto: number;
}

interface EstatisticasData {
  totalVendas?: number;
  formasPagamento?: FormasPagamento;
  maquinasOnline?: number;
  maquinasTotal?: number;
  totalEstornos?: number;
  quantidadePremios?: number;
  [key: string]: unknown;
}

interface ClienteEstatistica {
  id: string;
  nome: string;
  stats: EstatisticasData;
}

const toNum = (v?: unknown): number => {
  if (v == null) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

const fmt = (v: number) => {
  return `R$ ${v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
};

type Periodo = "hoje" | "7dias" | "30dias" | "todos";

export default function Dashboard() {
  const [clienteStats, setClienteStats] = useState<ClienteEstatistica[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [periodo, setPeriodo] = useState<Periodo>("todos");
  const [search, setSearch] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (periodoParam?: Periodo) => {
    try {
      const userId = getUserId();
      const currentPeriodo = periodoParam || periodo;
      
      if (!userId) {
        console.warn("[Dashboard] Aguardando identificação do usuário...");
        return;
      }

      console.log("[Dashboard] Carregando estatísticas para:", { userId, isAdmin: isAdmin(), periodo: currentPeriodo });

      const periodoQuery = currentPeriodo !== "todos" ? `?periodo=${currentPeriodo}` : "";

      if (isAdmin()) {
        // Buscar lista de clientes
        const clientes = await apiFetch<{ id: string; nome: string }[]>("/clientes");
        console.log("[Dashboard] Clientes encontrados:", clientes?.length);

        const clienteResults: ClienteEstatistica[] = [];

        if (Array.isArray(clientes) && clientes.length > 0) {
          const results = await Promise.allSettled(
            clientes.map(c => apiFetch<EstatisticasData>(`/estatisticas-gerais/${c.id}${periodoQuery}`))
          );

          results.forEach((r, index) => {
            if (r.status === "fulfilled" && r.value) {
              clienteResults.push({
                id: clientes[index].id,
                nome: clientes[index].nome || `Cliente ${index + 1}`,
                stats: r.value,
              });
            }
          });
        }

        setClienteStats(clienteResults);
      } else {
        // Cliente normal: buscar apenas suas próprias estatísticas
        const stats = await apiFetch<EstatisticasData>(`/estatisticas-gerais/${userId}${periodoQuery}`);
        setClienteStats([{
          id: userId,
          nome: "Minhas Estatísticas",
          stats,
        }]);
      }

      setLastUpdate(new Date());
      setError("");
    } catch (err) {
      console.warn("[Dashboard] Erro ao carregar estatísticas:", err);
      setError(err instanceof Error ? err.message : "Erro ao carregar dashboard");
    }
  }, [periodo]);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
    intervalRef.current = setInterval(() => fetchData(), 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  const handlePeriodoChange = (newPeriodo: Periodo) => {
    setPeriodo(newPeriodo);
    setLoading(true);
    fetchData(newPeriodo).finally(() => setLoading(false));
  };

  if (loading) return <LoadingSpinner text="Carregando dashboard..." />;

  // Filtrar por busca
  const filtered = clienteStats.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase())
  );

  // Calcular totais gerais
  const totais: EstatisticasData = {
    totalVendas: 0,
    formasPagamento: { pix: 0, especie: 0, debito: 0, credito: 0, creditoRemoto: 0 },
    maquinasOnline: 0,
    maquinasTotal: 0,
    totalEstornos: 0,
    quantidadePremios: 0,
  };

  filtered.forEach(c => {
    const d = c.stats;
    totais.totalVendas = (totais.totalVendas || 0) + toNum(d.totalVendas);
    totais.totalEstornos = (totais.totalEstornos || 0) + toNum(d.totalEstornos);
    totais.maquinasOnline = (totais.maquinasOnline || 0) + toNum(d.maquinasOnline);
    totais.maquinasTotal = (totais.maquinasTotal || 0) + toNum(d.maquinasTotal);
    totais.quantidadePremios = (totais.quantidadePremios || 0) + toNum(d.quantidadePremios);
    if (d.formasPagamento) {
      const fp = totais.formasPagamento as FormasPagamento;
      fp.pix += toNum(d.formasPagamento.pix);
      fp.especie += toNum(d.formasPagamento.especie);
      fp.debito += toNum(d.formasPagamento.debito);
      fp.credito += toNum(d.formasPagamento.credito);
      fp.creditoRemoto += toNum(d.formasPagamento.creditoRemoto);
    }
  });

  const fp = totais.formasPagamento as FormasPagamento;

  const periodos: { label: string; value: Periodo }[] = [
    { label: "Hoje", value: "hoje" },
    { label: "7 dias", value: "7dias" },
    { label: "30 dias", value: "30dias" },
    { label: "Todos", value: "todos" },
  ];

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-wider text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAdmin() ? "Visão geral do administrador" : "Sua visão geral"} • Atualizado às{" "}
          {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Filtro de Período */}
      <Card className="border-primary/10 bg-card/60 p-3">
        <div className="flex items-center gap-2 flex-wrap">
          {periodos.map((p) => (
            <Button
              key={p.value}
              variant={periodo === p.value ? "default" : "outline"}
              size="sm"
              className={`text-xs h-8 ${periodo === p.value ? "shadow-gold" : "border-primary/20"}`}
              onClick={() => handlePeriodoChange(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </Card>

      {/* Busca */}
      {isAdmin() && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por estabelecimento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card/60 border-primary/10"
          />
        </div>
      )}

      {/* Totais Gerais */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-4 shadow-gold">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 border border-primary/30">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Geral</p>
            <p className="font-display text-2xl font-bold text-primary">{fmt(toNum(totais.totalVendas))}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatRow icon={Banknote} label="PIX" value={fmt(fp.pix)} color="text-blue-400" />
          <StatRow icon={Banknote} label="Espécie" value={fmt(fp.especie)} color="text-green-400" />
          <StatRow icon={CreditCard} label="Débito" value={fmt(fp.debito)} color="text-yellow-400" />
          <StatRow icon={CreditCard} label="Crédito" value={fmt(fp.credito)} color="text-purple-400" />
          <StatRow icon={Cpu} label="Cred. Remoto" value={fmt(fp.creditoRemoto)} color="text-cyan-400" />
          <StatRow icon={Wifi} label="Máquinas Online" value={`${toNum(totais.maquinasOnline)}/${toNum(totais.maquinasTotal)}`} color="text-success" />
        </div>
      </Card>

      {/* Lista por Estabelecimento/Cliente */}
      {isAdmin() && filtered.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
            Por Estabelecimento
          </h2>
          {filtered.map((c) => {
            const cfp = c.stats.formasPagamento;
            return (
              <Card key={c.id} className="border-border/40 bg-card/60 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Cpu className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold text-foreground">{c.nome}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {toNum(c.stats.maquinasOnline)}/{toNum(c.stats.maquinasTotal)} máquinas online
                      </p>
                    </div>
                  </div>
                  <p className="font-display text-base font-bold text-primary">{fmt(toNum(c.stats.totalVendas))}</p>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <StatRow icon={Banknote} label="PIX" value={fmt(toNum(cfp?.pix))} color="text-blue-400" small />
                  <StatRow icon={Banknote} label="Espécie" value={fmt(toNum(cfp?.especie))} color="text-green-400" small />
                  <StatRow icon={CreditCard} label="Débito" value={fmt(toNum(cfp?.debito))} color="text-yellow-400" small />
                  <StatRow icon={CreditCard} label="Crédito" value={fmt(toNum(cfp?.credito))} color="text-purple-400" small />
                  <StatRow icon={Cpu} label="C. Remoto" value={fmt(toNum(cfp?.creditoRemoto))} color="text-cyan-400" small />
                  <StatRow icon={BarChart3} label="Estornos" value={fmt(toNum(c.stats.totalEstornos))} color="text-destructive" small />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && !error && (
        <Card className="border-border bg-card/60 p-8 text-center">
          <TrendingUp className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum dado encontrado</p>
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
