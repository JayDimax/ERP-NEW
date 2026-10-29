// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authenticateErpRequest } from "../_shared/erp-auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, data: any) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function expenseValues(input: any) {
  const quantity = Number(input.quantity);
  const unitCost = Number(input.unitCost ?? input.unit_cost);
  const qualificationId = String(input.qualificationId ?? input.qualification_id ?? "").trim();
  const taxCategoryId = String(input.taxCategoryId ?? input.tax_category_id ?? "").trim();
  return {
    rfq_code: String(input.rfqCode ?? input.rfq_code ?? "").trim(),
    transaction_date: String(input.transactionDate ?? input.transaction_date ?? ""),
    description: String(input.description ?? "").trim(),
    quantity,
    unit_cost: unitCost,
    amount: Math.round(quantity * unitCost * 100) / 100,
    expense_account_id: String(input.expenseAccountId ?? input.expense_account_id ?? "").trim(),
    qualification_id: qualificationId || null,
    tax_category_id: taxCategoryId || null,
    supplier_name: String(input.supplierName ?? input.supplier_name ?? "").trim(),
    claimed_by: String(input.claimedBy ?? input.claimed_by ?? "").trim(),
    employee_id: String(input.employeeId ?? input.employee_id ?? "").trim(),
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Method not allowed" });

  const actor = await authenticateErpRequest(request, admin);
  if (!actor) return json(401, { error: "Invalid, expired, or unlinked Supabase session" });

  const body = await request.json().catch(() => ({}));
  const isSystemAdmin = actor.role === "SYSTEM_ADMIN";
  let orgId = isSystemAdmin
    ? String(body.orgId || body.org_id || "")
    : actor.orgId;
  if (!orgId && isSystemAdmin && body.id) {
    const { data: existing } = await admin.from("time_expenses").select("org_id")
      .eq("id", String(body.id)).maybeSingle();
    orgId = String(existing?.org_id || "");
  }
  if (!orgId) return json(403, { error: "Missing organization scope" });

  if (body.action === "list") {
    const { data, error } = await admin.from("time_expenses").select("*")
      .eq("org_id", orgId).order("created_at", { ascending: false });
    if (error) return json(400, { error: error.message, code: error.code });
    return json(200, { expenses: data || [] });
  }

  if (body.action === "create") {
    const values = expenseValues(body.expense || {});
    if (!values.rfq_code || !values.transaction_date || !values.description || !values.supplier_name || !values.claimed_by || !values.employee_id || !values.expense_account_id) {
      return json(400, { error: "RFQ code, date, description, supplier, claimed by, and expense account are required" });
    }
    if (!(values.quantity > 0) || !(values.unit_cost > 0)) {
      return json(400, { error: "Quantity and unit cost must be greater than zero" });
    }
    const { data: expenseAccount } = await admin.from("chart_of_accounts")
      .select("id").eq("id", values.expense_account_id).eq("org_id", orgId)
      .eq("is_header", false).maybeSingle();
    if (!expenseAccount) return json(403, { error: "Selected account is outside this organization or is not a posting account" });
    if (values.qualification_id) {
      const { data: qualification } = await admin.from("qualifications").select("id")
        .eq("id", values.qualification_id).eq("org_id", orgId).maybeSingle();
      if (!qualification) return json(403, { error: "Class is outside this organization or inactive" });
    } else {
      const { data: orgQualification } = await admin.from("qualifications").select("id")
        .eq("org_id", orgId).limit(1).maybeSingle();
      if (orgQualification) return json(400, { error: "Class is required" });
    }
    if (values.tax_category_id) {
      const { data: taxCategory } = await admin.from("tax_categories").select("id")
        .eq("id", values.tax_category_id).eq("org_id", orgId).maybeSingle();
      if (!taxCategory) return json(403, { error: "Tax category is outside this organization" });
    } else {
      const { data: orgTaxCategory } = await admin.from("tax_categories").select("id")
        .eq("org_id", orgId).limit(1).maybeSingle();
      if (orgTaxCategory) return json(400, { error: "Tax category is required" });
    }
    const { data: employee } = await admin.from("users").select("id")
      .eq("id", values.employee_id).eq("org_id", orgId).neq("role", "SYSTEM_ADMIN")
      .eq("is_active", true).maybeSingle();
    if (!employee) return json(403, { error: "Claimed by employee is outside this organization or inactive" });

    const { data, error } = await admin.from("time_expenses").insert({
      ...values,
      org_id: orgId,
      status: "open",
      created_by: actor.id,
    }).select("*").single();
    if (error) {
      const message = error.code === "23505"
        ? "An expense record with this RFQ / F.R. code already exists in this organization."
        : error.message;
      return json(400, { error: message, code: error.code });
    }
    return json(200, { expense: data });
  }

  const id = String(body.id || "");
  if (!id) return json(400, { error: "Expense id is required" });

  if (body.action === "update") {
    const isReleaseUpdate = body.updates?.status === "released";
    let allowed: Record<string, unknown>;
    if (isReleaseUpdate) {
      allowed = {
        status: "released",
        payable_id: body.updates?.payableId || body.updates?.payable_id || null,
        updated_at: new Date().toISOString(),
      };
    } else {
      const values = expenseValues(body.updates || {});
      if (!values.rfq_code || !values.transaction_date || !values.description || !values.supplier_name || !values.claimed_by || !values.employee_id || !values.expense_account_id) {
        return json(400, { error: "RFQ code, date, description, supplier, claimed by, and expense account are required" });
      }
      if (!(values.quantity > 0) || !(values.unit_cost > 0)) {
        return json(400, { error: "Quantity and unit cost must be greater than zero" });
      }
      const { data: expenseAccount } = await admin.from("chart_of_accounts")
        .select("id").eq("id", values.expense_account_id).eq("org_id", orgId)
        .eq("is_header", false).maybeSingle();
      if (!expenseAccount) return json(403, { error: "Selected account is outside this organization or is not a posting account" });
      if (values.qualification_id) {
        const { data: qualification } = await admin.from("qualifications").select("id")
          .eq("id", values.qualification_id).eq("org_id", orgId).maybeSingle();
        if (!qualification) return json(403, { error: "Class is outside this organization or inactive" });
      } else {
        const { data: orgQualification } = await admin.from("qualifications").select("id")
          .eq("org_id", orgId).limit(1).maybeSingle();
        if (orgQualification) return json(400, { error: "Class is required" });
      }
      if (values.tax_category_id) {
        const { data: taxCategory } = await admin.from("tax_categories").select("id")
          .eq("id", values.tax_category_id).eq("org_id", orgId).maybeSingle();
        if (!taxCategory) return json(403, { error: "Tax category is outside this organization" });
      } else {
        const { data: orgTaxCategory } = await admin.from("tax_categories").select("id")
          .eq("org_id", orgId).limit(1).maybeSingle();
        if (orgTaxCategory) return json(400, { error: "Tax category is required" });
      }
      const { data: employee } = await admin.from("users").select("id")
        .eq("id", values.employee_id).eq("org_id", orgId).neq("role", "SYSTEM_ADMIN")
        .eq("is_active", true).maybeSingle();
      if (!employee) return json(403, { error: "Claimed by employee is outside this organization or inactive" });
      allowed = { ...values, updated_at: new Date().toISOString() };
    }
    const { data, error } = await admin.from("time_expenses").update(allowed)
      .eq("id", id).eq("org_id", orgId).eq("status", "open").select("*").single();
    if (error) {
      const message = error.code === "23505"
        ? "An expense record with this RFQ / F.R. code already exists in this organization."
        : error.message;
      return json(400, { error: message, code: error.code });
    }
    return json(200, { expense: data });
  }

  if (body.action === "delete") {
    const { error } = await admin.from("time_expenses").delete()
      .eq("id", id).eq("org_id", orgId).eq("status", "open");
    if (error) return json(400, { error: error.message, code: error.code });
    return json(200, { success: true });
  }

  return json(400, { error: "Unsupported action" });
});
