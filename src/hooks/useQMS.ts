import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createQmsRecord,
  deleteQmsRecord,
  listAgentRuns,
  listComplianceAgentItems,
  listQmsRecords,
  resolveAgentRun,
  runCapaAgent,
  runComplianceAgent,
  runSupplierAgent,
  updateQmsRecord,
} from "@/lib/api";

import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";

type EntityName =
  | "suppliers"
  | "parts"
  | "lots"
  | "devices"
  | "inspections"
  | "ncrs"
  | "capas";

function useEntityList(entity: EntityName) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [entity],
    queryFn: async () => listQmsRecords(entity, user!.id),
    enabled: !!user,
  });
}

function useCreateEntity(entity: EntityName, successTitle: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: Record<string, any>) => createQmsRecord(entity, user!.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [entity] });
      toast({ title: successTitle });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

function useUpdateEntity(entity: EntityName, successTitle: string) {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Record<string, any>) => updateQmsRecord(entity, id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [entity] });
      toast({ title: successTitle });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

function useDeleteEntity(entity: EntityName, successTitle: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => deleteQmsRecord(entity, id, user!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [entity] });
      toast({ title: successTitle });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useSuppliers() {
  return useEntityList("suppliers");
}

export function useCreateSupplier() {
  return useCreateEntity("suppliers", "Supplier created");
}

export function useUpdateSupplier() {
  return useUpdateEntity("suppliers", "Supplier updated");
}

export function useDeleteSupplier() {
  return useDeleteEntity("suppliers", "Supplier deleted");
}

export function useParts() {
  return useEntityList("parts");
}

export function useCreatePart() {
  return useCreateEntity("parts", "Part created");
}

export function useUpdatePart() {
  return useUpdateEntity("parts", "Part updated");
}

export function useDeletePart() {
  return useDeleteEntity("parts", "Part deleted");
}

export function useLots() {
  return useEntityList("lots");
}

export function useCreateLot() {
  return useCreateEntity("lots", "Lot created");
}

export function useUpdateLot() {
  return useUpdateEntity("lots", "Lot updated");
}

export function useDeleteLot() {
  return useDeleteEntity("lots", "Lot deleted");
}

export function useDevices() {
  return useEntityList("devices");
}

export function useCreateDevice() {
  return useCreateEntity("devices", "Device created");
}

export function useUpdateDevice() {
  return useUpdateEntity("devices", "Device updated");
}

export function useDeleteDevice() {
  return useDeleteEntity("devices", "Device deleted");
}

export function useInspections() {
  return useEntityList("inspections");
}

export function useCreateInspection() {
  return useCreateEntity("inspections", "Inspection created");
}

export function useUpdateInspection() {
  return useUpdateEntity("inspections", "Inspection updated");
}

export function useNCRs() {
  return useEntityList("ncrs");
}

export function useCreateNCR() {
  return useCreateEntity("ncrs", "NCR created");
}

export function useUpdateNCR() {
  return useUpdateEntity("ncrs", "NCR updated");
}

export function useDeleteNCR() {
  return useDeleteEntity("ncrs", "NCR deleted");
}

export function useCAPAs() {
  return useEntityList("capas");
}

export function useCreateCAPA() {
  return useCreateEntity("capas", "CAPA created");
}

export function useUpdateCAPA() {
  return useUpdateEntity("capas", "CAPA updated");
}

export function useDeleteCAPA() {
  return useDeleteEntity("capas", "CAPA deleted");
}

export function useAgentRuns(agentType?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["agent-runs", agentType],
    queryFn: () => listAgentRuns(user!.id, agentType),
    enabled: !!user,
    refetchInterval: 15000,
  });
}

export function useResolveAgentRun() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (id: string) => resolveAgentRun(id, user!.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-runs"] }),
  });
}

export function useRunCapaAgent() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (options?: { days_back?: number }) => runCapaAgent(user!.id, options),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["capas"] });
      qc.invalidateQueries({ queryKey: ["ncrs"] });
      qc.invalidateQueries({ queryKey: ["agent-runs"] });
      const capaNo = data?.capa_created?.capa_number;
      toast({
        title: "CAPA Agent complete",
        description: capaNo ? `Created ${capaNo}` : (data?.summary || "Analysis finished").slice(0, 160),
      });
    },
    onError: (e: Error) => {
      toast({ title: "CAPA Agent failed", description: e.message, variant: "destructive" });
    },
  });
}

export function useRunSupplierAgent() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (options?: { days_back?: number; supplier_id?: string }) => runSupplierAgent(user!.id, options),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["agent-runs"] });
      const n = data?.suppliers_updated?.length ?? 0;
      toast({
        title: "Supplier Agent complete",
        description:
          n > 0
            ? `Updated ${n} supplier profile(s). ${(data?.summary || "").slice(0, 120)}`
            : (data?.summary || "Analysis finished").slice(0, 160),
      });
    },
    onError: (e: Error) => {
      toast({ title: "Supplier Agent failed", description: e.message, variant: "destructive" });
    },
  });
}

export function useComplianceAgentItems(limit = 60) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["compliance-agent-items", limit],
    queryFn: () => listComplianceAgentItems(user!.id, limit),
    enabled: !!user,
  });
}

export function useRunComplianceAgent() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (options?: { horizon_days?: number }) => runComplianceAgent(user!.id, options),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["agent-runs"] });
      qc.invalidateQueries({ queryKey: ["compliance-agent-items"] });
      const n = data?.risk_items_recorded ?? 0;
      toast({
        title: "Compliance Agent complete",
        description:
          n > 0
            ? `Recorded ${n} prioritized risk row(s). ${(data?.summary || "").slice(0, 100)}`
            : (data?.summary || "Analysis finished").slice(0, 160),
      });
    },
    onError: (e: Error) => {
      toast({ title: "Compliance Agent failed", description: e.message, variant: "destructive" });
    },
  });
}
