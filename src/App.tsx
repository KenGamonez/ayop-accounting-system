import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { StoreProvider, useStore } from './store/AppStore';
import Layout from './components/Layout';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Transactions from './pages/Transactions';
import Accounting from './pages/Accounting';
import TransactionTypes from './pages/TransactionTypes';
import { CashIn, CashOut } from './pages/CashPages';
import Disbursement from './pages/Disbursement';
import Journal from './pages/Journal';
import Reports, { TrialBalance, IncomeExpense, FinancialCondition, BalanceSheet, CashFlow } from './pages/Reports';
import Approval from './pages/Approval';
import Inventory from './pages/Inventory';
import Purchasing from './pages/Purchasing';
import { BusinessUnits, Settings } from './pages/Ops';
import ImportExport from './pages/ImportExport';
import CloseChecklist from './pages/CloseChecklist';

function Guard({ children }: { children: React.ReactNode }) {
  const { user } = useStore();
  if (!user) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin" element={<Guard><Layout /></Guard>}>
            <Route index element={<Overview />} />
            <Route path="transaction" element={<Transactions />} />
            <Route path="accounting" element={<Accounting />} />
            <Route path="transaction-types" element={<TransactionTypes />} />
            <Route path="disbursement" element={<Disbursement />} />
            <Route path="cash-in" element={<CashIn />} />
            <Route path="cash-out" element={<CashOut />} />
            <Route path="journal" element={<Journal />} />
            <Route path="reports" element={<Reports />} />
            <Route path="trial-balance" element={<TrialBalance />} />
            <Route path="income-expense" element={<IncomeExpense />} />
            <Route path="financial-condition" element={<FinancialCondition />} />
            <Route path="balance-sheet" element={<BalanceSheet />} />
            <Route path="cash-flow" element={<CashFlow />} />
            <Route path="close" element={<CloseChecklist />} />
            <Route path="approval" element={<Approval />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="purchasing" element={<Purchasing />} />
            <Route path="business-units" element={<BusinessUnits />} />
            <Route path="import-export" element={<ImportExport />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  );
}
