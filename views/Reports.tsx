import React, { useState, useMemo } from 'react';
import { useEffect, useCallback } from 'react';
import { TransactionSummary, ChartOfAccount, JournalEntry, JournalLine, AccountClass, Qualification, Batch } from '../types';
import { AccountingService } from '../accountingService';
import { Printer, Download, Clock, Calendar, Award, CheckCircle2, AlertCircle, Info, ChevronRight, TrendingUp, TrendingDown, DollarSign, ShieldCheck, Filter, Building2, BarChart, Wrench } from 'lucide-react';
import CustomReportBuilder from './CustomReportBuilder';
import { DataServiceFactory } from '../services/DataServiceFactory';

interface ReportsProps {
  summaries: TransactionSummary[];
  accounts: ChartOfAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
  qualifications: Qualification[];
  batches: Batch[];
  orgName?: string;
  currency?: string;
  logoUrl?: string;
  orgId: string;
}

type ReportType = 'BS' | 'IS' | 'TB' | 'CFS' | 'CUSTOM';

interface DetailedFinancialRow {
  account: ChartOfAccount;
  summary: TransactionSummary;
  depth: number;
  hasChildren: boolean;
}

const Reports: React.FC<ReportsProps> = ({ accounts: initialAccounts, entries: initialEntries, lines: initialLines, qualifications, batches, orgId, orgName = 'Institution Ledger', currency = 'USD', logoUrl }) => {
  const [reportType, setReportType] = useState<ReportType>('BS');
  const [selectedQualificationId, setSelectedQualificationId] = useState<string>('');
  const [accounts, setReportAccounts] = useState(initialAccounts);
  const [entries, setReportEntries] = useState(initialEntries);
  const [lines, setReportLines] = useState(initialLines);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-01-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const refreshReportData = useCallback(async () => {
    if (!orgId) return;
    setIsRefreshing(true);
    setRefreshError('');

    try {
      const service = DataServiceFactory.getService();
      const [freshAccounts, allEntries] = await Promise.all([
        service.getAccountsByOrg(orgId),
        service.getJournalEntriesByOrg(orgId)
      ]);
      const postedEntries = allEntries.filter(
        entry => (entry.status === 'POSTED' || entry.status === 'REVERSED') && !entry.isDeleted
      );
      const lineGroups: JournalLine[][] = [];

      for (let index = 0; index < postedEntries.length; index += 25) {
        const batch = postedEntries.slice(index, index + 25);
        lineGroups.push(...await Promise.all(batch.map(entry => service.getJournalLinesByEntry(entry.id))));
      }

      setReportAccounts(freshAccounts);
      setReportEntries(postedEntries);
      setReportLines(lineGroups.flat());
    } catch (error) {
      console.error('[Reports] Failed to refresh financial report data:', error);
      setRefreshError('Could not refresh the live ledger. Showing the last loaded data.');
    } finally {
      setIsRefreshing(false);
    }
  }, [orgId]);

  useEffect(() => {
    setReportAccounts(initialAccounts);
    setReportEntries(initialEntries);
    setReportLines(initialLines);
  }, [initialAccounts, initialEntries, initialLines, orgId]);

  useEffect(() => {
    void refreshReportData();
  }, [refreshReportData]);

  const reportSummariesBS = useMemo(() => {
    const filteredEntries = entries.filter(e => e.date <= endDate);
    const filteredEntryIds = new Set(filteredEntries.map(e => e.id));
    const filteredLines = lines.filter(l => filteredEntryIds.has(l.journalEntryId));
    return AccountingService.getLedgerSummaries(accounts, filteredLines);
  }, [accounts, entries, lines, endDate]);

  const reportSummariesIS = useMemo(() => {
    const dateFilteredEntries = entries.filter(e => e.date >= startDate && e.date <= endDate);
    const dateFilteredEntryIds = new Set(dateFilteredEntries.map(e => e.id));
    let targetLines = lines.filter(l => dateFilteredEntryIds.has(l.journalEntryId));

    if (selectedQualificationId && reportType === 'IS') {
      const qualBatchIds = new Set(batches.filter(b => b.qualificationId === selectedQualificationId).map(b => b.id));
      const qualAccountIds = new Set(accounts.filter(a => a.qualificationId === selectedQualificationId).map(a => a.id));

      targetLines = targetLines.filter(line => {
        const isAttributedBatch = line.batchId && qualBatchIds.has(line.batchId);
        const isAttributedAccount = qualAccountIds.has(line.accountId);
        return isAttributedBatch || isAttributedAccount;
      });
    }

    return AccountingService.getLedgerSummaries(accounts, targetLines);
  }, [accounts, entries, lines, batches, startDate, endDate, selectedQualificationId, reportType]);

  const reportSummariesOpening = useMemo(() => {
    const openingEntryIds = new Set(entries.filter(entry => entry.date < startDate).map(entry => entry.id));
    return AccountingService.getLedgerSummaries(
      accounts,
      lines.filter(line => openingEntryIds.has(line.journalEntryId))
    );
  }, [accounts, entries, lines, startDate]);

  const buildDetailedFinancialRows = (sourceSummaries: TransactionSummary[], accountClass: AccountClass) => {
    const summariesByAccountId = new Map(sourceSummaries.map(summary => [summary.accountId, summary]));
    const accountsByParentId = accounts.reduce<Map<string, ChartOfAccount[]>>((map, account) => {
      const parentKey = account.parentId || '__root__';
      const siblings = map.get(parentKey) || [];
      siblings.push(account);
      map.set(parentKey, siblings);
      return map;
    }, new Map());

    accountsByParentId.forEach(siblings => {
      siblings.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }) || a.name.localeCompare(b.name));
    });

    const collectAccountRows = (account: ChartOfAccount, depth: number): DetailedFinancialRow[] => {
      const children = accountsByParentId.get(account.id) || [];
      const childRows = children.flatMap(child => collectAccountRows(child, depth + 1));

      const summary = summariesByAccountId.get(account.id);
      const balance = summary?.balance || 0;
      const hasVisibleBalance = Math.abs(balance) > 0.01;
      const shouldShow = account.class === accountClass && (hasVisibleBalance || childRows.length > 0);

      if (!summary || !shouldShow) {
        return [];
      }

      return [{
        account,
        summary,
        depth,
        hasChildren: children.length > 0
      }, ...childRows];
    };

    return (accountsByParentId.get('__root__') || [])
      .filter(account => account.class === accountClass)
      .flatMap(account => collectAccountRows(account, 0));
  };

  const bs = useMemo(() => AccountingService.generateBalanceSheet(reportSummariesBS, accounts), [reportSummariesBS, accounts]);

  const balanceSheetDetails = useMemo(() => {
    return {
      assets: buildDetailedFinancialRows(reportSummariesBS, AccountClass.ASSET),
      liabilities: buildDetailedFinancialRows(reportSummariesBS, AccountClass.LIABILITY),
      equity: buildDetailedFinancialRows(reportSummariesBS, AccountClass.EQUITY)
    };
  }, [accounts, reportSummariesBS]);

  const isReport = useMemo(() => {
    return AccountingService.generateIncomeStatement(reportSummariesIS, accounts);
  }, [reportSummariesIS, accounts]);

  const incomeStatementDetails = useMemo(() => {
    return {
      revenue: buildDetailedFinancialRows(reportSummariesIS, AccountClass.REVENUE),
      expenses: buildDetailedFinancialRows(reportSummariesIS, AccountClass.EXPENSE)
    };
  }, [accounts, reportSummariesIS]);

  const cfsReport = useMemo(() => {
    const periodLines = lines.filter(l => {
      const entry = entries.find(e => e.id === l.journalEntryId);
      return entry && entry.date >= startDate && entry.date <= endDate;
    });
    return AccountingService.generateCashFlow(reportSummariesIS, accounts, periodLines, reportSummariesOpening, reportSummariesBS);
  }, [reportSummariesIS, reportSummariesOpening, reportSummariesBS, accounts, lines, entries, startDate, endDate]);

  const formatCurrency = (val: number) => {
    return `\u20B1 ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val)}`;
  };

  const handlePrint = () => {
    const previousTitle = document.title;
    const reportLabel =
      reportType === 'BS' ? 'Balance Sheet' :
        reportType === 'IS' ? 'Profit and Loss' :
          reportType === 'CFS' ? 'Cash Flow' :
            reportType === 'TB' ? 'Trial Balance' : 'Financial Report';

    const printTitle = `${orgName} - ${reportLabel}`;
    const reportNode = document.querySelector<HTMLElement>('.reports-print-area');

    if (!reportNode) {
      window.print();
      return;
    }

    const reportClone = reportNode.cloneNode(true) as HTMLElement;
    reportClone.querySelector('.reports-print-header')?.remove();
    reportClone.querySelector('.reports-print-footer')?.remove();

    const applyImportantStyle = (selector: string, styles: string) => {
      const element = reportClone.querySelector<HTMLElement>(selector);
      if (!element) return;
      element.setAttribute('style', `${element.getAttribute('style') || ''}; ${styles}`);
    };

    reportClone.setAttribute(
      'style',
      `${reportClone.getAttribute('style') || ''}; width:auto !important; max-width:none !important; margin:0 !important; padding:6mm 0 !important; border:0 !important; box-shadow:none !important; background:#fff !important; color:#000 !important;`
    );
    applyImportantStyle(
      '.reports-screen-header',
      'display:block !important; text-align:center !important; padding:2mm 0 5mm 0 !important; margin:0 !important; border-bottom:0 !important; background:#fff !important;'
    );
    applyImportantStyle(
      '.reports-print-body',
      'display:block !important; padding:0 !important; margin:0 !important; background:#fff !important; line-height:1.2 !important;'
    );
    applyImportantStyle(
      '.reports-signatures',
      'display:block !important; padding:5mm 0 0 0 !important; margin:0 !important; page-break-inside:avoid !important; break-inside:avoid !important;'
    );
    applyImportantStyle(
      '.reports-signatures > div',
      'display:grid !important; grid-template-columns:repeat(2,minmax(0,1fr)) !important; gap:14mm !important; padding-top:8mm !important; margin:0 !important;'
    );

    const styles = Array.from(document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style'))
      .map(node => {
        if (node.tagName.toLowerCase() === 'link') {
          const link = node as HTMLLinkElement;
          return `<link rel="stylesheet" href="${link.href}">`;
        }
        return `<style>${node.innerHTML}</style>`;
      })
      .join('\n');

    const escapeHtml = (value: string) => value.replace(/[<>&"]/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[char] || char));
    const printFrame = document.createElement('iframe');

    printFrame.setAttribute('title', printTitle);
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.style.opacity = '0';

    document.body.appendChild(printFrame);

    const printDocument = printFrame.contentDocument || printFrame.contentWindow?.document;
    const printContext = printFrame.contentWindow;

    if (!printDocument || !printContext) {
      printFrame.remove();
      document.title = printTitle;
      window.print();
      window.setTimeout(() => {
        document.title = previousTitle;
      }, 500);
      return;
    }

    printDocument.open();
    printDocument.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>${escapeHtml(printTitle)}</title>
          ${styles}
          <style>
            @page { size: A4 portrait; margin: 20mm 14mm 20mm 14mm; }
            html, body {
              width: auto !important;
              min-height: 0 !important;
              margin: 0 !important;
              padding: 4mm 0 !important;
              overflow: visible !important;
              background: #fff !important;
              color: #000 !important;
            }
            body {
              font-family: "Inter", "Open Sans", "Segoe UI", Arial, sans-serif;
              font-size: 11px;
              line-height: 1.2;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            body * {
              visibility: visible !important;
            }
            .reports-print-area {
              position: static !important;
              display: block !important;
              width: auto !important;
              max-width: none !important;
              min-height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              color: #000 !important;
              background: #fff !important;
              border: 0 !important;
              box-shadow: none !important;
              border-radius: 0 !important;
              overflow: visible !important;
            }
            .reports-print-header {
              display: flex !important;
              align-items: center !important;
              justify-content: space-between !important;
              gap: 12mm !important;
              padding: 3mm 0 6mm 0 !important;
              margin: 0 0 7mm 0 !important;
              border-bottom: 1px solid #000 !important;
              page-break-inside: avoid !important;
            }
            .reports-print-logo {
              width: 22mm !important;
              height: 22mm !important;
              object-fit: contain !important;
            }
          .reports-screen-header {
              padding: 0 0 7mm 0 !important;
              margin: 0 !important;
              border-bottom: 0 !important;
              background: #fff !important;
              text-align: center !important;
            }
            .reports-print-body {
              padding: 0 !important;
              background: #fff !important;
              line-height: 1.2 !important;
            }
            .reports-print-body .space-y-12 > :not([hidden]) ~ :not([hidden]) {
              margin-top: 6mm !important;
            }
            .reports-print-body .space-y-4 > :not([hidden]) ~ :not([hidden]) {
              margin-top: 2mm !important;
            }
            .reports-print-body .space-y-2 > :not([hidden]) ~ :not([hidden]) {
              margin-top: 1mm !important;
            }
            .reports-print-body :where(.py-2, .py-4, .py-5, .py-6) {
              padding-top: 1.2mm !important;
              padding-bottom: 1.2mm !important;
            }
            .reports-print-body :where(.pt-4, .pt-6, .pt-10) {
              padding-top: 3mm !important;
            }
            .reports-print-body :where(.mt-4, .mt-6) {
              margin-top: 3mm !important;
            }
            .reports-print-body :where(.mb-3, .mb-6, .mb-8) {
              margin-bottom: 3mm !important;
            }
            .reports-print-body :where(.px-5) {
              padding-left: 3mm !important;
              padding-right: 3mm !important;
            }
            .reports-print-body :where(.text-sm) {
              font-size: 11px !important;
            }
            .reports-print-body :where(.text-xs) {
              font-size: 10px !important;
            }
            .reports-signatures {
              display: block !important;
              padding: 5mm 0 0 0 !important;
              margin: 0 !important;
            }
            .reports-signatures > div {
              display: grid !important;
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 14mm !important;
              padding-top: 8mm !important;
              margin: 0 !important;
            }
            .reports-print-footer {
              padding: 8mm 0 4mm 0 !important;
              margin-top: 8mm !important;
              background: #fff !important;
              border-top: 1px solid #000 !important;
            }
            .reports-print-area,
            .reports-print-area :where(h1, h2, h3, h4, p, span, div, td, th) {
              color: #000 !important;
            }
            .reports-print-area :where(.bg-gray-50, .bg-gray-100, .bg-brand, .bg-brand\\/5, .bg-brand\\/10, .bg-rose-50) {
              background: #fff !important;
            }
            .reports-print-area :where(.shadow-sm, .shadow-md, .shadow-lg, [class*="shadow-"]) {
              box-shadow: none !important;
            }
            .reports-print-area :where(.rounded, .rounded-md, .rounded-lg, .rounded-full) {
              border-radius: 0 !important;
            }
            .reports-print-area table,
            .reports-print-area th,
            .reports-print-area td {
              border-color: #000 !important;
            }
            .reports-print-area tr {
              page-break-inside: avoid !important;
            }
            .no-print {
              display: none !important;
            }
          </style>
        </head>
        <body>
          ${reportClone.outerHTML}
        </body>
      </html>
    `);
    printDocument.close();

    const printNow = () => {
      printContext.focus();
      printContext.print();
      window.setTimeout(() => {
        printFrame.remove();
      }, 1000);
    };

    const waitForImages = () => {
      const images = Array.from(printDocument.images);
      const pendingImages = images.filter(image => !image.complete);

      if (pendingImages.length === 0) {
        printContext.setTimeout(printNow, 250);
        return;
      }

      let resolved = 0;
      const resolveImage = () => {
        resolved += 1;
        if (resolved >= pendingImages.length) {
          printContext.setTimeout(printNow, 250);
        }
      };

      pendingImages.forEach(image => {
        image.onload = resolveImage;
        image.onerror = resolveImage;
      });
    };

    if (printDocument.readyState === 'complete') {
      waitForImages();
    } else {
      printFrame.onload = waitForImages;
    }
  };

  const handleExport = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    const timestamp = new Date().toISOString().split('T')[0];
    let filename = "";

    if (reportType === 'BS') {
      filename = `Balance_Sheet_${timestamp}.csv`;
      csvContent += "Category,Level,Account Code,Account Name,Account Type,Balance\n";
      balanceSheetDetails.assets.forEach(row => csvContent += `Assets,${row.depth + 1},"${row.account.code}","${row.account.name}",${row.account.isHeader ? 'Header' : 'Posting'},${row.summary.balance}\n`);
      csvContent += `Total Assets,,,,,${bs.totalAssets}\n`;
      balanceSheetDetails.liabilities.forEach(row => csvContent += `Liabilities,${row.depth + 1},"${row.account.code}","${row.account.name}",${row.account.isHeader ? 'Header' : 'Posting'},${row.summary.balance}\n`);
      csvContent += `Total Liabilities,,,,,${bs.totalLiabilities}\n`;
      balanceSheetDetails.equity.forEach(row => csvContent += `Equity,${row.depth + 1},"${row.account.code}","${row.account.name}",${row.account.isHeader ? 'Header' : 'Posting'},${row.summary.balance}\n`);
      csvContent += `Total Equity,,,,,${bs.totalEquity}\n`;
    } else if (reportType === 'IS') {
      filename = `Income_Statement_${timestamp}.csv`;
      csvContent += "Category,Level,Account Code,Account Name,Account Type,Balance\n";
      incomeStatementDetails.revenue.forEach(row => csvContent += `Revenue,${row.depth + 1},"${row.account.code}","${row.account.name}",${row.account.isHeader ? 'Header' : 'Posting'},${row.summary.balance}\n`);
      csvContent += `Total Revenue,,,,,${isReport.totalRevenue}\n`;
      incomeStatementDetails.expenses.forEach(row => csvContent += `Expenses,${row.depth + 1},"${row.account.code}","${row.account.name}",${row.account.isHeader ? 'Header' : 'Posting'},${row.summary.balance}\n`);
      csvContent += `Total Expenses,,,,,${isReport.totalExpenses}\n`;
      csvContent += `Net Income,,,,,${isReport.netIncome}\n`;
    } else if (reportType === 'CFS') {
      filename = `Cash_Flow_${timestamp}.csv`;
      csvContent += "Activity,Item,Amount\n";
      csvContent += `Operating,Net Income,${cfsReport.netIncome}\n`;
      csvContent += `Operating,Depreciation Adjustment,${cfsReport.depreciationAdjustment}\n`;
      csvContent += `Operating,Change in Receivables,${cfsReport.changeInAR}\n`;
      csvContent += `Operating,Change in Payables,${cfsReport.changeInAP}\n`;
      csvContent += `Total Operating Activity,,${cfsReport.operatingCashFlow}\n`;
      csvContent += `Investing,Capital Expenditure,${cfsReport.investingCashFlow}\n`;
      csvContent += `Financing,Equity Contributions/Drawings,${cfsReport.financingCashFlow}\n`;
      csvContent += `Net Cash Flow,,${cfsReport.netCashFlow}\n`;
      csvContent += `Ending Cash Balance,,${cfsReport.endingCash}\n`;
    } else if (reportType === 'TB') {
      filename = `Trial_Balance_${timestamp}.csv`;
      csvContent += "Account Code,Account Title,Debit,Credit\n";
      reportSummariesBS.filter(s => {
        const acc = accounts.find(a => a.id === s.accountId);
        return acc && !acc.isHeader;
      }).forEach(s => {
        const acc = accounts.find(a => a.id === s.accountId);
        csvContent += `${acc?.code || ''},"${s.accountName}",${s.totalDebit > 0 ? s.totalDebit : 0},${s.totalCredit > 0 ? s.totalCredit : 0}\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currencySymbol = currency === 'USD' ? '$' : currency === 'PHP' ? '\u20B1' : currency === 'EUR' ? '€' : currency;

  const formatDateLabel = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const activeQualification = qualifications.find(q => q.id === selectedQualificationId);

  return (
    <div className="reports-view space-y-8 animate-in fade-in duration-500 pb-20">
      <style>{`
        @page {
          size: A4 portrait;
          margin: 18mm 12mm 18mm 12mm;
        }

        @media print {
          body {
            background: #fff !important;
            color: #000 !important;
            margin: 0 !important;
            padding: 4mm 0 !important;
            font-size: 11px !important;
            line-height: 1.2 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          html,
          body,
          #root {
            width: auto !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #fff !important;
          }

          body * {
            visibility: hidden !important;
          }

          .reports-view {
            display: block !important;
            width: auto !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            overflow: visible !important;
          }

          .reports-view > * + * {
            margin-top: 0 !important;
          }

          .reports-view > .no-print {
            display: none !important;
          }

          .reports-print-area,
          .reports-print-area * {
            visibility: visible !important;
          }

          .reports-print-area {
            position: static !important;
            display: block !important;
            width: auto !important;
            max-width: none !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            color: #000 !important;
            background: #fff !important;
            border: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
          }

          .reports-print-area,
          .reports-print-area :where(h1, h2, h3, h4, p, span, div, td, th) {
            color: #000 !important;
          }

          .reports-print-area :where(.bg-gray-50, .bg-gray-100, .bg-brand, .bg-brand\\/5, .bg-brand\\/10, .bg-rose-50) {
            background: #fff !important;
          }

          .reports-print-area :where(.shadow-sm, .shadow-md, .shadow-lg, [class*="shadow-"]) {
            box-shadow: none !important;
          }

          .reports-print-area :where(.rounded, .rounded-md, .rounded-lg, .rounded-full) {
            border-radius: 0 !important;
          }

          .reports-print-header {
            display: none !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 12mm !important;
            padding: 3mm 0 6mm 0 !important;
            margin: 0 0 7mm 0 !important;
            border-bottom: 1px solid #000 !important;
            page-break-inside: avoid !important;
          }

          .reports-print-logo {
            width: 22mm !important;
            height: 22mm !important;
            object-fit: contain !important;
          }

          .reports-print-title-block {
            flex: 1 !important;
            text-align: left !important;
          }

          .reports-screen-header {
            padding: 0 0 5mm 0 !important;
            margin: 0 !important;
            border-bottom: 0 !important;
            background: #fff !important;
            text-align: center !important;
          }

          .reports-print-body {
            padding: 0 !important;
            background: #fff !important;
            line-height: 1.2 !important;
          }

          .reports-print-body .space-y-12 > :not([hidden]) ~ :not([hidden]) {
            margin-top: 6mm !important;
          }

          .reports-print-body .space-y-4 > :not([hidden]) ~ :not([hidden]) {
            margin-top: 2mm !important;
          }

          .reports-print-body .space-y-2 > :not([hidden]) ~ :not([hidden]) {
            margin-top: 1mm !important;
          }

          .reports-print-body :where(.py-2, .py-4, .py-5, .py-6) {
            padding-top: 1.2mm !important;
            padding-bottom: 1.2mm !important;
          }

          .reports-print-body :where(.pt-4, .pt-6, .pt-10) {
            padding-top: 3mm !important;
          }

          .reports-print-body :where(.mt-4, .mt-6) {
            margin-top: 3mm !important;
          }

          .reports-print-body :where(.mb-3, .mb-6, .mb-8) {
            margin-bottom: 3mm !important;
          }

          .reports-print-body :where(.px-5) {
            padding-left: 3mm !important;
            padding-right: 3mm !important;
          }

          .reports-print-body :where(.text-sm) {
            font-size: 11px !important;
          }

          .reports-print-body :where(.text-xs) {
            font-size: 10px !important;
          }

          .reports-print-footer {
            display: none !important;
            padding: 8mm 0 4mm 0 !important;
            margin-top: 8mm !important;
            background: #fff !important;
            border-top: 1px solid #000 !important;
          }

          .reports-signatures {
            padding: 5mm 0 0 0 !important;
            margin: 0 !important;
          }

          .reports-signatures > div {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 14mm !important;
            padding-top: 8mm !important;
            margin: 0 !important;
          }

          .reports-print-area table,
          .reports-print-area th,
          .reports-print-area td {
            border-color: #000 !important;
          }

          .reports-print-area tr,
          .reports-print-area .reports-section {
            page-break-inside: avoid !important;
          }

          .reports-print-area .no-print {
            display: none !important;
          }
        }
      `}</style>
      <header className="sticky top-0 z-30 -mx-2 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200/80 bg-slate-50/95 px-2 py-4 shadow-[0_8px_16px_-16px_rgba(15,23,42,0.45)] backdrop-blur-sm no-print">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 tracking-tight">Institutional Financial Reports</h2>
          <p className="text-sm text-gray-500 font-normal italic">Standardized statements and regulatory reporting for educational institutions.</p>
        </div>
      </header>

      <div className="bg-white p-8 rounded border border-gray-200 shadow-sm no-print">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex bg-gray-100 rounded p-1.5 border border-gray-200 flex-wrap">
              <ReportTab active={reportType === 'BS'} onClick={() => { setReportType('BS'); setSelectedQualificationId(''); }} label="Balance Sheet" />
              <ReportTab active={reportType === 'IS'} onClick={() => setReportType('IS')} label="Profit & Loss" />
              <ReportTab active={reportType === 'CFS'} onClick={() => { setReportType('CFS'); setSelectedQualificationId(''); }} label="Cash Flow" />
              <ReportTab active={reportType === 'TB'} onClick={() => { setReportType('TB'); setSelectedQualificationId(''); }} label="Trial Balance" />
              <ReportTab active={reportType === 'CUSTOM'} onClick={() => { setReportType('CUSTOM'); setSelectedQualificationId(''); }} label="Custom Builder" icon={<Wrench size={12} />} />
              <ReportTab active={reportType === 'QR'} onClick={() => setReportType('QR')} label="Compliance" />
            </div>

            <div className="flex items-center gap-3">
              {reportType !== 'CUSTOM' && (
                <>
                  <button
                    onClick={() => void refreshReportData()}
                    disabled={isRefreshing}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 rounded hover:bg-gray-50 transition-all border border-gray-200 font-bold text-sm disabled:cursor-wait disabled:opacity-60"
                  >
                    <Clock size={17} className={isRefreshing ? 'animate-spin text-brand' : 'text-brand'} />
                    {isRefreshing ? 'Syncing ledger…' : 'Refresh data'}
                  </button>
                  <button onClick={handlePrint} className="flex items-center gap-2 px-6 py-2.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-all border border-gray-200 font-bold text-sm">
                    <Printer size={18} className="text-brand" /> Print
                  </button>
                  <button onClick={handleExport} className="flex items-center gap-2 px-6 py-2.5 bg-brand text-white rounded hover:bg-brand-hover transition-all shadow-brand/20 font-bold text-sm">
                    <Download size={18} /> Export CSV
                  </button>
                </>
              )}
            </div>
          </div>

          {reportType !== 'CUSTOM' && (
            <div className="flex flex-wrap items-center gap-5 pt-6 border-t border-gray-100">
              {refreshError && (
                <div className="basis-full flex items-center gap-2 text-xs font-semibold text-rose-600">
                  <AlertCircle size={15} /> {refreshError}
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-50 rounded-lg"><Calendar size={18} className="text-gray-400" /></div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide leading-none mb-1">Fiscal Range</p>
                  <div className="flex items-center gap-2">
                    <input type="date" className="bg-transparent border-none outline-none text-xs text-gray-800 font-semibold p-0 focus:ring-0" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    <span className="text-gray-300 font-bold text-xs">TO</span>
                    <input type="date" className="bg-transparent border-none outline-none text-xs text-gray-800 font-semibold p-0 focus:ring-0" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
              </div>

              {reportType === 'IS' && (
                <div className="flex items-center gap-3 animate-in fade-in slide-in-from-left-4">
                  <div className="p-2 bg-brand/5 rounded-lg"><Award size={18} className={`text-brand ${selectedQualificationId ? 'animate-pulse' : ''}`} /></div>
                  <div>
                    <p className="text-xs font-bold text-brand uppercase tracking-wide leading-none mb-1">Functional Segment</p>
                    <div className="relative">
                      <select
                        className="bg-transparent border-none outline-none text-xs text-brand font-bold p-0 pr-6 focus:ring-0 appearance-none cursor-pointer"
                        value={selectedQualificationId}
                        onChange={(e) => setSelectedQualificationId(e.target.value)}
                      >
                        <option value="">Consolidated (Global View)</option>
                        {qualifications.map(q => (
                          <option key={q.id} value={q.id}>{q.name}</option>
                        ))}
                      </select>
                      <ChevronRight size={10} className="absolute right-0 top-1/2 -translate-y-1/2 text-brand pointer-events-none rotate-90" />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex-1 flex justify-end">
                {selectedQualificationId ? (
                  <div className="flex items-center gap-2 px-4 py-2 bg-brand/5 rounded border border-brand-light animate-in zoom-in duration-300">
                    <Filter size={16} className="text-brand" />
                    <span className="text-xs font-bold text-brand uppercase tracking-wide">Segment Filter Active</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2 bg-brand/5 rounded border border-brand-light">
                    <CheckCircle2 size={16} className="text-brand" />
                    <span className="text-xs font-bold text-brand uppercase tracking-wide">Consolidated & Reconciled</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom Report Builder */}
      {reportType === 'CUSTOM' && (
        <CustomReportBuilder
          accounts={accounts}
          entries={entries}
          lines={lines}
          currency={currency}
        />
      )}

      {/* Standard Reports Container */}
      {reportType !== 'CUSTOM' && (
        <div className="reports-print-area bg-white rounded-md shadow-sm border border-gray-200 overflow-visible flex flex-col min-h-[800px] print:border-none print:shadow-none print:rounded-none">
          <div className="reports-print-header hidden">
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  className="reports-print-logo"
                  alt={`${orgName} logo`}
                  data-reports-print-logo="true"
                />
              ) : (
                <div className="reports-print-logo flex items-center justify-center border border-gray-900">
                  <Building2 size={28} />
                </div>
              )}
              <div className="reports-print-title-block">
                <h1 className="text-base font-semibold uppercase leading-tight">{orgName}</h1>
                <p className="mt-1 text-[11px] font-semibold uppercase text-gray-600">Official Financial Report</p>
              </div>
            </div>
            <div className="text-right text-[10px] font-semibold uppercase leading-relaxed text-gray-700">
              <p>Printed {formatDateLabel(new Date().toISOString().split('T')[0])}</p>
              <p>Internal Use Only</p>
            </div>
          </div>

          <div className="reports-screen-header p-16 border-b border-gray-50 bg-gray-50/20 text-center print:bg-white print:p-8">
            <div className="flex items-center justify-center gap-2 mb-4 no-print">
              <div className="w-12 h-1 bg-brand rounded-full"></div>
              <div className="w-2 h-2 bg-brand rounded-full"></div>
              <div className="w-12 h-1 bg-brand rounded-full"></div>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 tracking-tight">{orgName.toUpperCase()}</h2>
            <div className="text-xs text-gray-400 mt-2 font-bold uppercase tracking-wide flex items-center justify-center gap-2">
              <span>Financial Information Segment</span>
              {activeQualification && (
                <>
                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                  <span className="text-brand">Qualification: {activeQualification.name}</span>
                </>
              )}
            </div>

            <div className="mt-8">
              <h1 className="text-lg font-bold text-brand uppercase tracking-wide print:text-gray-900">
                {reportType === 'BS' ? 'Statement of Financial Position' :
                  reportType === 'IS' ? 'Statement of Comprehensive Income' :
                    reportType === 'CFS' ? 'Statement of Cash Flows' :
                      reportType === 'TB' ? 'Trial Balance Registry' : 'Regulatory Report'}
              </h1>
              <p className="text-xs text-gray-400 mt-1 font-bold uppercase tracking-wide">
                {reportType === 'BS' ? `AS OF ${formatDateLabel(endDate).toUpperCase()}` : `PERIOD ENDING ${formatDateLabel(endDate).toUpperCase()}`}
              </p>
            </div>
          </div>

          <div className="reports-print-body p-16 flex-1 bg-white print:p-8">
            {(!reportSummariesBS || reportSummariesBS.length === 0) && (!reportSummariesIS || reportSummariesIS.length === 0) ? (
              <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
                <div className="p-4 bg-gray-100 rounded-full">
                  <BarChart size={32} className="text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700 uppercase tracking-wide">No Report Data Available</h3>
                <p className="text-sm text-gray-500 max-w-sm">There are no transactions recorded for the selected period. Please check your date range or create some journal entries to generate reports.</p>
              </div>
            ) : (
              <>
                {reportType === 'BS' && (
                  <div className="space-y-12 max-w-3xl mx-auto">
                    <DetailedFinancialSection title="I. ASSETS" rows={balanceSheetDetails.assets} total={bs.totalAssets} symbol={currencySymbol} />
                    <DetailedFinancialSection title="II. LIABILITIES" rows={balanceSheetDetails.liabilities} total={bs.totalLiabilities} symbol={currencySymbol} />
                    <DetailedFinancialSection
                      title="III. OWNER'S EQUITY"
                      rows={balanceSheetDetails.equity}
                      total={bs.totalEquity}
                      symbol={currencySymbol}
                      additionalItems={Math.abs(bs.currentPeriodNetIncome) > 0.005 ? [
                        {
                          label: bs.currentPeriodNetIncome >= 0 ? "Current Period Net Income" : "Current Period Net Loss",
                          code: "NET-INCOME",
                          amount: bs.currentPeriodNetIncome
                        }
                      ] : undefined}
                    />

                    <div className="pt-10 mt-6 border-t-2 border-gray-800 flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-900 uppercase tracking-wide">TOTAL LIABILITIES AND EQUITY</span>
                      <span className="text-lg font-mono font-semibold text-gray-900 underline decoration-double decoration-gray-900 underline-offset-4">
                        {formatCurrency(bs.totalLiabilities + bs.totalEquity)}
                      </span>
                    </div>
                  </div>
                )}

                {reportType === 'IS' && (
                  <div className="space-y-12 max-w-3xl mx-auto">
                    <DetailedFinancialSection title="REVENUE SOURCES" rows={incomeStatementDetails.revenue} total={isReport.totalRevenue} symbol={currencySymbol} />
                    <DetailedFinancialSection title="OPERATING EXPENSES" rows={incomeStatementDetails.expenses} total={isReport.totalExpenses} symbol={currencySymbol} />

                    <div className={`pt-10 mt-6 border-t-2 border-gray-800 flex justify-between items-center ${isReport.netIncome >= 0 ? 'text-brand print:text-gray-900' : 'text-rose-700 print:text-gray-900'}`}>
                      <span className="text-sm font-semibold uppercase tracking-wide">NET COMPREHENSIVE INCOME / (LOSS)</span>
                      <span className="text-lg font-mono font-semibold underline decoration-double underline-offset-4">
                        {formatCurrency(isReport.netIncome)}
                      </span>
                    </div>
                  </div>
                )}

                {reportType === 'CFS' && (
                  <div className="space-y-12 max-w-3xl mx-auto">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-6 flex items-center gap-3">
                        <div className="w-2 h-2 bg-brand rounded-full no-print"></div>
                        CASH FLOW FROM OPERATING ACTIVITIES
                      </h4>
                      <div className="space-y-4 px-5">
                        <div className="flex justify-between items-center text-sm font-bold text-gray-700">
                          <span className="flex-1">Net Income / Profit for the Period</span>
                          <span className="font-mono text-xs w-32 text-right">{formatCurrency(cfsReport.netIncome)}</span>
                        </div>

                        <div className="py-2">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Adjustments for non-cash items:</p>
                          <div className="space-y-2 pl-4">
                            <div className="flex justify-between text-xs font-medium text-gray-500">
                              <span>Depreciation & Amortization Expense</span>
                              <span className="font-mono">{formatCurrency(cfsReport.depreciationAdjustment)}</span>
                            </div>
                            <div className="flex justify-between text-xs font-medium text-gray-500">
                              <span>(Increase) / Decrease in Trade Receivables</span>
                              <span className="font-mono">{formatCurrency(cfsReport.changeInAR)}</span>
                            </div>
                            <div className="flex justify-between text-xs font-medium text-gray-500">
                              <span>Increase / (Decrease) in Accounts Payable</span>
                              <span className="font-mono">{formatCurrency(cfsReport.changeInAP)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-gray-100 text-xs font-semibold text-gray-900 uppercase tracking-wide">
                          <span>NET CASH FROM OPERATING ACTIVITIES</span>
                          <span className="border-b-2 border-gray-200 pb-1">{formatCurrency(cfsReport.operatingCashFlow)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-6 flex items-center gap-3">
                        <div className="w-2 h-2 bg-brand rounded-full no-print"></div>
                        CASH FLOW FROM INVESTING ACTIVITIES
                      </h4>
                      <div className="space-y-4 px-5">
                        <div className="flex justify-between items-center text-xs font-medium text-gray-500">
                          <span>Payments for Capital Expenditure (Fixed Assets)</span>
                          <span className="font-mono">{formatCurrency(cfsReport.investingCashFlow)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-4 border-t border-gray-100 text-xs font-semibold text-gray-900 uppercase tracking-wide">
                          <span>NET CASH USED IN INVESTING ACTIVITIES</span>
                          <span className="border-b-2 border-gray-200 pb-1">{formatCurrency(cfsReport.investingCashFlow)}</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-6 flex items-center gap-3">
                        <div className="w-2 h-2 bg-brand rounded-full no-print"></div>
                        CASH FLOW FROM FINANCING ACTIVITIES
                      </h4>
                      <div className="space-y-4 px-5">
                        <div className="flex justify-between items-center text-xs font-medium text-gray-500">
                          <span>Owner Contributions / (Drawings)</span>
                          <span className="font-mono">{formatCurrency(cfsReport.financingCashFlow)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-4 border-t border-gray-100 text-xs font-semibold text-gray-900 uppercase tracking-wide">
                          <span>NET CASH FROM FINANCING ACTIVITIES</span>
                          <span className="border-b-2 border-gray-200 pb-1">{formatCurrency(cfsReport.financingCashFlow)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-10 mt-6 border-t-4 border-double border-gray-800 bg-gray-50 p-8 rounded-md print:bg-white print:p-0">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center text-sm font-bold text-brand uppercase tracking-wide print:text-gray-900">
                          <span>NET INCREASE / (DECREASE) IN CASH</span>
                          <span className="font-mono">{formatCurrency(cfsReport.netCashFlow)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-wide">
                          <span>Add: Cash at Beginning of Period</span>
                          <span className="font-mono">{formatCurrency(cfsReport.beginningCash)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-4 mt-4 border-t-2 border-gray-800 text-lg font-semibold text-gray-900 uppercase tracking-wide">
                          <span>CASH AT END OF PERIOD</span>
                          <span className="font-mono underline decoration-double underline-offset-4">{formatCurrency(cfsReport.endingCash)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {reportType === 'TB' && (
                  <div className="max-w-4xl mx-auto overflow-hidden rounded border border-gray-200 print:border-gray-800">
                    <table className="min-w-full divide-y divide-gray-100 print:divide-gray-900">
                      <thead className="bg-gray-50 print:bg-white">
                        <tr>
                          <th className="px-5 py-6 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide print:text-gray-900">G/L Account Title</th>
                          <th className="px-5 py-6 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide print:text-gray-900">Debit</th>
                          <th className="px-5 py-6 text-right text-xs font-semibold text-gray-400 uppercase tracking-wide print:text-gray-900">Credit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 print:divide-gray-200">
                        {reportSummariesBS.filter(s => {
                          const acc = accounts.find(a => a.id === s.accountId);
                          return acc && !acc.isHeader;
                        }).map(s => (
                          <tr key={s.accountId} className="hover:bg-gray-50 transition-colors">
                            <td className="px-5 py-5 text-sm font-bold text-gray-800 tracking-tight">{s.accountName.toUpperCase()}</td>
                            <td className="px-5 py-5 text-right font-mono text-xs font-bold text-gray-600">{s.totalDebit > 0 ? formatCurrency(s.totalDebit) : '—'}</td>
                            <td className="px-5 py-5 text-right font-mono text-xs font-bold text-gray-600">{s.totalCredit > 0 ? formatCurrency(s.totalCredit) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="reports-signatures hidden print:block p-16 pt-0">
            <div className="grid grid-cols-2 gap-20 pt-20">
              <div className="space-y-12">
                <div className="border-t border-gray-800 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Prepared & Certified Correct By:</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1 uppercase">Institutional Accountant</p>
                </div>
              </div>
              <div className="space-y-12">
                <div className="border-t border-gray-800 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reviewed & Approved By:</p>
                  <p className="text-sm font-semibold text-gray-900 mt-1 uppercase">Institutional President</p>
                </div>
              </div>
            </div>
          </div>

          <div className="reports-print-footer px-16 py-10 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-6 print:bg-white print:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand print:bg-white print:border print:border-gray-800">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide print:text-gray-900">Internal Certification</p>
                <p className="text-xs font-bold text-gray-700">Audit-Ready Snapshot • GAAP Compliant</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold text-gray-300 uppercase tracking-wide print:text-gray-900">
              <div className="flex items-center gap-1.5"><Clock size={14} /> SYS_SYNC: {new Date().toLocaleTimeString()}</div>
              <div className="w-1 h-1 bg-gray-200 rounded-full print:bg-gray-800"></div>
              <div className="italic text-brand print:text-gray-900">AccounTech Engine v4.0.1</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ReportTab: React.FC<{ active: boolean, label: string, onClick: () => void, icon?: React.ReactNode }> = ({ active, label, onClick, icon }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-6 py-2.5 rounded text-xs font-bold uppercase tracking-wide transition-all ${active ? 'bg-white text-brand shadow-md shadow-gray-50 border border-brand-light' : 'text-gray-400 hover:text-gray-600'}`}
  >
    {icon}{label}
  </button>
);

const DetailedFinancialSection: React.FC<{
  title: string;
  rows: DetailedFinancialRow[];
  total: number;
  symbol: string;
  additionalItems?: { label: string; code?: string; amount: number }[];
}> = ({ title, rows, total, symbol, additionalItems }) => {
  return (
    <div className="animate-in fade-in duration-700 slide-in-from-bottom-2">
      <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-8 flex items-center gap-4">
        <div className="flex-1 h-px bg-gray-100 print:bg-gray-800"></div>
        {title}
        <div className="flex-1 h-px bg-gray-100 print:bg-gray-800"></div>
      </h4>
      <div className="space-y-2 px-5">
        {rows.length > 0 ? rows.map(row => {
          const isGroup = row.account.isHeader || row.hasChildren;
          const indentStyle = { paddingLeft: `${row.depth * 1.25}rem` };

          return (
            <div
              key={row.account.id}
              className={`grid grid-cols-[1fr_auto] gap-4 py-2 ${isGroup ? 'border-t border-gray-50 first:border-t-0' : ''}`}
            >
              <div className="min-w-0 flex items-center gap-3" style={indentStyle}>
                <ChevronRight
                  size={12}
                  className={`${isGroup ? 'text-brand print:text-gray-900' : 'text-gray-200 print:text-gray-900'} transition-colors`}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className={`text-sm tracking-tight print:text-gray-900 ${isGroup ? 'font-semibold text-gray-800 uppercase' : 'font-medium text-gray-600'}`}>
                      {row.account.name}
                    </span>
                    <span className="text-[10px] font-semibold text-gray-300 uppercase tracking-wide print:text-gray-700">
                      {row.account.code}
                    </span>
                  </div>
                </div>
              </div>
              <span className={`font-mono text-xs text-right print:text-gray-900 ${isGroup ? 'font-semibold text-gray-800' : 'font-medium text-gray-500'}`}>
                {row.summary.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          );
        }) : (
          <div className="py-4 text-center text-gray-300 italic text-xs uppercase tracking-wide print:text-gray-400">
            No activity attributed to this segment.
          </div>
        )}

        {additionalItems && additionalItems.map((item, idx) => (
          <div
            key={`extra-${idx}`}
            className="grid grid-cols-[1fr_auto] gap-4 py-2 border-t border-gray-100"
          >
            <div className="min-w-0 flex items-center gap-3">
              <ChevronRight size={12} className="text-brand print:text-gray-900 transition-colors" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-sm tracking-tight print:text-gray-900 font-semibold text-gray-800 uppercase">
                    {item.label}
                  </span>
                  {item.code && (
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide print:text-gray-700">
                      {item.code}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <span className={`font-mono text-xs text-right print:text-gray-900 font-semibold ${item.amount < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
              {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}

        <div className="flex justify-between items-center pt-6 mt-6 border-t border-gray-100 text-sm font-semibold text-gray-900 uppercase tracking-wide print:border-gray-800">
          <span>SUBTOTAL {title}</span>
          <span className="border-b-2 border-gray-800 pb-1">{symbol} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
  );
};

const FinancialSection: React.FC<{ title: string, items: TransactionSummary[], total: number, symbol: string }> = ({ title, items, total, symbol }) => {
  const visibleItems = items.filter(i => Math.abs(i.balance) > 0.01);

  return (
    <div className="animate-in fade-in duration-700 slide-in-from-bottom-2">
      <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-8 flex items-center gap-4">
        <div className="flex-1 h-px bg-gray-100 print:bg-gray-800"></div>
        {title}
        <div className="flex-1 h-px bg-gray-100 print:bg-gray-800"></div>
      </h4>
      <div className="space-y-4 px-5">
        {visibleItems.length > 0 ? visibleItems.map(item => (
          <div key={item.accountId} className="flex justify-between items-center group">
            <div className="flex items-center gap-3">
              <ChevronRight size={12} className="text-gray-200 group-hover:text-brand transition-colors print:text-gray-900" />
              <span className="text-sm font-bold text-gray-600 group-hover:text-gray-900 transition-colors tracking-tight print:text-gray-900">{item.accountName}</span>
            </div>
            <span className="font-mono text-xs font-medium text-gray-500 group-hover:text-gray-800 transition-colors print:text-gray-900">
              {item.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        )) : (
          <div className="py-4 text-center text-gray-300 italic text-xs uppercase tracking-wide print:text-gray-400">
            No activity attributed to this segment.
          </div>
        )}
        <div className="flex justify-between items-center pt-6 mt-6 border-t border-gray-100 text-sm font-semibold text-gray-900 uppercase tracking-wide print:border-gray-800">
          <span>SUBTOTAL {title}</span>
          <span className="border-b-2 border-gray-800 pb-1">{symbol} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
  );
};

export default Reports;

