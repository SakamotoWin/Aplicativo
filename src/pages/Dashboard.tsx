import { useEffect, useState, useRef, useCallback } from "react";
import { apiFetch, apiFetchFirst, isAdmin, getUserId, getUserType } from "@/lib/api";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Cpu, TrendingUp, Users, Wifi, BarChart3, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";

interface EstatisticasData {
  total?: number | string;
  pix?: number | string;
  especie?: number | string;
  debito?: number | string;
  creditoRemoto?: number | string;
  totalMaquinas?: number | string;
  totalClientes?: number | string;
  totalAtivas?: number | string;
  totalOnline?: number | string;
  maquinas?: Array<any>;
  [key: string]: unknown;
}

const toNum = (v?: unknown): number => {
  if (v == null) return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

const fmt = (v: number) => {
  return `R$ ${v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
};

export default function Dashboard() {
  const [data, setData] = useState<EstatisticasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const userId = getUserId();
      const userType = getUserType();
      
      if (!userId) {
        console.warn("[Dashboard] Aguardando identificação do usuário...");
        return;
      }

      console.log("[Dashboard] Carregando estatísticas para:", { userId, userType });

      // Se for ADMIN, tentamos várias rotas possíveis para evitar 404
      let statsData: EstatisticasData;
      if (userType === "ADMIN") {
        statsData = await apiFetchFirst<EstatisticasData>([
          "/dashboard/estatisticas-gerais",
          "/dashboard/estatisticas-gerais-adm",
          "/dashboard",
          "/estatisticas-gerais"
        ]);
      } else {
        statsData = await apiFetchFirst<EstatisticasData>([
          `/dashboard/estatisticas-gerais/${userId}`,
          `/dashboard/${userId}`,
          `/estatisticas-gerais/${userId}`
        ]);
      }
      console.log("[Dashboard] Estatísticas:", statsData);
      
      setData(statsData || {});
      setLastUpdate(new Date());
    } catch (err) {
      console.warn("[Dashboard] Erro ao carregar estatísticas:", err);
      setError(err instanceof Error ? err.message : "Erro ao carregar dashboard");
    }
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
    // Atualizar a cada 5 segundos
    intervalRef.current = setInterval(fetchData, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  if (loading) return <LoadingSpinner text="Carregando dashboard..." />;

  const stats = [
    {
      label: "Total",
      value: fmt(toNum(data?.total)),
      icon: TrendingUp,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "PIX",
      value: fmt(toNum(data?.pix)),
      icon: Cpu,
      color: "text-blue-400",
      bgColor: "bg-blue-400/10",
    },
    {
      label: "Espécie",
      value: fmt(toNum(data?.especie)),
      icon: Zap,
      color: "text-green-400",
      bgColor: "bg-green-400/10",
    },
    {
      label: "Débito",
      value: fmt(toNum(data?.debito)),
      icon: BarChart3,
      color: "text-yellow-400",
      bgColor: "bg-yellow-400/10",
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
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

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.label}
              className="border-primary/20 bg-card/60 p-4 backdrop-blur-sm hover:border-primary/40 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="mt-2 font-display text-lg font-bold text-foreground">{stat.value}</p>
                </div>
                <div className={`rounded-lg p-2.5 ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
