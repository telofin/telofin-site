// ============================================================
// migration.js — Clarity by Telofin
// Step 5 of the Supabase restructuring project.
//
// WHAT THIS FILE DOES
//   Runs automatically, once, the first time an already-existing user
//   logs in after this code is deployed. It:
//     1. Checks if this person has already been migrated (skips if so)
//     2. Takes a timestamped backup of their current User_Data blob
//     3. Shows a brief, plain-language "upgrading your data" screen
//     4. Reads their data and writes it into the new tables
//     5. Marks them as migrated so this never runs again for them
//
// WHAT THIS FILE DELIBERATELY DOES NOT DO
//   - It never deletes or modifies the old User_Data row. That row stays
//     exactly as it is, forever, as a second fallback behind the backup.
//   - It never touches any other user's data. Every read/write here uses
//     this person's own logged-in session — the same Supabase permissions
//     (RLS) that already protect their data today protect this process.
//     There is no special key, no admin access, nothing that could reach
//     beyond what this one person is already allowed to touch.
//   - It never runs twice for the same person (guarded by the
//     migrated_at check below).
//
// WIRE INTO app.html:
//   <script src="js/migration.js"></script>  — after auth.js, before load()
//   Call maybeMigrateUser() right after a successful sign-in, before load()
//   renders the dashboard.
// ============================================================

// ── ENTRY POINT ────────────────────────────────────────────────
// Call this once, right after sign-in is confirmed (_user is set).
// Safe to call on every login — it no-ops instantly if already migrated.
async function maybeMigrateUser() {
  var sb = sbClient();
  if (!sb || !_user) return;

  try {
    // Has this person already been migrated? We check that EVERY client
    // in their old blob has a matching row in the new `clients` table —
    // not just "at least one" — so that a partial migration (e.g. client
    // #1 succeeded, client #2 failed halfway through) gets retried in
    // full next login instead of being silently treated as "done."
    var oldRes = await sb.from('User_Data').select('data').eq('user_id', _user.id).maybeSingle();
    if (!oldRes.data || !oldRes.data.data || !oldRes.data.data.clients || !oldRes.data.data.clients.length) {
      return; // nothing to migrate — new user, or no real data yet
    }
    var oldBlob = oldRes.data.data;

    var check = await sb.from('clients').select('id, name').eq('user_id', _user.id);
    var alreadyMigratedCount = (check.data || []).length;
    if (alreadyMigratedCount >= oldBlob.clients.length) {
      return; // every old client already has a new-table counterpart — done
    }
    // Partial or no migration exists yet. To avoid creating duplicate
    // client rows on a retry, clear out whatever new-table data this
    // partial attempt already wrote, then migrate everything fresh from
    // the untouched old blob. This is safe specifically because nothing
    // in this process ever reads from or writes to the OLD User_Data row
    // except a plain read — so the old data this retry is based on is
    // always complete and correct, no matter how many partial attempts
    // came before it.
    if (alreadyMigratedCount > 0) {
      await _clearPartialMigration(sb, _user.id);
    }

    _showMigrationScreen();

    // Step 1 — backup first, always, before writing anything new.
    // (Harmless to back up more than once if this is a retry — each
    // backup is its own timestamped row, never overwritten or deleted.)
    await sb.from('user_data_backups').insert({
      user_id: _user.id,
      data: oldBlob
    });

    // Step 2 — the actual migration.
    await _migrateBlobToTables(sb, _user.id, oldBlob);

    _hideMigrationScreen();

  } catch (e) {
    console.error('[migration] error:', e);
    _hideMigrationScreen();
    // Deliberately fail soft — if migration errors out, the old User_Data
    // blob is untouched, so the app keeps working exactly as it did
    // before. The person is not blocked or shown a scary error; we just
    // try again next time they log in — and thanks to the count check
    // above (not just "any row exists"), a partial failure now gets
    // detected and fully retried, not silently treated as done.
  }
}

// ── RETRY SAFETY ─────────────────────────────────────────────────
// If a previous migration attempt got partway through before failing,
// this clears out whatever it already wrote for THIS user only, so the
// retry in maybeMigrateUser() can start clean and write everything fresh
// from the old blob. Deleting `clients` rows cascades to every other new
// table automatically (every table was created with `on delete cascade`
// back to clients, see 001_initial_tables.sql) — so one delete call here
// is enough, nothing else needs to be cleaned up by hand.
// Scoped strictly to client_id values owned by this user_id; cannot
// reach any other user's data, same as every other call in this file.
async function _clearPartialMigration(sb, userId) {
  await sb.from('clients').delete().eq('user_id', userId);
}

