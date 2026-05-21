import { useEffect, useState, useRef, useCallback } from "react";
import { apiFetch, isAdmin, getUserId } from "@/lib/api";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Cpu, TrendingUp, Wifi, BarChart3, CreditCard, RefreshCw, Banknote } from "lucide-react";
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

      const periodoQuery = currentPeriodo !== "todos" ? `?periodo=${currentPeriodo}` : "";

      if (isAdmin()) {
        // Para Admin, buscamos primeiro as estatísticas globais usando o ADMIN_MASTER_ID
        // getUserId() já retorna o ADMIN_MASTER_ID se isAdmin() for true
        let globalStats: EstatisticasData = {};
        try {
          globalStats = await apiFetch<EstatisticasData>(`/estatisticas-gerais/${userId}${periodoQuery}`);
        } catch (err) {
          console.warn("[Dashboard] Erro ao carregar estatísticas globais:", err);
        }
        
        // Também buscamos a lista de clientes para detalhamento
        let clientes: { id: string; nome: string }[] = [];
        try {
          clientes = await apiFetch<{ id: string; nome: string }[]>("/clientes");
        } catch (err) {
          console.warn("[Dashboard] Erro ao carregar lista de clientes:", err);
        }
        
        const clienteResults: ClienteEstatistica[] = [];
        
        // Adicionamos o resumo global como o primeiro item
        clienteResults.push({
          id: "global",
          nome: "Resumo Geral",
          stats: globalStats,
        });

        if (Array.isArray(clientes) && clientes.length > 0) {
          // Buscamos estatísticas individuais de cada cliente
          const results = await Promise.allSettled(
            clientes.map(c => apiFetch<EstatisticasData>(`/estatisticas-gerais/${c.id}${periodoQuery}`))
          );

          results.forEach((r, index) => {
            if (r.status === "fulfilled" && r.value) {
              clienteResults.push({
                id: clientes[index].id,
                nome: clientes[index].nome || `Estabelecimento ${index + 1}`,
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
      console.warn("[Dashboard] Erro fatal no Dashboard:", err);
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

  // Separar o resumo global dos clientes individuais
  const globalEntry = clienteStats.find(c => c.id === "global");
  const individualStats = clienteStats.filter(c => c.id !== "global");

  // Filtrar estatísticas individuais por busca
  const filtered = individualStats.filter(c =>
    c.nome.toLowerCase().includes(search.toLowerCase())
  );

  // Usar os dados globais se existirem, senão calcular a partir dos filtrados (fallback)
  const totais: EstatisticasData = globalEntry && Object.keys(globalEntry.stats).length > 0 
    ? globalEntry.stats 
    : {
        totalVendas: 0,
        formasPagamento: { pix: 0, especie: 0, debito: 0, credito: 0, creditoRemoto: 0 },
        maquinasOnline: 0,
        maquinasTotal: 0,
        totalEstornos: 0,
        quantidadePremios: 0,
      };

  // Se não temos dados globais reais, somamos os individuais
  if (!globalEntry || Object.keys(globalEntry.stats).length === 0) {
    individualStats.forEach(c => {
      const d = c.stats;
      totais.totalVendas = (totais.totalVendas || 0) + toNum(d.totalVendas);
      totais.totalEstornos = (totais.totalEstornos || 0) + toNum(d.totalEstornos);
      totais.maquinasOnline = (totais.maquinasOnline || 0) + toNum(d.maquinasOnline);
      totais.maquinasTotal = (totais.maquinasTotal || 0) + toNum(d.maquinasTotal);
      totais.quantidadePremios = (totais.quantidadePremios || 0) + toNum(d.quantidadePremios);
      if (d.formasPagamento) {
        if (!totais.formasPagamento) totais.formasPagamento = { pix: 0, especie: 0, debito: 0, credito: 0, creditoRemoto: 0 };
        const fp = totais.formasPagamento as FormasPagamento;
        fp.pix += toNum(d.formasPagamento.pix);
        fp.especie += toNum(d.formasPagamento.especie);
        fp.debito += toNum(d.formasPagamento.debito);
        fp.credito += toNum(d.formasPagamento.credito);
        fp.creditoRemoto += toNum(d.formasPagamento.creditoRemoto);
      }
    });
  }

  const fp = (totais.formasPagamento as FormasPagamento) || { pix: 0, especie: 0, debito: 0, credito: 0, creditoRemoto: 0 };

  const periodos: { label: string; value: Periodo }[] = [
    { label: "Hoje", value: "hoje" },
    { label: "7 dias", value: "7dias" },
    { label: "30 dias", value: "30dias" },
    { label: "Todos", value: "todos" },
  ];

  return (
    <div className="animate-fade-in space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-wider text-foreground">Dashboard</h1>
          <p className="mt-1 text-[10px] text-muted-foreground uppercase tracking-widest">
            {isAdmin() ? "Administrador" : "Cliente"} • {lastUpdate.toLocaleTimeString("pt-BR")}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/5">
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Filtro de Período */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {periodos.map((p) => (
          <Button
            key={p.value}
            variant={periodo === p.value ? "default" : "outline"}
            size="sm"
            className={`text-xs h-8 px-4 rounded-full transition-all ${
              periodo === p.value 
                ? "bg-primary text-primary-foreground shadow-gold border-primary" 
                : "bg-card/40 border-primary/10 text-muted-foreground"
            }`}
            onClick={() => handlePeriodoChange(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Totais Gerais */}
      <Card className="relative overflow-hidden border-primary/30 bg-card p-5 shadow-gold">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-3xl" />
        <div className="relative space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Vendas Totais</p>
            <p className="font-display text-3xl font-bold text-primary">{fmt(toNum(totais.totalVendas))}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <StatBox label="PIX" value={fmt(fp.pix)} color="text-blue-400" />
            <StatBox label="Espécie" value={fmt(fp.especie)} color="text-green-400" />
            <StatBox label="Débito" value={fmt(fp.debito)} color="text-yellow-400" />
            <StatBox label="Crédito" value={fmt(fp.credito)} color="text-purple-400" />
          </div>

          <div className="pt-2 border-t border-primary/10 grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2">
              <Wifi className="h-3.5 w-3.5 text-success" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-muted-foreground uppercase">Online</span>
                <span className="text-xs font-bold text-foreground">{toNum(totais.maquinasOnline)}/{toNum(totais.maquinasTotal)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5 text-destructive" />
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-muted-foreground uppercase">Estornos</span>
                <span className="text-xs font-bold text-foreground">{fmt(toNum(totais.totalEstornos))}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Busca */}
      {isAdmin() && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar estabelecimento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card/60 border-primary/10 h-10 rounded-xl"
          />
        </div>
      )}

      {/* Lista por Estabelecimento/Cliente */}
      {isAdmin() && filtered.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Estabelecimentos ({filtered.length})
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            {filtered.map((c) => {
              const cfp = c.stats.formasPagamento || { pix: 0, especie: 0, debito: 0, credito: 0, creditoRemoto: 0 };
              return (
                <Card key={c.id} className="border-primary/5 bg-card/40 p-4 transition-all active:scale-[0.98]">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/10">
                        <Cpu className="h-4.5 w-4.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{c.nome}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {toNum(c.stats.maquinasOnline)} de {toNum(c.stats.maquinasTotal)} online
                        </p>
                      </div>
                    </div>
                    <p className="font-display text-base font-bold text-primary">{fmt(toNum(c.stats.totalVendas))}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <StatRow icon={Banknote} label="PIX" value={fmt(toNum(cfp.pix))} color="text-blue-400" small />
                    <StatRow icon={Banknote} label="Espécie" value={fmt(toNum(cfp.especie))} color="text-green-400" small />
                    <StatRow icon={CreditCard} label="Débito" value={fmt(toNum(cfp.debito))} color="text-yellow-400" small />
                    <StatRow icon={CreditCard} label="Crédito" value={fmt(toNum(cfp.credito))} color="text-purple-400" small />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {clienteStats.length === 0 && !error && (
        <Card className="border-dashed border-primary/20 bg-card/20 p-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/5 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-primary/20" />
            </div>
            <p className="text-sm text-muted-foreground">Nenhum dado disponível no momento</p>
          </div>
        </Card>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-primary/5 p-2.5 border border-primary/5">
      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
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
    <div className="flex items-center gap-2 rounded-lg bg-secondary/30 px-2 py-1.5 border border-primary/5">
      <Icon className={`h-3 w-3 shrink-0 ${color}`} />
      <div className="flex flex-col">
        <span className="text-[8px] font-bold text-muted-foreground uppercase leading-none mb-0.5">{label}</span>
        <span className={`font-bold text-foreground ${small ? "text-[10px]" : "text-xs"}`}>
          {value}
        </span>
      </div>
    </div>
  );
}
