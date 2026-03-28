import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createQmsRecord, deleteQmsRecord, listQmsRecords, updateQmsRecord } from "@/lib/api";

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