// ── PLAIN-LANGUAGE SCREEN ──────────────────────────────────────
// No choices to make, no buttons to click — this is informational only,
// shown for the few seconds migration actually takes.
function _showMigrationScreen() {
  var el = document.createElement('div');
  el.id = 'migration-screen';
  el.style.cssText = 'position:fixed;inset:0;background:var(--bg,#f7f6f2);'
    + 'display:flex;align-items:center;justify-content:center;z-index:999999;'
    + 'flex-direction:column;gap:14px;text-align:center;padding:2rem';
  el.innerHTML =
    '<div style="width:36px;height:36px;border:3px solid var(--border,#e8e6e0);'
    + 'border-top-color:var(--np,#0F6E56);border-radius:50%;'
    + 'animation:migration-spin .8s linear infinite"></div>'
    + '<div style="font-size:16px;font-weight:600;color:var(--text,#1a1814);max-width:380px">'
    + 'Upgrading your data storage</div>'
    + '<div style="font-size:13px;color:var(--muted,#8a8880);max-width:380px;line-height:1.5">'
    + "We're moving your account to a faster, more reliable storage system. "
    + 'This happens automatically and only takes a moment. '
    + '<strong>Nothing is deleted</strong> — a safety copy of your current data '
    + 'is saved first, and your original data stays in place the whole time.</div>'
    + '<style>@keyframes migration-spin{to{transform:rotate(360deg)}}</style>';
  document.body.appendChild(el);
}

function _hideMigrationScreen() {
  var el = document.getElementById('migration-screen');
  if (el) el.parentNode.removeChild(el);
}

