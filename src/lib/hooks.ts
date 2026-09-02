'use client'

import { useTable, useSetting } from './localdb'
import type {
  BreadType, Production, Material, Good, Consumption, Customer, Sale,
  Supplier, Purchase, Machine, MachineCost, ExpenseCategory, Expense, OtherFund,
} from './types'
import type { DataBundle } from './calc'

/** همه داده‌های زنده برای محاسبات گزارش */
export function useDataBundle(): DataBundle {
  const breadTypes = useTable<BreadType>('breadTypes')
  const productions = useTable<Production>('productions')
  const materials = useTable<Material>('materials')
  const goods = useTable<Good>('goods')
  const consumptions = useTable<Consumption>('consumptions')
  const customers = useTable<Customer>('customers')
  const sales = useTable<Sale>('sales')
  const suppliers = useTable<Supplier>('suppliers')
  const purchases = useTable<Purchase>('purchases')
  const machines = useTable<Machine>('machines')
  const machineCosts = useTable<MachineCost>('machineCosts')
  const expenseCategories = useTable<ExpenseCategory>('expenseCategories')
  const expenses = useTable<Expense>('expenses')
  const otherFunds = useTable<OtherFund>('otherFunds')
  const setting = useSetting()

  return {
    breadTypes, productions, materials, goods, consumptions, customers, sales,
    suppliers: suppliers.map(s => ({ id: s.id, name: s.name })),
    purchases, machines, machineCosts, expenseCategories, expenses, otherFunds, setting,
  }
}
