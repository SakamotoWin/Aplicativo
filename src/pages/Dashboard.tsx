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

      console.log("[Dashboard] Iniciando busca de dados. UserID:", userId, "isAdmin:", isAdmin(), "Periodo:", currentPeriodo);

      if (isAdmin()) {
        const clienteResults: ClienteEstatistica[] = [];
        const loggedUserId = localStorage.getItem("userId");
        
        // 1. Buscar estatísticas globais (Resumo Geral)
        // Tentamos primeiro com o ADMIN_MASTER_ID (userId) e depois com o ID do próprio admin logado
        const idsToTry = [userId, loggedUserId].filter((id, index, self) => id && self.indexOf(id) === index);
        
        let globalStatsLoaded = false;
        for (const id of idsToTry) {
          try {
            const url = `/estatisticas-gerais/${id}${periodoQuery}`;
            console.log(`[Dashboard] Tentando estatísticas globais com ID ${id}:`, url);
            const globalStats = await apiFetch<EstatisticasData>(url);
            
            if (globalStats) {
              console.log(`[Dashboard] Estatísticas globais recebidas para ID ${id}:`, globalStats);
              clienteResults.push({
                id: "global",
                nome: "Resumo Geral",
                stats: globalStats,
              });
              globalStatsLoaded = true;
              break; // Sucesso, não precisa tentar o próximo ID
            }
          } catch (err) {
            console.warn(`[Dashboard] Falha ao buscar estatísticas para ID ${id}:`, err);
          }
        }

        if (!globalStatsLoaded) {
          console.error("[Dashboard] Não foi possível carregar estatísticas globais com nenhum ID disponível.");
        }

        // 2. Buscar lista de clientes para detalhes individuais
        let clientes: { id: string; nome: string }[] = [];
        try {
          clientes = await apiFetch<{ id: string; nome: string }[]>("/clientes");
          
          if (Array.isArray(clientes) && clientes.length > 0) {
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
        } catch (err) {
          console.warn("[Dashboard] Erro ao carregar lista de clientes:", err);
        }

        setClienteStats(clienteResults);
      } else {
        // Cliente normal
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

  // LÓGICA DE CONSOLIDAÇÃO:
  // Se temos uma entrada global com valores reais, usamos ela.
  // Caso contrário, calculamos a soma de todos os clientes individuais.
  const totais: EstatisticasData = {
    totalVendas: 0,
    formasPagamento: { pix: 0, especie: 0, debito: 0, credito: 0, creditoRemoto: 0 },
    maquinasOnline: 0,
    maquinasTotal: 0,
    totalEstornos: 0,
    quantidadePremios: 0,
  };

  if (globalEntry) {
    // Usar dados globais do servidor (mesmo que totalVendas seja 0, pois pode haver máquinas online)
    Object.assign(totais, globalEntry.stats);
  } else if (individualStats.length > 0) {
    // Calcular soma manual (fallback robusto)
    individualStats.forEach(c => {
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
          <h1 className="font-display text-2xl font-bold tracking-wider text-foreground uppercase">Dashboard</h1>
          <p className="mt-1 text-[10px] text-muted-foreground uppercase tracking-[2px]">
            {isAdmin() ? "ADMINISTRADOR" : "CLIENTE"} • {lastUpdate.toLocaleTimeString("pt-BR")}
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
            className={`text-[10px] font-bold h-8 px-5 rounded-full transition-all uppercase tracking-wider ${
              periodo === p.value 
                ? "bg-primary text-black shadow-gold border-primary" 
                : "bg-card/40 border-primary/10 text-muted-foreground hover:border-primary/30"
            }`}
            onClick={() => handlePeriodoChange(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Totais Gerais */}
      <Card className="relative overflow-hidden border-primary/30 bg-[#161616] p-6 shadow-gold rounded-2xl">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/5 blur-3xl" />
        <div className="relative space-y-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[3px] text-muted-foreground mb-1">Vendas Totais</p>
            <p className="font-display text-4xl font-black text-primary tracking-tight">
              {fmt(toNum(totais.totalVendas))}
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <StatBox label="PIX" value={fmt(fp.pix)} color="text-blue-400" />
            <StatBox label="Espécie" value={fmt(fp.especie)} color="text-green-400" />
            <StatBox label="Débito" value={fmt(fp.debito)} color="text-yellow-400" />
            <StatBox label="Crédito" value={fmt(fp.credito)} color="text-purple-400" />
            <StatBox label="Crédito Remoto" value={fmt(fp.creditoRemoto)} color="text-orange-400" />
            <StatBox label="Prêmios" value={String(toNum(totais.quantidadePremios))} color="text-pink-400" />
          </div>

          <div className="pt-4 border-t border-primary/10 grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
                <Wifi className="h-4 w-4 text-success" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Online</span>
                <span className="text-sm font-black text-foreground">{toNum(totais.maquinasOnline)}/{toNum(totais.maquinasTotal)}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-destructive" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Estornos</span>
                <span className="text-sm font-black text-foreground">{fmt(toNum(totais.totalEstornos))}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Busca */}
      {isAdmin() && (
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Buscar estabelecimento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11 bg-[#161616] border-primary/10 h-12 rounded-2xl focus:border-primary/40 focus:ring-0 transition-all text-sm"
          />
        </div>
      )}

      {/* Lista por Estabelecimento/Cliente */}
      {isAdmin() && filtered.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[10px] font-bold uppercase tracking-[3px] text-muted-foreground">
              ESTABELECIMENTOS ({filtered.length})
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            {filtered.map((c) => {
              const cfp = c.stats.formasPagamento || { pix: 0, especie: 0, debito: 0, credito: 0, creditoRemoto: 0 };
              return (
                <Card key={c.id} className="border-primary/5 bg-[#161616]/60 p-5 rounded-2xl transition-all active:scale-[0.98] hover:border-primary/20">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/10">
                        <Cpu className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{c.nome}</p>
                        <p className="text-[10px] text-muted-foreground font-medium">
                          {toNum(c.stats.maquinasOnline)} de {toNum(c.stats.maquinasTotal)} máquinas online
                        </p>
                      </div>
                    </div>
                    <p className="font-display text-lg font-black text-primary">{fmt(toNum(c.stats.totalVendas))}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
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
        <Card className="border-dashed border-primary/20 bg-card/20 p-12 text-center rounded-2xl">
          <div className="flex flex-col items-center gap-3">
            <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center">
              <TrendingUp className="h-8 w-8 text-primary/10" />
            </div>
            <p className="text-sm font-medium text-muted-foreground tracking-wide">Nenhum dado disponível no momento</p>
          </div>
        </Card>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-[#111] p-3.5 border border-primary/5">
      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[2px]">{label}</span>
      <span className={`text-base font-black ${color} tracking-tight`}>{value}</span>
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
    <div className="flex items-center gap-2.5 rounded-xl bg-[#111] px-3 py-2 border border-primary/5">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
      <div className="flex flex-col">
        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-1">{label}</span>
        <span className={`font-black text-foreground ${small ? "text-[11px]" : "text-xs"}`}>
          {value}
        </span>
      </div>
    </div>
  );
}