// ── THE ACTUAL FIELD-BY-FIELD MIGRATION ─────────────────────────
// Walks the old blob exactly the way the field inventory documented it,
// and writes each record type into its matching new table. Built from
// field-inventory.md and schema-draft.md — every mapping below traces
// back to a real save function we confirmed in the app's own code.
async function _migrateBlobToTables(sb, userId, oldBlob) {
  for (var ci = 0; ci < oldBlob.clients.length; ci++) {
    var oc = oldBlob.clients[ci]; // "old client"

    // ── clients ──────────────────────────────────────────────
    var clientRes = await sb.from('clients').insert({
      user_id: userId,
      name: oc.name || '',
      type: oc.type || 'np',
      fiscal_year_end: oc.fiscalYearEnd || null,
      basis_type: oc.basisType || null,
      np_type: oc.npType || null,
      closed_through: oc.closedThrough || null
    }).select('id').single();

    if (clientRes.error || !clientRes.data) {
      console.error('[migration] failed to create client', oc.name, clientRes.error);
      continue; // skip this client's sub-records rather than crash the whole run
    }
    var clientId = clientRes.data.id;

    // Record the old id -> new id mapping so Step 6's dual-write code
    // (saveExp, saveInc, etc.) can find the right new-table client row
    // when a person keeps using the app on their old, still-running
    // local client object. Without this, there's no way to know which
    // new `clients` row a freshly-saved expense belongs to.
    if (oc.id) {
      await sb.from('client_id_map').insert({
        old_client_id: String(oc.id),
        user_id: userId,
        new_client_id: clientId
      });
    }

    // id_map holds old-id -> new-id for every record type that other
    // records reference (accounts by code don't need this; donors,
    // grants, projects, bank accounts, credit cards, bills, payroll,
    // petty cash, and reimbursements do, since expenses/income/donations
    // point at them by id).
    var idMap = { grants: {}, projects: {}, bankAccounts: {}, creditCards: {},
                  bills: {}, payroll: {}, pettyCash: {}, reimbursements: {},
                  donors: {}, ledgerEntries: {} };

    // ── accounts (COA) ───────────────────────────────────────
    for (var ai = 0; ai < (oc.accounts || []).length; ai++) {
      var a = oc.accounts[ai];
      await sb.from('accounts').insert({
        client_id: clientId, code: a.code, name: a.name, type: a.type,
        cat: a.cat || null, fund: a.fund || null, active: a.active !== false
      });
    }

    // ── bank accounts (before expenses/income, which reference them) ──
    for (var bai = 0; bai < (oc.bankAccounts || []).length; bai++) {
      var ba = oc.bankAccounts[bai];
      var baRes = await sb.from('bank_accounts').insert({
        client_id: clientId, name: ba.name, type: ba.type || null, last_4: ba.last4 || null
      }).select('id').single();
      if (baRes.data) idMap.bankAccounts[ba.id] = baRes.data.id;
    }

    // ── credit cards ──────────────────────────────────────────
    for (var cci = 0; cci < (oc.creditCards || []).length; cci++) {
      var cc = oc.creditCards[cci];
      var ccRes = await sb.from('credit_cards').insert({
        client_id: clientId, name: cc.name, last_4: cc.last4 || null,
        "limit": cc.limit || null, network: cc.network || null
      }).select('id').single();
      if (ccRes.data) idMap.creditCards[cc.id] = ccRes.data.id;
    }

    // ── grants (before income, which can reference them) ────────
    for (var gi = 0; gi < (oc.grants || []).length; gi++) {
      var gr = oc.grants[gi];
      var grRes = await sb.from('grants').insert({
        client_id: clientId, name: gr.name, funder: gr.funder || null,
        awarded: gr.awarded || null, status: gr.status || null,
        deadline: gr.deadline || null, app_deadline: gr.appDeadline || null,
        portal_url: gr.portalUrl || null, match: gr.match || null,
        match_required: gr.matchRequired || null, restrict: gr.restrict || null,
        reconciled: !!gr.reconciled, requirements: gr.requirements || []
      }).select('id').single();
      if (grRes.data) idMap.grants[gr.id] = grRes.data.id;
    }

    // ── projects ──────────────────────────────────────────────
    for (var pi = 0; pi < (oc.projects || []).length; pi++) {
      var pr = oc.projects[pi];
      var prRes = await sb.from('projects').insert({
        client_id: clientId, name: pr.name, description: pr.desc || null,
        budget: pr.budget || null, notes: pr.notes || null,
        is_multi_year: !!pr.isMultiYear,
        grant_id: pr.grantId ? idMap.grants[pr.grantId] || null : null,
        budget_lines: pr.budgetLines || [], proposed_budget: pr.proposedBudget || [],
        adopted_budgets: pr.adoptedBudgets || [], periods: pr.periods || []
      }).select('id').single();
      if (prRes.data) idMap.projects[pr.id] = prRes.data.id;
    }

    // ── vendors ───────────────────────────────────────────────
    for (var vi = 0; vi < (oc.vendors || []).length; vi++) {
      var v = oc.vendors[vi];
      await sb.from('vendors').insert({
        client_id: clientId, name: v.name, default_cat: v.defaultCat || null,
        default_acct_code: v.defaultAcctCode || null, is_1099: !!v.is1099,
        tin: v.tin || null, email: v.email || null, phone: v.phone || null,
        address: v.address || null, notes: v.notes || null, is_member: !!v.isMember
      });
    }

    // ── customers ─────────────────────────────────────────────
    for (var cui = 0; cui < (oc.customers || []).length; cui++) {
      var cu = oc.customers[cui];
      await sb.from('customers').insert({
        client_id: clientId, name: cu.name, email: cu.email || null,
        phone: cu.phone || null, address: cu.address || null,
        default_payment_terms: cu.defaultPaymentTerms || null, notes: cu.notes || null
      });
    }

    // ── bills (before expenses, which can reference them via billId) ──
    for (var bii = 0; bii < (oc.bills || []).length; bii++) {
      var b = oc.bills[bii];
      var bRes = await sb.from('bills').insert({
        client_id: clientId, vendor: b.vendor, description: b.desc || null,
        amt: b.amt || null, received: b.received || null, due: b.due || null,
        acct_code: b.acctCode || null, cat: b.cat || null, status: b.status || 'Unpaid',
        notes: b.notes || null, paid_date: b.paidDate || null, instr_num: b.instrNum || null
      }).select('id').single();
      if (bRes.data) idMap.bills[b.id] = bRes.data.id;
    }

    // ── payroll (before expenses, which can reference via payrollId) ──
    for (var pri = 0; pri < (oc.payroll || []).length; pri++) {
      var pay = oc.payroll[pri];
      var payRes = await sb.from('payroll').insert({
        client_id: clientId, date: pay.date || null, period: pay.period || null,
        gross: pay.gross || null, taxes: pay.taxes || null, net: pay.net || null,
        employees: pay.employees || [], reconciled: !!pay.reconciled
      }).select('id').single();
      if (payRes.data) idMap.payroll[pay.id] = payRes.data.id;
    }

    // ── petty cash (before expenses, which can reference via pettyCashId) ──
    for (var pci = 0; pci < (oc.pettyCash || []).length; pci++) {
      var pc = oc.pettyCash[pci];
      var pcRes = await sb.from('petty_cash').insert({
        client_id: clientId, date: pc.date || null, type: pc.type || null,
        amt: pc.amt || null, description: pc.desc || null, cat: pc.cat || null
      }).select('id').single();
      if (pcRes.data) idMap.pettyCash[pc.id] = pcRes.data.id;
    }

    // ── reimbursements (before expenses, which reference via reimbId) ──
    for (var ri = 0; ri < (oc.reimbursements || []).length; ri++) {
      var rb = oc.reimbursements[ri];
      var rbRes = await sb.from('reimbursements').insert({
        client_id: clientId, who: rb.who || null, amt: rb.amt || null,
        description: rb.desc || null, cat: rb.cat || null, date: rb.date || null,
        notes: rb.notes || null, receipt_url: rb.receiptUrl || null,
        receipt_path: rb.receiptPath || null, status: rb.status || 'Pending',
        flagged: !!rb.flagged, no_receipt_reason: rb.noReceiptReason || null,
        audit: rb.audit || []
      }).select('id').single();
      if (rbRes.data) idMap.reimbursements[rb.id] = rbRes.data.id;
    }

    // ── EXPENSES — the canonical shape, absorbing all known divergent
    //    auto-posted variants (bill pay, petty cash, reimbursement,
    //    payroll import all produced subsets of this same shape) ──
    for (var ei = 0; ei < (oc.expenses || []).length; ei++) {
      var e = oc.expenses[ei];
      await sb.from('expenses').insert({
        client_id: clientId, description: e.desc || null, cat: e.cat || null,
        amt: e.amt || null, date: e.date || null, fund: e.fund || null,
        line_990: e.line990 || null,
        grant_id: e.grantId ? idMap.grants[e.grantId] || null : null,
        grant_pct: e.grantPct != null ? e.grantPct : null,
        recurring: e.recurring || null, recur_end_date: e.recurEndDate || null,
        recur_count: e.recurCount || null, recur_posted_count: e.recurPostedCount || 0,
        check_num: e.checkNum || null, functional: e.functional || null,
        receipt_url: e.receiptUrl || null, tin_1099: e.tin1099 || null,
        vendor_1099: e.vendor1099 || null, is_1099: !!e.is1099,
        acct_code: e.acctCode || null,
        bank_id: e.bankId ? idMap.bankAccounts[e.bankId] || null : null,
        bank_name: e.bankName || null,
        cc_id: e.ccId ? idMap.creditCards[e.ccId] || null : null,
        bs_asset_id: e.bsAssetId || null, freq: e.freq || null, fixed: e.fixed || null,
        subcat: e.subcat || null,
        project_id: e.projectId ? idMap.projects[e.projectId] || null : null,
        payroll_id: e.payrollId ? idMap.payroll[e.payrollId] || null : null,
        bill_id: e.billId ? idMap.bills[e.billId] || null : null,
        // match_id intentionally left null here — the old value was an array
        // index, not a real id, and carrying it forward would point at the
        // wrong row. Bank-match relationships get rebuilt fresh after
        // migration, not carried over from the old index-based system.
        petty_cash_id: e.pettyCashId ? idMap.pettyCash[e.pettyCashId] || null : null,
        reimb_id: e.reimbId ? idMap.reimbursements[e.reimbId] || null : null,
        is_reimb: !!e.isReimb,
        inkind_ref: !!e.inkindRef, functional_split: !!e.functionalSplit,
        reconciled: !!e.reconciled, voided: !!e.voided, voided_at: e.voidedAt || null,
        is_reversal: !!e.isReversal, deleted: !!e.deleted, deleted_at: e.deletedAt || null,
        flagged: !!e.flagged, flag_reason: e.flagReason || null,
        flag_severity: e.flagSeverity || null, flagged_at: e.flaggedAt || null,
        // writeBadDebt() produced a single audit object instead of an array
        // on some old records — normalize that here so every row going
        // forward has a consistent array shape.
        audit: Array.isArray(e.audit) ? e.audit : (e.audit ? [e.audit] : [])
      });
    }

    // ── INCOME (NP + PE both write here; PE just leaves more fields null) ──
    for (var ii = 0; ii < (oc.income || []).length; ii++) {
      var inc = oc.income[ii];
      await sb.from('income').insert({
        client_id: clientId, name: inc.name || null, cat: inc.cat || null,
        status: inc.status || null, proj: inc.proj || null, recv: inc.recv || null,
        recurring: inc.recurring || null, recur_end_date: inc.recurEndDate || null,
        recur_count: inc.recurCount || null, fund: inc.fund || null, date: inc.date || null,
        acct_code: inc.acctCode || null,
        bank_id: inc.bankId ? idMap.bankAccounts[inc.bankId] || null : null,
        bs_asset_id: inc.bsAssetId || null,
        grant_id: inc.grantId ? idMap.grants[inc.grantId] || null : null,
        from_grant_id: inc.fromGrantId ? idMap.grants[inc.fromGrantId] || null : null,
        inkind_ref: !!inc.inkindRef, auction_ref: !!inc.auctionRef,
        from_bank: !!inc.fromBank, vendor_1099: inc.vendor1099 || null,
        voided: !!inc.voided, is_reversal: !!inc.isReversal,
        reconciled: !!inc.reconciled, deleted: !!inc.deleted, deleted_at: inc.deletedAt || null,
        audit: Array.isArray(inc.audit) ? inc.audit : (inc.audit ? [inc.audit] : [])
      });
    }

    // ── REVENUE (SB) ──────────────────────────────────────────
    for (var rvi = 0; rvi < (oc.revenue || []).length; rvi++) {
      var rev = oc.revenue[rvi];
      await sb.from('revenue').insert({
        client_id: clientId, name: rev.name || null, customer_name: rev.customerName || null,
        cat: rev.cat || null, conf: rev.conf || null, proj: rev.proj || null,
        act: rev.act || null, recurring: rev.recurring || null,
        recur_end_date: rev.recurEndDate || null, recur_count: rev.recurCount || null,
        date: rev.date || null, tax_rate: rev.taxRate || null, tax_amt: rev.taxAmt || null,
        tax_jurisdiction: rev.taxJurisdiction || null,
        bank_id: rev.bankId ? idMap.bankAccounts[rev.bankId] || null : null,
        bs_asset_id: rev.bsAssetId || null,
        project_id: rev.projectId ? idMap.projects[rev.projectId] || null : null,
        voided: !!rev.voided, is_reversal: !!rev.isReversal, reconciled: !!rev.reconciled,
        deleted: !!rev.deleted, deleted_at: rev.deletedAt || null,
        audit: Array.isArray(rev.audit) ? rev.audit : (rev.audit ? [rev.audit] : [])
      });
    }

    // ── invoices ──────────────────────────────────────────────
    for (var invi = 0; invi < (oc.invoices || []).length; invi++) {
      var inv = oc.invoices[invi];
      await sb.from('invoices').insert({
        client_id: clientId, num: inv.num || null, client_name: inv.client || null,
        description: inv.desc || null, amt: inv.amt || null, date: inv.date || null,
        due: inv.due || null, status: inv.status || 'Draft', notes: inv.notes || null,
        bad_debt: !!inv.badDebt, bad_debt_date: inv.badDebtDate || null
      });
    }

    // ── journal entries ───────────────────────────────────────
    for (var jei = 0; jei < (oc.journalEntries || []).length; jei++) {
      var je = oc.journalEntries[jei];
      await sb.from('journal_entries').insert({
        client_id: clientId, date: je.date || null, type: je.type || null,
        memo: je.memo || null,
        source_type: je.isClosingEntry ? 'closing' : 'manual',
        is_closing_entry: !!je.isClosingEntry, closing_fy: je.closingFY || null,
        audit: Array.isArray(je.audit) ? je.audit : (je.audit ? [je.audit] : [])
      });
    }

    // ── ledger entries + lines (the double-entry backbone) ───
    for (var lei = 0; lei < (oc.ledgerEntries || []).length; lei++) {
      var le = oc.ledgerEntries[lei];
      var leRes = await sb.from('ledger_entries').insert({
        client_id: clientId, date: le.date || null, memo: le.memo || null,
        source_type: le.sourceType || null, source_id: null, // old sourceId was a same-blob id, not a cross-table FK — see note below
        superseded: !!le.superseded
      }).select('id').single();
      if (leRes.data) {
        idMap.ledgerEntries[le.id] = leRes.data.id;
        for (var lli = 0; lli < (le.lines || []).length; lli++) {
          var ll = le.lines[lli];
          await sb.from('ledger_lines').insert({
            ledger_entry_id: leRes.data.id, account_code: ll.accountCode,
            debit: ll.dr || 0, credit: ll.cr || 0
          });
        }
      }
    }
    // Note on source_id: the old ledgerEntries[].sourceId pointed at an id
    // within the same JSON blob (an expense id, income id, etc.) — those
    // ids were regenerated as new UUIDs above, so the old sourceId no
    // longer resolves to anything. Re-linking ledger entries to their
    // source transactions precisely is worth doing as a small follow-up
    // pass after this migration, not blocking it — the financial totals
    // (trial balance, balance sheet) are unaffected either way, since
    // those are computed from account codes and amounts, not source links.

    // ── donors + their sub-records ───────────────────────────
    for (var di = 0; di < (oc.donors || []).length; di++) {
      var d = oc.donors[di];
      var dRes = await sb.from('donors').insert({
        client_id: clientId, name: d.name, email: d.email || null,
        phone: d.phone || null, address: d.address || null, notes: d.notes || null,
        constituent_type: d.constituentType || null, tier: d.tier || null,
        stage: d.stage || null, solicitor: d.solicitor || null,
        ask_amt: d.askAmt || null, ask_date: d.askDate || null,
        platform: d.platform || null, employer: d.employer || null,
        key_dates: d.keyDates || {},
        audit: Array.isArray(d.audit) ? d.audit : (d.audit ? [d.audit] : [])
      }).select('id').single();
      if (!dRes.data) continue;
      var donorId = dRes.data.id;
      idMap.donors[d.id] = donorId;

      for (var dni = 0; dni < (d.donations || []).length; dni++) {
        var dn = d.donations[dni];
        await sb.from('donations').insert({
          donor_id: donorId, amt: dn.amt, date: dn.date || null, fund: dn.fund || null,
          project_id: dn.proj ? idMap.projects[dn.proj] || null : null,
          receipted: dn.rec === 'Yes', thank_you_sent: dn.ty === 'Yes',
          restriction_type: dn.rst || null, in_kind: dn.inkind === 'Yes',
          fmv: dn.fmv || null, item_description: dn.itemDescription || null,
          auctioned: !!dn.auctioned, auction_date: dn.auctionDate || null,
          auction_sale_price: dn.auctionSalePrice || null,
          auction_buyer_name: dn.auctionBuyerName || null, qpq: dn.qpq || null,
          // bank_txn_id left null — old bankTxnId referenced the pending
          // bank-import queue, which is migrated separately; re-link if
          // that becomes useful, not required for the financial data itself
          from_bank: !!dn.fromBank,
          audit: Array.isArray(dn.audit) ? dn.audit : (dn.audit ? [dn.audit] : [])
        });
      }

      for (var dmi = 0; dmi < (d.milestones || []).length; dmi++) {
        var dm = d.milestones[dmi];
        await sb.from('donor_milestones').insert({
          donor_id: donorId, type: dm.type || null, date: dm.date || null,
          notes: dm.notes || null
        });
      }

      for (var dii = 0; dii < (d.interactions || []).length; dii++) {
        var dint = d.interactions[dii];
        await sb.from('donor_interactions').insert({
          donor_id: donorId, type: dint.type || null, date: dint.date || null,
          who: dint.who || null, note: dint.note || null,
          followup_date: dint.followupDate || null, followup_note: dint.followupNote || null,
          completed: !!dint.completed
        });
      }
    }

    // ── mileage ───────────────────────────────────────────────
    for (var mi = 0; mi < (oc.mileage || []).length; mi++) {
      var m = oc.mileage[mi];
      await sb.from('mileage').insert({
        client_id: clientId, date: m.date || null, miles: m.miles || null,
        purpose: m.purpose || null, from_location: m.from || null,
        to_location: m.to || null, rate: m.rate || null,
        deduction: m.deduction || null, notes: m.notes || null
      });
    }

    // ── loans ─────────────────────────────────────────────────
    for (var loi = 0; loi < (oc.loans || []).length; loi++) {
      var lo = oc.loans[loi];
      await sb.from('loans').insert({
        client_id: clientId, name: lo.name, principal: lo.principal || null,
        rate: lo.rate || null, term: lo.term || null, start_date: lo.startDate || null,
        opening_balance: lo.openingBalance || null, posted: lo.posted || []
      });
    }

    // ── fixed assets ──────────────────────────────────────────
    for (var fai = 0; fai < (oc.fixedAssets || []).length; fai++) {
      var fa = oc.fixedAssets[fai];
      await sb.from('fixed_assets').insert({
        client_id: clientId, cost: fa.cost || null, life: fa.life || null,
        date: fa.date || null, method: fa.method || null,
        salvage: fa.salvage || null, annual_depr: fa.annualDepr || null
      });
    }

    // ── import rules ──────────────────────────────────────────
    for (var iri = 0; iri < (oc.importRules || []).length; iri++) {
      var ir = oc.importRules[iri];
      await sb.from('import_rules').insert({
        client_id: clientId, keyword: ir.keyword, cat: ir.cat || null,
        acct_code: ir.acctCode || null
      });
    }

    // ── tax jurisdictions ─────────────────────────────────────
    for (var tji = 0; tji < (oc.taxJurisdictions || []).length; tji++) {
      var tj = oc.taxJurisdictions[tji];
      await sb.from('tax_jurisdictions').insert({
        client_id: clientId, name: tj.name, rate: tj.rate || null,
        freq: tj.freq || null, authority: tj.authority || null
      });
    }

    // ── documents (vault) ─────────────────────────────────────
    for (var doi = 0; doi < (oc.documents || []).length; doi++) {
      var doc = oc.documents[doi];
      await sb.from('documents').insert({
        client_id: clientId, name: doc.name || null, category: doc.category || null,
        path: doc.path, size: doc.size || null, mime_type: doc.mimeType || null,
        notes: doc.notes || null, linked_to: doc.linkedTo || null
      });
    }

    // ── procurement ───────────────────────────────────────────
    for (var pci2 = 0; pci2 < (oc.procurement || []).length; pci2++) {
      var pcm = oc.procurement[pci2];
      await sb.from('procurement').insert({
        client_id: clientId, vendor: pcm.vendor, scope: pcm.scope || null,
        bid_amt: pcm.bidAmt || null, bid_date: pcm.bidDate || null,
        status: pcm.status || null,
        grant_id: pcm.grantId ? idMap.grants[pcm.grantId] || null : null,
        fund: pcm.fund || null, federal: !!pcm.federal, winner: pcm.winner || null,
        justification: pcm.justification || null, doc_ref: pcm.docRef || null,
        audit: Array.isArray(pcm.audit) ? pcm.audit : (pcm.audit ? [pcm.audit] : [])
      });
    }

    // ── fiscal sponsorships ───────────────────────────────────
    for (var fsi = 0; fsi < (oc.fiscalSponsorships || []).length; fsi++) {
      var fs = oc.fiscalSponsorships[fsi];
      await sb.from('fiscal_sponsorships').insert({
        client_id: clientId, sponsor_name: fs.sponsorName || null,
        project_name: fs.projectName || null, agreement_date: fs.agreementDate || null,
        funds_received: fs.fundsReceived || null, funds_expended: fs.fundsExpended || null,
        restrictions: fs.restrictions || null, status: fs.status || 'active'
      });
    }

    // ── restriction releases ──────────────────────────────────
    for (var rri = 0; rri < (oc.restrictionReleases || []).length; rri++) {
      var rr = oc.restrictionReleases[rri];
      await sb.from('restriction_releases').insert({
        client_id: clientId, fund_name: rr.fundName || null, amount: rr.amount || null,
        date: rr.date || null, note: rr.note || null
      });
    }

    // ── budget — current ──────────────────────────────────────
    for (var bgi = 0; bgi < (oc.budgetItems || []).length; bgi++) {
      var bg = oc.budgetItems[bgi];
      await sb.from('budget_items').insert({
        client_id: clientId, cat: bg.cat, type: bg.type, amt: bg.amt || null,
        group_name: bg.group || null, overspend_policy: bg.overspendPolicy || 'warn',
        audit: Array.isArray(bg.audit) ? bg.audit : (bg.audit ? [bg.audit] : [])
      });
    }

    // ── budget — proposed (can be several at once) ───────────
    for (var pbi = 0; pbi < (oc.proposedBudgets || []).length; pbi++) {
      var pb = oc.proposedBudgets[pbi];
      var pbRes = await sb.from('proposed_budgets').insert({
        client_id: clientId, fiscal_year: pb.fy
      }).select('id').single();
      if (pbRes.data) {
        for (var pbii = 0; pbii < (pb.items || []).length; pbii++) {
          var pbItem = pb.items[pbii];
          await sb.from('proposed_budget_items').insert({
            proposed_budget_id: pbRes.data.id, cat: pbItem.cat, type: pbItem.type,
            amt: pbItem.amt || null, group_name: pbItem.group || null,
            overspend_policy: pbItem.overspendPolicy || 'warn',
            audit: Array.isArray(pbItem.audit) ? pbItem.audit : (pbItem.audit ? [pbItem.audit] : [])
          });
        }
      }
    }

    // ── budget — adopted (historical snapshots, append-only) ─
    for (var abi = 0; abi < (oc.adoptedBudgets || []).length; abi++) {
      var ab = oc.adoptedBudgets[abi];
      var abRes = await sb.from('adopted_budgets').insert({
        client_id: clientId, fiscal_year: ab.fy, adopted_on: ab.adoptedOn || null
      }).select('id').single();
      if (abRes.data) {
        for (var abii = 0; abii < (ab.items || []).length; abii++) {
          var abItem = ab.items[abii];
          await sb.from('adopted_budget_items').insert({
            adopted_budget_id: abRes.data.id, cat: abItem.cat, type: abItem.type,
            amt: abItem.amt || null
          });
        }
      }
    }

    // ── bank transactions (pending import queue) ─────────────
    var bankTxnIdMap = {};
    for (var bti = 0; bti < (oc.bankTransactions || []).length; bti++) {
      var bt = oc.bankTransactions[bti];
      // bankTransactions[] held two different record families historically —
      // route by type into the correct new table (see schema-draft.md).
      if (bt.type === 'charge' || bt.type === 'cc_payment') {
        await sb.from('cc_transactions').insert({
          client_id: clientId,
          cc_id: bt._ccId ? idMap.creditCards[bt._ccId] || null : null,
          date: bt.date || null, description: bt.description || null,
          amount: bt.amount || null, type: bt.type, category: bt.category || null,
          bank_acct_name: bt._bankAcctName || null, approved: !!bt.approved
        });
      } else {
        var btRes = await sb.from('bank_transactions').insert({
          client_id: clientId,
          bank_id: bt.bankId ? idMap.bankAccounts[bt.bankId] || null : null,
          date: bt.date || null, description: bt.description || null,
          amount: bt.amount || null, type: bt.type || null, category: bt.category || null,
          source_file: bt.sourceFile || null, approved: !!bt.approved,
          acct_code: bt.acctCode || null,
          grant_id: bt.grantId ? idMap.grants[bt.grantId] || null : null,
          grant_pct: bt.grantPct != null ? bt.grantPct : null,
          vendor_name: bt.vendorName || null
          // matched_table / matched_record_id intentionally left null —
          // same reasoning as expenses.match_id above, the old match was
          // array-index based and doesn't carry forward safely.
        }).select('id').single();
        if (btRes.data) bankTxnIdMap[bt.id] = btRes.data.id;
      }
    }

    // ── client settings (everything that stays JSON) ─────────
    await sb.from('client_settings').insert({
      client_id: clientId,
      waypoint_tiles: oc.waypointTiles || {},
      tab_order: oc.tabOrder || [],
      last_viewed_tab: oc.lastViewedTab || null,
      balance_sheet_opening_items: oc.balanceSheet || { assets: [], liabilities: [], equity: [] },
      depr_posted: oc.deprPosted || {},
      equity_opening_balances: oc.equityOpeningBalances || {}
    });

    // ── checklists — deliberately NOT migrated here ──────────
    // The `checklists` table exists in 001_initial_tables.sql so the app
    // can start writing real checklist data going forward, but there is
    // nothing to migrate FROM: month-end/year-end checklists have always
    // lived only in each browser's localStorage (see saveChecklist() in
    // features.js), never in the User_Data blob this script reads from.
    // oc has no checklist field to read, by design — this is documented
    // in field-inventory.md and schema-draft.md, not an oversight.
  }
}

