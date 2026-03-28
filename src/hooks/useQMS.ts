import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";

// ─── Suppliers ────────────────────────────────────────────
export function useSuppliers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateSupplier() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (supplier: Record<string, any>) => {
      const { data, error } = await supabase.from("suppliers").insert([{ ...supplier, user_id: user!.id }] as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast({ title: "Supplier created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useUpdateSupplier() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Record<string, any>) => {
      const { error } = await supabase.from("suppliers").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast({ title: "Supplier updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["suppliers"] }); toast({ title: "Supplier deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

// ─── Parts ────────────────────────────────────────────────
export function useParts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["parts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("parts").select("*, suppliers(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreatePart() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (part: Record<string, any>) => {
      const { data, error } = await supabase.from("parts").insert([{ ...part, user_id: user!.id }] as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["parts"] }); toast({ title: "Part created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useUpdatePart() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Record<string, any>) => {
      const { error } = await supabase.from("parts").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["parts"] }); toast({ title: "Part updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useDeletePart() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("parts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["parts"] }); toast({ title: "Part deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

// ─── Lots ─────────────────────────────────────────────────
export function useLots() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["lots"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lots").select("*, parts(name, part_number), suppliers(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateLot() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (lot: Record<string, any>) => {
      const { data, error } = await supabase.from("lots").insert([{ ...lot, user_id: user!.id }] as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lots"] }); toast({ title: "Lot created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useUpdateLot() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Record<string, any>) => {
      const { error } = await supabase.from("lots").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lots"] }); toast({ title: "Lot updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteLot() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lots"] }); toast({ title: "Lot deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

// ─── Devices ──────────────────────────────────────────────
export function useDevices() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["devices"],
    queryFn: async () => {
      const { data, error } = await supabase.from("devices").select("*, device_lots(*, lots(lot_number, status, parts(name, part_number)))").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateDevice() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (device: Record<string, any>) => {
      const { data, error } = await supabase.from("devices").insert([{ ...device, user_id: user!.id }] as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["devices"] }); toast({ title: "Device created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useUpdateDevice() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Record<string, any>) => {
      const { error } = await supabase.from("devices").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["devices"] }); toast({ title: "Device updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteDevice() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("devices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["devices"] }); toast({ title: "Device deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

// ─── Inspections ──────────────────────────────────────────
export function useInspections() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["inspections"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inspections").select("*, lots(lot_number, parts(name, part_number))").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateInspection() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (ins: Record<string, any>) => {
      const { data, error } = await supabase.from("inspections").insert([{ ...ins, user_id: user!.id }] as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inspections"] }); toast({ title: "Inspection created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useUpdateInspection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Record<string, any>) => {
      const { error } = await supabase.from("inspections").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inspections"] }); toast({ title: "Inspection updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

// ─── NCRs ─────────────────────────────────────────────────
export function useNCRs() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["ncrs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ncrs").select("*, lots(lot_number), parts(name, part_number), suppliers(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateNCR() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (ncr: Record<string, any>) => {
      const { data, error } = await supabase.from("ncrs").insert([{ ...ncr, user_id: user!.id }] as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ncrs"] }); toast({ title: "NCR created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useUpdateNCR() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Record<string, any>) => {
      const { error } = await supabase.from("ncrs").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ncrs"] }); toast({ title: "NCR updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteNCR() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ncrs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ncrs"] }); toast({ title: "NCR deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

// ─── CAPAs ────────────────────────────────────────────────
export function useCAPAs() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["capas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("capas").select("*, ncrs(ncr_number, title)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateCAPA() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (capa: Record<string, any>) => {
      const { data, error } = await supabase.from("capas").insert([{ ...capa, user_id: user!.id }] as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["capas"] }); toast({ title: "CAPA created" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useUpdateCAPA() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Record<string, any>) => {
      const { error } = await supabase.from("capas").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["capas"] }); toast({ title: "CAPA updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useDeleteCAPA() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("capas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["capas"] }); toast({ title: "CAPA deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}
