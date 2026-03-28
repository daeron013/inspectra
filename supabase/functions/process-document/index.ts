import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTRACTION_PROMPT = `You are an expert quality management document analyzer for ISO 13485 medical device companies.

Given the text content of an uploaded document, you MUST:
1. Classify the document type
2. Extract ALL structured data from the document
3. Determine which QMS records should be created

Be thorough — extract every data point you can find including names, numbers, dates, measurements, results, addresses, emails, phone numbers, certifications, etc.

For inspection reports: extract all sample measurements, pass/fail results, inspector info, lot/part references.
For certificates (CoC/CoA): extract supplier info, part info, lot info, test results, certification details.
For NCR reports: extract nonconformance details, severity, affected lots/parts, root cause if available.
For CAPA reports: extract corrective actions, root cause analysis, effectiveness checks.
For SOPs/Specs: extract document metadata, revision info, applicable parts/processes.`;

const extractionTool = {
  type: "function" as const,
  function: {
    name: "classify_and_extract",
    description: "Classify the document and extract all structured data to populate QMS records.",
    parameters: {
      type: "object",
      properties: {
        document_type: {
          type: "string",
          enum: ["certificate", "inspection_report", "batch_record", "ncr_report", "capa_report", "sop", "spec", "other"],
          description: "The classified document type",
        },
        confidence: {
          type: "number",
          description: "Classification confidence 0-1",
        },
        summary: {
          type: "string",
          description: "Brief summary of the document content",
        },
        supplier: {
          type: "object",
          description: "Supplier info if found in the document",
          properties: {
            name: { type: "string" },
            code: { type: "string" },
            address: { type: "string" },
            contact_email: { type: "string" },
            contact_phone: { type: "string" },
            certification_type: { type: "string" },
            certification_expiry: { type: "string", description: "ISO date string" },
            risk_level: { type: "string", enum: ["low", "medium", "high", "critical"] },
            status: { type: "string", enum: ["approved", "pending", "suspended"] },
            defect_rate: { type: "number", description: "Defect rate as a percentage (e.g. 1.5 means 1.5%). Calculate from inspection data if available — defects_found / sample_size * 100." },
            on_time_delivery: { type: "number", description: "On-time delivery percentage (e.g. 95.0 means 95%)" },
          },
        },
        part: {
          type: "object",
          description: "Part/material info if found in the document",
          properties: {
            name: { type: "string" },
            part_number: { type: "string" },
            description: { type: "string" },
            risk_class: { type: "string", enum: ["I", "II", "III"] },
            fda_clearance: { type: "string" },
            unit_cost: { type: "number" },
            specifications: { type: "object", description: "Key specs as key-value pairs" },
          },
        },
        lot: {
          type: "object",
          description: "Lot/batch info if found in the document",
          properties: {
            lot_number: { type: "string" },
            quantity: { type: "number" },
            received_date: { type: "string", description: "ISO date string" },
            expiration_date: { type: "string", description: "ISO date string" },
            status: { type: "string", enum: ["quarantine", "released", "rejected"] },
            inspection_status: { type: "string", enum: ["pending", "passed", "failed"] },
          },
        },
        inspection: {
          type: "object",
          description: "Inspection data if found in the document",
          properties: {
            inspection_type: { type: "string", enum: ["incoming", "in_process", "final", "supplier_audit"] },
            inspection_date: { type: "string", description: "ISO date string" },
            inspector_name: { type: "string" },
            sample_size: { type: "number" },
            defects_found: { type: "number" },
            status: { type: "string", enum: ["pending", "passed", "failed"] },
            notes: { type: "string" },
            measurements: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  parameter: { type: "string" },
                  value: { type: "string" },
                  spec_min: { type: "string" },
                  spec_max: { type: "string" },
                  unit: { type: "string" },
                  result: { type: "string", enum: ["pass", "fail"] },
                },
              },
            },
          },
        },
        ncr: {
          type: "object",
          description: "Nonconformance data if found in the document",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            severity: { type: "string", enum: ["minor", "major", "critical"] },
            disposition: { type: "string" },
            root_cause: { type: "string" },
            corrective_action: { type: "string" },
          },
        },
        capa: {
          type: "object",
          description: "CAPA data if found in the document",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            type: { type: "string", enum: ["corrective", "preventive"] },
            priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
            root_cause: { type: "string" },
            action_plan: { type: "string" },
            assigned_to: { type: "string" },
            due_date: { type: "string", description: "ISO date string" },
            effectiveness_check: { type: "string" },
          },
        },
      },
      required: ["document_type", "confidence", "summary"],
      additionalProperties: false,
    },
  },
};

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { document_id } = await req.json();
    if (!document_id) {
      return new Response(JSON.stringify({ error: "document_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate user
    const authHeader = req.headers.get("authorization") || "";
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get document record
    const { data: doc, error: docError } = await serviceClient
      .from("documents")
      .select("*")
      .eq("id", document_id)
      .eq("user_id", user.id)
      .single();

    if (docError || !doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Update status to processing
    await serviceClient.from("documents").update({ status: "processing" }).eq("id", document_id);

    // 3. Download file from storage
    const { data: fileData, error: storageError } = await serviceClient.storage
      .from("documents")
      .download(doc.file_path);

    if (storageError || !fileData) {
      await serviceClient.from("documents").update({ status: "flagged", notes: "Failed to download file" }).eq("id", document_id);
      return new Response(JSON.stringify({ error: "Failed to download file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Convert PDF to base64 for AI vision
    const pdfBytes = new Uint8Array(await fileData.arrayBuffer());
    const pdfBase64 = uint8ArrayToBase64(pdfBytes);
    const mimeType = doc.file_name?.endsWith(".pdf") ? "application/pdf" : "image/png";

    // 5. Call AI with the PDF directly (Gemini supports native PDF understanding)
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${pdfBase64}`,
                },
              },
              {
                type: "text",
                text: "Analyze this document and extract all structured data. Classify it and extract every data point you can find.",
              },
            ],
          },
        ],
        tools: [extractionTool],
        tool_choice: { type: "function", function: { name: "classify_and_extract" } },
        stream: false,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errMsg = status === 429 ? "Rate limited" : status === 402 ? "Credits exhausted" : "AI service error";
      await serviceClient.from("documents").update({ status: "flagged", notes: errMsg }).eq("id", document_id);
      return new Response(JSON.stringify({ error: errMsg }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await aiResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      await serviceClient.from("documents").update({ status: "flagged", notes: "AI could not classify document" }).eq("id", document_id);
      return new Response(JSON.stringify({ error: "AI classification failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = typeof toolCall.function.arguments === "string"
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function.arguments;

    // 6. Update document with classified type and extracted data
    await serviceClient.from("documents").update({
      document_type: extracted.document_type,
      status: "processed",
      extracted_data: extracted,
      notes: extracted.summary,
    }).eq("id", document_id);

    const createdRecords: Record<string, string> = {};

    // 7. Create supplier record if data found
    if (extracted.supplier?.name) {
      const supplierCode = extracted.supplier.code || `SUP-${Date.now().toString(36).toUpperCase()}`;
      const { data: existingSupplier } = await serviceClient
        .from("suppliers")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", extracted.supplier.name)
        .maybeSingle();

      let supplierId = existingSupplier?.id;
      if (!supplierId) {
        const { data: newSupplier, error: sErr } = await serviceClient.from("suppliers").insert({
          user_id: user.id,
          name: extracted.supplier.name,
          code: supplierCode,
          address: extracted.supplier.address || null,
          contact_email: extracted.supplier.contact_email || null,
          contact_phone: extracted.supplier.contact_phone || null,
          certification_type: extracted.supplier.certification_type || null,
          certification_expiry: extracted.supplier.certification_expiry || null,
          risk_level: extracted.supplier.risk_level || "medium",
          status: extracted.supplier.status || "approved",
          defect_rate: extracted.supplier.defect_rate ?? 0,
          on_time_delivery: extracted.supplier.on_time_delivery ?? 100,
        }).select("id").single();
        if (!sErr && newSupplier) {
          supplierId = newSupplier.id;
          createdRecords.supplier = newSupplier.id;
        }
      } else {
        // Update existing supplier with new data from document (e.g. defect rate from inspection)
        const updateFields: Record<string, any> = {};
        if (extracted.supplier.defect_rate != null) updateFields.defect_rate = extracted.supplier.defect_rate;
        if (extracted.supplier.on_time_delivery != null) updateFields.on_time_delivery = extracted.supplier.on_time_delivery;
        if (extracted.supplier.risk_level) updateFields.risk_level = extracted.supplier.risk_level;
        if (extracted.supplier.certification_type) updateFields.certification_type = extracted.supplier.certification_type;
        if (extracted.supplier.certification_expiry) updateFields.certification_expiry = extracted.supplier.certification_expiry;
        if (Object.keys(updateFields).length > 0) {
          await serviceClient.from("suppliers").update(updateFields).eq("id", supplierId);
          createdRecords.supplier_updated = supplierId;
        }
      }

      // Link document to supplier
      if (supplierId) {
        await serviceClient.from("documents").update({ linked_supplier_id: supplierId }).eq("id", document_id);
      }

      // 8. Create part record if data found
      if (extracted.part?.part_number) {
        const { data: existingPart } = await serviceClient
          .from("parts")
          .select("id")
          .eq("user_id", user.id)
          .eq("part_number", extracted.part.part_number)
          .maybeSingle();

        let partId = existingPart?.id;
        if (!partId) {
          const { data: newPart, error: pErr } = await serviceClient.from("parts").insert({
            user_id: user.id,
            name: extracted.part.name || extracted.part.part_number,
            part_number: extracted.part.part_number,
            description: extracted.part.description || null,
            risk_class: extracted.part.risk_class || "II",
            fda_clearance: extracted.part.fda_clearance || null,
            unit_cost: extracted.part.unit_cost || null,
            specifications: extracted.part.specifications || null,
            supplier_id: supplierId || null,
          }).select("id").single();
          if (!pErr && newPart) {
            partId = newPart.id;
            createdRecords.part = newPart.id;
          }
        }

        // 9. Create lot record if data found
        if (extracted.lot?.lot_number && partId) {
          const { data: existingLot } = await serviceClient
            .from("lots")
            .select("id")
            .eq("user_id", user.id)
            .eq("lot_number", extracted.lot.lot_number)
            .maybeSingle();

          let lotId = existingLot?.id;
          if (!lotId) {
            const { data: newLot, error: lErr } = await serviceClient.from("lots").insert({
              user_id: user.id,
              part_id: partId,
              supplier_id: supplierId || null,
              lot_number: extracted.lot.lot_number,
              quantity: extracted.lot.quantity || 0,
              received_date: extracted.lot.received_date || new Date().toISOString().split("T")[0],
              expiration_date: extracted.lot.expiration_date || null,
              status: extracted.lot.status || "quarantine",
              inspection_status: extracted.lot.inspection_status || "pending",
            }).select("id").single();
            if (!lErr && newLot) {
              lotId = newLot.id;
              createdRecords.lot = newLot.id;
            }
          }

          // Link document to lot
          if (lotId) {
            await serviceClient.from("documents").update({ linked_lot_id: lotId }).eq("id", document_id);
          }

          // 10. Create inspection record if data found
          if (extracted.inspection && lotId) {
            const { data: newInspection, error: iErr } = await serviceClient.from("inspections").insert({
              user_id: user.id,
              lot_id: lotId,
              inspection_type: extracted.inspection.inspection_type || "incoming",
              inspection_date: extracted.inspection.inspection_date || new Date().toISOString().split("T")[0],
              inspector_name: extracted.inspection.inspector_name || null,
              sample_size: extracted.inspection.sample_size || null,
              defects_found: extracted.inspection.defects_found || 0,
              status: extracted.inspection.status || "pending",
              notes: extracted.inspection.notes || null,
              measurements: extracted.inspection.measurements || null,
            }).select("id").single();
            if (!iErr && newInspection) {
              createdRecords.inspection = newInspection.id;
            }
          }

          // 11. Create NCR if data found
          if (extracted.ncr?.title) {
            const ncrNumber = `NCR-${Date.now().toString(36).toUpperCase()}`;
            const { data: newNcr, error: nErr } = await serviceClient.from("ncrs").insert({
              user_id: user.id,
              ncr_number: ncrNumber,
              title: extracted.ncr.title,
              description: extracted.ncr.description || null,
              severity: extracted.ncr.severity || "minor",
              status: "open",
              disposition: extracted.ncr.disposition || null,
              root_cause: extracted.ncr.root_cause || null,
              corrective_action: extracted.ncr.corrective_action || null,
              lot_id: lotId || null,
              part_id: partId || null,
              supplier_id: supplierId || null,
            }).select("id").single();
            if (!nErr && newNcr) {
              createdRecords.ncr = newNcr.id;
              await serviceClient.from("documents").update({ linked_ncr_id: newNcr.id }).eq("id", document_id);

              // 12. Create CAPA if data found
              if (extracted.capa?.title) {
                const capaNumber = `CAPA-${Date.now().toString(36).toUpperCase()}`;
                const { data: newCapa, error: cErr } = await serviceClient.from("capas").insert({
                  user_id: user.id,
                  ncr_id: newNcr.id,
                  capa_number: capaNumber,
                  title: extracted.capa.title,
                  description: extracted.capa.description || null,
                  type: extracted.capa.type || "corrective",
                  status: "open",
                  priority: extracted.capa.priority || "medium",
                  root_cause: extracted.capa.root_cause || null,
                  action_plan: extracted.capa.action_plan || null,
                  assigned_to: extracted.capa.assigned_to || null,
                  due_date: extracted.capa.due_date || null,
                  effectiveness_check: extracted.capa.effectiveness_check || null,
                }).select("id").single();
                if (!cErr && newCapa) {
                  createdRecords.capa = newCapa.id;
                }
              }
            }
          }
        }
      }
    } else {
      // Handle documents without supplier info but with other data
      // e.g. standalone NCRs or CAPAs
      if (extracted.ncr?.title) {
        const ncrNumber = `NCR-${Date.now().toString(36).toUpperCase()}`;
        const { data: newNcr, error: nErr } = await serviceClient.from("ncrs").insert({
          user_id: user.id,
          ncr_number: ncrNumber,
          title: extracted.ncr.title,
          description: extracted.ncr.description || null,
          severity: extracted.ncr.severity || "minor",
          status: "open",
          disposition: extracted.ncr.disposition || null,
          root_cause: extracted.ncr.root_cause || null,
          corrective_action: extracted.ncr.corrective_action || null,
        }).select("id").single();
        if (!nErr && newNcr) {
          createdRecords.ncr = newNcr.id;
          await serviceClient.from("documents").update({ linked_ncr_id: newNcr.id }).eq("id", document_id);
        }
      }

      if (extracted.capa?.title) {
        const capaNumber = `CAPA-${Date.now().toString(36).toUpperCase()}`;
        await serviceClient.from("capas").insert({
          user_id: user.id,
          capa_number: capaNumber,
          title: extracted.capa.title,
          description: extracted.capa.description || null,
          type: extracted.capa.type || "corrective",
          status: "open",
          priority: extracted.capa.priority || "medium",
          root_cause: extracted.capa.root_cause || null,
          action_plan: extracted.capa.action_plan || null,
          assigned_to: extracted.capa.assigned_to || null,
          due_date: extracted.capa.due_date || null,
          effectiveness_check: extracted.capa.effectiveness_check || null,
        });
        createdRecords.capa = "created";
      }
    }

    return new Response(JSON.stringify({
      success: true,
      document_type: extracted.document_type,
      summary: extracted.summary,
      confidence: extracted.confidence,
      created_records: createdRecords,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-document error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