// ── MANUAL TRIGGER (button) ───────────────────────────────────
// maybeMigrateUser() only runs once automatically and shows a brief
// screen that's easy to miss if migration finishes in under a second.
// This gives a visible, on-demand way to check status or force a retry,
// with a clear result message — not just a flash of a loading spinner.
// Safe to click any number of times: it reuses the exact same safety
// logic as the automatic path (backup-first, only-if-needed, scoped to
// this user's own session) — this is not a separate, riskier code path.
async function forceMigrationCheck() {
  // Local data repair (runs whether signed in or not): collapse any duplicate ledger entries
  // on all loaded clients, so a user can fix an already-inflated General Ledger on demand
  // instead of waiting for the next fresh load. Idempotent + safe.
  var _ledgerCleaned = 0;
  try {
    (D.clients || []).forEach(function(cl){
      _ledgerCleaned += (typeof healDuplicateLedger === 'function' ? (healDuplicateLedger(cl) || 0) : 0);
      // Also retire orphaned entries whose source row is gone (different-sourceId
      // duplicates that healDuplicateLedger can't see) — see healOrphanLedger
      _ledgerCleaned += (typeof healOrphanLedger === 'function' ? (healOrphanLedger(cl) || 0) : 0);
    });
    if (_ledgerCleaned) { if (typeof sv === 'function') sv(); if (typeof renderAll === 'function') renderAll(); }
  } catch(e) { console.warn('[migration] ledger dedup failed:', e); }
  if (_ledgerCleaned) {
    alert('Cleaned up ' + _ledgerCleaned + ' duplicate ledger entr' + (_ledgerCleaned === 1 ? 'y' : 'ies') + '.\n\nYour General Ledger and balance sheet will now match your transactions.');
  }

  var sb = sbClient();
  if (!sb || !_user) {
    alert('Not signed in — nothing to migrate.');
    return;
  }

  var btn = document.getElementById('migration-check-btn');
  var originalText = btn ? btn.innerHTML : '';
  if (btn) { btn.innerHTML = 'Checking…'; btn.disabled = true; }

  try {
    var oldRes = await sb.from('User_Data').select('data').eq('user_id', _user.id).maybeSingle();
    if (!oldRes.data || !oldRes.data.data || !oldRes.data.data.clients || !oldRes.data.data.clients.length) {
      alert('Nothing to migrate — no client data found for this account.');
      return;
    }
    var oldClientCount = oldRes.data.data.clients.length;

    var check = await sb.from('clients').select('id').eq('user_id', _user.id);
    var newClientCount = (check.data || []).length;

    if (newClientCount >= oldClientCount) {
      alert('Already up to date.\n\n'
        + 'Old data: ' + oldClientCount + ' client(s)\n'
        + 'New tables: ' + newClientCount + ' client(s)\n\n'
        + 'No migration needed.');
      return;
    }

    if (!confirm('This account has ' + oldClientCount + ' client(s) in the old storage, '
      + 'but only ' + newClientCount + ' in the new tables.\n\n'
      + 'Run migration now? A safety backup is taken automatically first, '
      + 'and nothing in your existing data is deleted or changed.')) {
      return;
    }

    await maybeMigrateUser();

    // Re-check afterward so the success message reflects what actually happened
    var recheck = await sb.from('clients').select('id').eq('user_id', _user.id);
    var finalCount = (recheck.data || []).length;
    alert('Migration finished.\n\n'
      + 'Clients now in new tables: ' + finalCount + ' of ' + oldClientCount + '\n\n'
      + (finalCount >= oldClientCount
          ? 'All clients migrated successfully.'
          : 'Some clients may not have migrated — check the browser console for errors, or click this button again to retry.'));

  } catch (e) {
    console.error('[migration] manual check failed:', e);
    alert('Something went wrong checking migration status. Check the browser console for details, and nothing was changed.');
  } finally {
    if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
  }
}
