import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch, isAdmin } from "@/lib/api";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  ArrowLeft, Cpu, MapPin, Wifi, WifiOff, Clock, DollarSign,
  CreditCard, Banknote, Gift, TrendingUp, CalendarIcon, RefreshCw,
  Undo2, Edit3, Save
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const toNum = (v?: unknown): number => {
  if (v == null) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

const fmt = (v: number) => {
  return `R$ ${v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
};

interface MaquinaData {
  id: string;
  nome?: string;
  descricao?: string;
  localizacao?: string;
  store_id?: string;
  maquininha_serial?: string;
  ultimoPagamentoRecebido?: string | null;
  ultimaRequisicao?: string | null;
  dataInclusao?: string;
  [key: string]: unknown;
}

interface Transacao {
  id?: string;
  data?: string;
  dataHora?: string;
  valor?: string | number;
  tipo?: string;
  tipoPagamento?: string;
  tipoTransacao?: string;
  identificador?: string;
  estornado?: boolean;
  removido?: boolean;
  operadora?: string;
  quantidade?: number | string;
  observacao?: string;
  [key: string]: unknown;
}

interface PagamentoResumo {
  // Client fields
  total?: number | string;
  pix?: number | string;
  especie?: number | string;
  debito?: number | string;
  creditoRemoto?: number | string;
  dadosUnificados?: Transacao[];
  // Admin fields (different keys)
  cash?: number | string;
  creditosRemotos?: number | string;
  credito?: number | string;
  estornos?: number | string;
  pagamentos?: Transacao[];
  [key: string]: unknown;
}

interface PremiosResponse {
  premios?: Transacao[];
  totalEntregues?: number;
  estoqueAtual?: number;
  [key: string]: unknown;
}

export default function MaquinaDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [maquina, setMaquina] = useState<MaquinaData | null>(null);
  const [resumo, setResumo] = useState<PagamentoResumo | null>(null);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [premios, setPremios] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [editing, setEditing] = useState(false);
  const [editNome, setEditNome] = useState("");
  const [editLocal, setEditLocal] = useState("");
  const [saving, setSaving] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDynamic = useCallback(async () => {
    if (!id) return;
    try {
      // Fetch pagamentos (admin uses different endpoint + different field names)
      const pagPath = isAdmin() ? `/pagamentos-adm/${id}` : `/pagamentos/${id}`;
      const data = await apiFetch<PagamentoResumo>(pagPath);
      setResumo(data);

      // Extract transactions: admin returns `pagamentos`, client returns `dadosUnificados`
      const txList = (data.pagamentos ?? data.dadosUnificados ?? []) as Transacao[];
      setTransacoes(Array.isArray(txList) ? txList : []);

      // Fetch premios using correct /api prefix
      const prePath = isAdmin()
        ? `/api/premios-entregues-adm/${id}`
        : `/api/premios-entregues/${id}`;
      try {
        const preData = await apiFetch<PremiosResponse | Transacao[]>(prePath);
        let preList: Transacao[] = [];
        if (Array.isArray(preData)) {
          preList = preData;
        } else if (preData && typeof preData === "object" && Array.isArray((preData as PremiosResponse).premios)) {
          preList = (preData as PremiosResponse).premios!;
        }
        setPremios(preList);
      } catch (err) {
        console.warn("[MaquinaDetalhe] Erro ao carregar prêmios:", err);
      }

      setLastUpdate(new Date());
    } catch (err) {
      console.warn("[MaquinaDetalhe] pagamentos error:", err);
    }
  }, [id]);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const path = isAdmin() ? `/maquina-adm/${id}` : `/maquina/${id}`;
        const data = await apiFetch<MaquinaData>(path);
        setMaquina(data);
        setEditNome(data.nome || "");
        setEditLocal(data.descricao || data.localizacao || "");
        await fetchDynamic();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar máquina");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id, fetchDynamic]);

  useEffect(() => {
    intervalRef.current = setInterval(fetchDynamic, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchDynamic]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await apiFetch(`/maquina-adm/${id}`, {
        method: "PUT",
        body: JSON.stringify({ nome: editNome, local: editLocal }),
      });
      setMaquina((prev) => (prev ? { ...prev, nome: editNome, descricao: editLocal } : prev));
      setEditing(false);
    } catch (err) {
      console.error("[MaquinaDetalhe] save error:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner text="Carregando máquina..." />;
  if (error)
    return (
      <div className="rounded-2xl bg-destructive/10 p-6 text-center text-sm text-destructive">
        {error}
      </div>
    );
  if (!maquina) return null;

  const isOnline = (() => {
    const last = maquina.ultimaRequisicao || maquina.ultimoPagamentoRecebido;
    if (!last) return false;
    return Date.now() - new Date(last).getTime() < 5 * 60 * 1000;
  })();

  const formatDateStr = (d?: string | null) =>
    d ? new Date(d).toLocaleString("pt-BR") : "—";

  const filteredTransacoes = transacoes.filter((t) => {
    const dateStr = t.data || t.dataHora;
    if (!dateStr) return true;
    const d = new Date(dateStr);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      if (d > end) return false;
    }
    return true;
  });

  const chartData = transacoes.reduce<Record<string, number>>((acc, t) => {
    const dateStr = t.data || t.dataHora;
    if (!dateStr || t.estornado || t.removido) return acc;
    const day = new Date(dateStr).toLocaleDateString("pt-BR");
    acc[day] = (acc[day] || 0) + toNum(t.valor);
    return acc;
  }, {});
  const chartEntries = Object.entries(chartData)
    .map(([dia, valor]) => ({ dia, valor }))
    .sort((a, b) => {
      const [dA, mA, yA] = a.dia.split("/").map(Number);
      const [dB, mB, yB] = b.dia.split("/").map(Number);
      return new Date(yA, mA - 1, dA).getTime() - new Date(yB, mB - 1, dB).getTime();
    });

  // Normalize field names (admin uses cash/creditosRemotos, client uses especie/creditoRemoto)
  const normalizedResumo = {
    total: resumo?.total,
    pix: resumo?.pix,
    especie: resumo?.especie ?? resumo?.cash,
    debito: resumo?.debito,
    creditoRemoto: resumo?.creditoRemoto ?? resumo?.creditosRemotos,
  };

  const cards = [
    { label: "Total", value: normalizedResumo.total, icon: TrendingUp, color: "border-primary/30 bg-primary/10 text-primary" },
    { label: "PIX", value: normalizedResumo.pix, icon: Banknote, color: "border-blue-400/30 bg-blue-400/10 text-blue-400" },
    { label: "Espécie", value: normalizedResumo.especie, icon: Banknote, color: "border-green-400/30 bg-green-400/10 text-green-400" },
    { label: "Débito", value: normalizedResumo.debito, icon: CreditCard, color: "border-yellow-400/30 bg-yellow-400/10 text-yellow-400" },
    { label: "Crédito Remoto", value: normalizedResumo.creditoRemoto, icon: CreditCard, color: "border-purple-400/30 bg-purple-400/10 text-purple-400" },
  ];

  const getTypeIcon = (t: Transacao) => {
    if (t.estornado) return <Undo2 className="h-4 w-4 text-destructive" />;
    if (t.tipoTransacao === "credito_remoto") return <CreditCard className="h-4 w-4 text-info" />;
    if (t.tipo === "bank_transfer" || t.tipo === "11") return <Banknote className="h-4 w-4 text-accent" />;
    if (t.tipo === "CASH") return <Banknote className="h-4 w-4 text-success" />;
    return <DollarSign className="h-4 w-4 text-primary" />;
  };

  const getTypeLabel = (t: Transacao) => {
    if (t.tipoTransacao === "credito_remoto") return "Crédito Remoto";
    if (t.tipo === "bank_transfer" || t.tipo === "11") return "PIX";
    if (t.tipo === "CASH") return "Espécie";
    if (t.tipo === "debit_card") return "Débito";
    if (t.tipo === "credit_card") return "Crédito";
    return t.tipoPagamento || t.tipo || "—";
  };

  const clearFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  return (
    <div className="animate-fade-in space-y-4 pb-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm font-medium text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <div className="flex items-center gap-2">
          {isAdmin() && !editing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-primary"
              onClick={() => setEditing(true)}
            >
              <Edit3 className="h-3 w-3" /> Editar
            </Button>
          )}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RefreshCw
              className="h-3 w-3 animate-spin text-primary/60"
              style={{ animationDuration: "3s" }}
            />
            {lastUpdate.toLocaleTimeString("pt-BR")}
          </div>
        </div>
      </div>

      {/* Machine header */}
      <div className="rounded-2xl border border-primary/20 bg-card p-4 shadow-gold">
        {editing ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                Nome
              </label>
              <Input
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                className="bg-secondary border-primary/20"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                Local
              </label>
              <Input
                value={editLocal}
                onChange={(e) => setEditLocal(e.target.value)}
                className="bg-secondary border-primary/20"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1 shadow-gold">
                <Save className="h-3 w-3" /> {saving ? "Salvando..." : "Salvar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
              <span className="text-2xl">🧸</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-base font-bold tracking-wide text-foreground truncate">
                {maquina.nome || "Máquina"}
              </h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {isOnline ? (
                  <span className="flex items-center gap-1 text-xs font-bold text-success">
                    <Wifi className="h-3.5 w-3.5" /> Online
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-bold text-destructive">
                    <WifiOff className="h-3.5 w-3.5" /> Offline
                  </span>
                )}
                {(maquina.descricao || maquina.localizacao) && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 text-primary/60" />
                    {maquina.descricao || maquina.localizacao}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <Tabs defaultValue="resumo" className="w-full">
        <TabsList className="grid w-full grid-cols-4 rounded-xl border border-primary/10 bg-secondary h-10">
          <TabsTrigger
            value="resumo"
            className="rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Resumo
          </TabsTrigger>
          <TabsTrigger
            value="transacoes"
            className="rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Transações
          </TabsTrigger>
          <TabsTrigger
            value="premios"
            className="rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Prêmios
          </TabsTrigger>
          <TabsTrigger
            value="info"
            className="rounded-lg text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Detalhes
          </TabsTrigger>
        </TabsList>

        {/* RESUMO */}
        <TabsContent value="resumo" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {cards.map((c) => (
              <div
                key={c.label}
                className={`rounded-2xl border bg-card p-3 shadow-card ${c.color.split(" ")[0]}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <c.icon className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                    {c.label}
                  </span>
                </div>
                <p className="font-display text-lg font-bold">{fmt(toNum(c.value))}</p>
              </div>
            ))}
          </div>

          {/* Gráfico */}
          <Card className="border-primary/10 bg-card/60 p-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
              Vendas por Dia
            </h3>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartEntries}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis
                    dataKey="dia"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
                    tickFormatter={(v) => `R$${v}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid rgba(245,166,35,0.2)", borderRadius: "8px" }}
                    itemStyle={{ color: "#f5a623", fontWeight: "bold" }}
                  />
                  <Bar dataKey="valor" fill="#f5a623" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        {/* TRANSAÇÕES */}
        <TabsContent value="transacoes" className="mt-4 space-y-4">
          <Card className="border-primary/10 bg-card/60 p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <DatePicker label="De" date={dateFrom} onSelect={setDateFrom} />
              <DatePicker label="Até" date={dateTo} onSelect={setDateTo} />
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-8 text-primary">
                  Limpar
                </Button>
              )}
            </div>
          </Card>

          <div className="space-y-2">
            {filteredTransacoes.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">Nenhuma transação encontrada</p>
            ) : (
              filteredTransacoes.map((t, i) => (
                <div
                  key={t.id || i}
                  className={cn(
                    "flex items-center justify-between rounded-xl border border-border/40 bg-secondary/30 p-3",
                    t.estornado && "opacity-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      {getTypeIcon(t)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {getTypeLabel(t)}
                        {t.estornado && <span className="ml-1 text-[10px] text-destructive">(Estornado)</span>}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{formatDateStr(t.data || t.dataHora)}</p>
                    </div>
                  </div>
                  <p className={cn("text-sm font-bold", t.estornado ? "text-destructive" : "text-primary")}>
                    {fmt(toNum(t.valor))}
                  </p>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* PRÊMIOS */}
        <TabsContent value="premios" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-primary/20 bg-card p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Entregues</p>
              <p className="font-display text-xl font-bold text-primary">{premios.length}</p>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-card p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Estoque</p>
              <p className="font-display text-xl font-bold text-primary">—</p>
            </div>
          </div>

          <div className="space-y-2">
            {premios.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">Nenhum prêmio registrado</p>
            ) : (
              premios.map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-border/40 bg-secondary/30 p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Gift className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Prêmio Entregue</p>
                      <p className="text-[10px] text-muted-foreground">{formatDateStr(p.data || p.dataHora)}</p>
                    </div>
                  </div>
                  {p.quantidade && <p className="text-xs font-bold text-primary">x{p.quantidade}</p>}
                </div>
              ))
            )}
          </div>
        </TabsContent>

        {/* DETALHES */}
        <TabsContent value="info" className="mt-4 space-y-3">
          <InfoRow label="ID da Máquina" value={maquina.id} />
          <InfoRow label="Nome" value={maquina.nome || "—"} />
          <InfoRow label="Local" value={maquina.descricao || maquina.localizacao || "—"} />
          <InfoRow label="Serial MP" value={maquina.maquininha_serial || "—"} />
          <InfoRow label="Store ID" value={maquina.store_id || "—"} />
          <InfoRow label="Data de Inclusão" value={formatDateStr(maquina.dataInclusao)} />
          <InfoRow label="Última Requisição" value={formatDateStr(maquina.ultimaRequisicao)} />
          <InfoRow label="Último Pagamento" value={formatDateStr(maquina.ultimoPagamentoRecebido)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-secondary/20 p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-medium text-foreground break-all">{value}</p>
    </div>
  );
}

function DatePicker({
  label,
  date,
  onSelect,
}: {
  label: string;
  date?: Date;
  onSelect: (d: Date | undefined) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-8 flex-1 justify-start text-left text-xs font-normal border-primary/20 bg-secondary/50",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-1.5 h-3 w-3" />
          {date ? format(date, "dd/MM/yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-primary/20 bg-card" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onSelect}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
